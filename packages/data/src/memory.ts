import { create } from "@bufbuild/protobuf";
import {
  type Aggregate,
  AggregateFunction,
  type Bucket,
  CancelResponseSchema,
  CountRequestSchema,
  CountResponseSchema,
  DescribeTableResponseSchema,
  DescribeTableRequestSchema,
  ExecuteRequestSchema,
  type ExecuteResponse,
  ExecuteResponseSchema,
  ExplainRequestSchema,
  ExplainResponseSchema,
  type Filter,
  FilterOperator,
  FileEntryKind,
  ListCatalogsResponseSchema,
  ListFilesResponseSchema,
  ListSchemasResponseSchema,
  ListSnapshotsResponseSchema,
  ListSourcesResponseSchema,
  ListTablesRequestSchema,
  ListTablesResponseSchema,
  NoticeSeverity,
  NullOrder,
  RewriteMode,
  SortDirection,
  SourceKind,
  TableFormat,
  TableKind,
  TestSourceResponseSchema,
  TimeGrain,
  type ViewQuery,
} from "@surfaces-ui/proto";
import { DataType as ArrowType, type DataType, type Dictionary, Float64, Table, tableFromArrays, vectorFromArray } from "apache-arrow";
import type { DataSource } from "./datasource.js";
import { evaluateMeasure, parseMeasureExpression } from "./measure.js";
import { encodeTable } from "./ipc.js";

type Row = Record<string, unknown>;

export interface MemoryDataSourceOptions {
  /** Tables by name. Rows are plain objects, or pass an Arrow table to control types. */
  tables: Record<string, Table | Row[]>;
  /** ID reported for the single source. Defaults to "memory". */
  sourceId?: string;
  /**
   * Files to list as the source's storage, by path with "/" between parts
   * ("lake/orders/2024.parquet"). Folders are made from the paths. Without
   * it the source has no storage to list (`listFiles` is left out).
   */
  files?: { path: string; sizeBytes?: number; modifiedAt?: string; table?: string }[];
}

// The table may be written with its catalog and schema; only its own name matters here.
const SELECT_ALL = /^\s*select\s+\*\s+from\s+(?:"?[A-Za-z_][\w$]*"?\.){0,2}"?([A-Za-z_][\w$]*)"?\s*;?\s*$/i;

function comparable(value: unknown): unknown {
  if (typeof value === "bigint") return Number(value);
  if (value instanceof Date) return value.getTime();
  return value;
}

function compare(a: unknown, b: unknown): number {
  const x = comparable(a);
  const y = comparable(b);
  if (typeof x === "number" && typeof y === "number") return x - y;
  return String(x).localeCompare(String(y));
}

function matches(row: Row, filter: Filter): boolean {
  const cell = row[filter.column];
  const values = filter.values.map((v) => v.kind.value);
  const text = () => String(cell ?? "").toLowerCase();
  const needle = () => String(values[0] ?? "").toLowerCase();
  switch (filter.operator) {
    case FilterOperator.IS_NULL:
      return cell == null;
    case FilterOperator.IS_NOT_NULL:
      return cell != null;
  }
  if (cell == null) return false;
  switch (filter.operator) {
    case FilterOperator.EQ:
      return compare(cell, values[0]) === 0;
    case FilterOperator.NEQ:
      return compare(cell, values[0]) !== 0;
    case FilterOperator.LT:
      return compare(cell, values[0]) < 0;
    case FilterOperator.LTE:
      return compare(cell, values[0]) <= 0;
    case FilterOperator.GT:
      return compare(cell, values[0]) > 0;
    case FilterOperator.GTE:
      return compare(cell, values[0]) >= 0;
    case FilterOperator.IN:
      return values.some((v) => compare(cell, v) === 0);
    case FilterOperator.NOT_IN:
      return !values.some((v) => compare(cell, v) === 0);
    case FilterOperator.BETWEEN:
      return compare(cell, values[0]) >= 0 && compare(cell, values[1]) <= 0;
    case FilterOperator.CONTAINS:
      return text().includes(needle());
    case FilterOperator.STARTS_WITH:
      return text().startsWith(needle());
    case FilterOperator.ENDS_WITH:
      return text().endsWith(needle());
    default:
      return true;
  }
}

/** Start of the time bucket holding `ms` (UTC; weeks start on Monday). */
function truncate(ms: number, grain: TimeGrain): number {
  const d = new Date(ms);
  const [y, m, day] = [d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()];
  switch (grain) {
    case TimeGrain.MINUTE:
      return Math.floor(ms / 60_000) * 60_000;
    case TimeGrain.HOUR:
      return Math.floor(ms / 3_600_000) * 3_600_000;
    case TimeGrain.DAY:
      return Date.UTC(y, m, day);
    case TimeGrain.WEEK:
      return Date.UTC(y, m, day - ((d.getUTCDay() + 6) % 7));
    case TimeGrain.MONTH:
      return Date.UTC(y, m, 1);
    case TimeGrain.QUARTER:
      return Date.UTC(y, m - (m % 3), 1);
    case TimeGrain.YEAR:
      return Date.UTC(y, 0, 1);
    default:
      throw new Error("A bucket has no time grain.");
  }
}

function bucketValue(row: Row, bucket: Bucket): unknown {
  const cell = comparable(row[bucket.column]);
  if (cell == null) return null;
  if (bucket.by.case === "grain") return truncate(Number(cell), bucket.by.value);
  if (bucket.by.case === "binWidth") {
    if (!(bucket.by.value > 0)) throw new Error(`The bin width for ${bucket.column} must be greater than zero.`);
    return Math.floor(Number(cell) / bucket.by.value) * bucket.by.value;
  }
  throw new Error(`The bucket on ${bucket.column} needs a time grain or a bin width.`);
}

/** The value at a fraction of the way through sorted numbers, interpolating between neighbours. */
function quantile(sorted: number[], fraction: number): number | null {
  if (sorted.length === 0) return null;
  const at = (sorted.length - 1) * fraction;
  const low = Math.floor(at);
  const high = Math.ceil(at);
  return sorted[low]! + (sorted[high]! - sorted[low]!) * (at - low);
}

/** A repeatable random subset of `size` rows, in their original order. */
function sampleRows<T>(rows: T[], size: number): T[] {
  if (rows.length <= size) return rows;
  let seed = 1;
  const random = () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const picked = rows.map((_, i) => i);
  for (let i = 0; i < size; i++) {
    const j = i + Math.floor(random() * (picked.length - i));
    [picked[i], picked[j]] = [picked[j]!, picked[i]!];
  }
  return picked
    .slice(0, size)
    .sort((a, b) => a - b)
    .map((i) => rows[i]!);
}

/**
 * A DataSource that holds its tables in memory. It exists so components can
 * be developed, tested and demonstrated with no server or engine.
 *
 * It understands only `SELECT * FROM <table>` as the base query; filters,
 * sorts, column selection, paging, grouping, buckets, aggregates and samples
 * from the `ViewQuery` are all honoured.
 * Because it holds every row, applying them in JavaScript here is correct —
 * it is the backend, not the browser sorting a partial result.
 */
export function memoryDataSource(options: MemoryDataSourceOptions): DataSource {
  const sourceId = options.sourceId ?? "memory";
  const tables = new Map<string, Table>();
  for (const [name, data] of Object.entries(options.tables)) {
    if (data instanceof Table) tables.set(name, data);
    else {
      const columns = Object.keys(data[0] ?? {});
      tables.set(name, tableFromArrays(Object.fromEntries(columns.map((c) => [c, data.map((row) => row[c])]))));
    }
  }

  const find = (query: ViewQuery | undefined): Table => {
    const name = SELECT_ALL.exec(query?.baseSql ?? "")?.[1];
    if (!name) throw new Error('memoryDataSource only runs "SELECT * FROM <table>"');
    const table = tables.get(name) ?? [...tables].find(([k]) => k.toLowerCase() === name.toLowerCase())?.[1];
    if (!table) throw new Error(`Table not found: ${name}`);
    return table;
  };

  const summarise = (item: Aggregate, rows: Row[]): unknown => {
    const values = item.column === "" ? rows : rows.map((r) => r[item.column]).filter((v) => v != null);
    const numbers = () => values.map((v) => Number(v));
    switch (item.function) {
      case AggregateFunction.COUNT:
        return values.length;
      case AggregateFunction.COUNT_DISTINCT:
      case AggregateFunction.APPROX_COUNT_DISTINCT:
        return new Set(values.map(String)).size;
      case AggregateFunction.MEDIAN:
        return quantile(numbers().sort((a, b) => a - b), 0.5);
      case AggregateFunction.PERCENTILE:
        if (!(item.percentile >= 0 && item.percentile <= 1)) throw new Error(`The percentile for ${item.alias} must be between 0 and 1.`);
        return quantile(numbers().sort((a, b) => a - b), item.percentile);
      case AggregateFunction.STDDEV:
      case AggregateFunction.VARIANCE: {
        if (values.length < 2) return null;
        const all = numbers();
        const mean = all.reduce((a, b) => a + b, 0) / all.length;
        const variance = all.reduce((a, b) => a + (b - mean) ** 2, 0) / (all.length - 1);
        return item.function === AggregateFunction.VARIANCE ? variance : Math.sqrt(variance);
      }
      case AggregateFunction.SUM:
        return values.length === 0 ? null : numbers().reduce((a, b) => a + b, 0);
      case AggregateFunction.AVG:
        return values.length === 0 ? null : numbers().reduce((a, b) => a + b, 0) / values.length;
      case AggregateFunction.MIN:
        return values.length === 0 ? null : values.reduce((a, b) => (compare(a, b) <= 0 ? a : b));
      case AggregateFunction.MAX:
        return values.length === 0 ? null : values.reduce((a, b) => (compare(a, b) >= 0 ? a : b));
      default:
        throw new Error("An aggregate has no function.");
    }
  };

  /** Rows after filtering, grouping and sorting, with the Arrow type of each output column. */
  const shaped = (query: ViewQuery | undefined): { rows: Row[]; types: Map<string, DataType> } => {
    const table = find(query);
    let rows = table.toArray().map((r) => (r as { toJSON(): Row }).toJSON());
    for (const filter of query?.filters ?? []) rows = rows.filter((row) => matches(row, filter));
    const types = new Map<string, DataType>(table.schema.fields.map((f) => [f.name, f.type]));

    const groupBy = query?.groupBy ?? [];
    const aggregates = query?.aggregates ?? [];
    const buckets = query?.buckets ?? [];
    const grouped = groupBy.length > 0 || aggregates.length > 0 || buckets.length > 0;
    const sampleSize = query?.sample?.rows ?? 0;
    if (sampleSize > 0) {
      if (grouped || (query?.page?.offset ?? 0n) > 0n) throw new Error("A sample cannot be combined with grouping or a page offset.");
      rows = sampleRows(rows, sampleSize);
    }
    if (grouped) {
      const bucketName = (b: Bucket) => b.alias || b.column;
      const groups = new Map<string, Row[]>();
      for (const row of rows) {
        const key = JSON.stringify([...groupBy.map((c) => comparable(row[c]) ?? null), ...buckets.map((b) => bucketValue(row, b))]);
        const group = groups.get(key);
        if (group) group.push(row);
        else groups.set(key, [row]);
      }
      if (groupBy.length === 0 && buckets.length === 0 && groups.size === 0) groups.set("[]", []);
      rows = [...groups.values()].map((members) => ({
        ...Object.fromEntries(groupBy.map((c) => [c, members[0]![c]])),
        ...Object.fromEntries(buckets.map((b) => [bucketName(b), bucketValue(members[0]!, b)])),
        ...Object.fromEntries(aggregates.map((a) => [a.alias, summarise(a, members)])),
      }));
      // Derived measures: arithmetic over the aggregates of each summarised row.
      const derived = (query?.derived ?? []).map((d) => ({ alias: d.alias ?? "", tree: parseMeasureExpression(d.expression ?? "") }));
      if (derived.length > 0) rows = rows.map((row) => ({ ...row, ...Object.fromEntries(derived.map((d) => [d.alias, evaluateMeasure(d.tree, (name) => row[name] as number | null)])) }));
      const outputs = new Map<string, DataType>();
      for (const column of groupBy) outputs.set(column, types.get(column) ?? new Float64());
      for (const b of buckets) outputs.set(bucketName(b), (b.by.case === "grain" && types.get(b.column)) || new Float64());
      for (const item of aggregates) {
        const keepsType = item.function === AggregateFunction.MIN || item.function === AggregateFunction.MAX;
        outputs.set(item.alias, (keepsType && types.get(item.column)) || new Float64());
      }
      for (const d of derived) outputs.set(d.alias, new Float64());
      types.clear();
      for (const [name, type] of outputs) types.set(name, type);
    }

    const sorts = query?.sorts ?? [];
    if (sorts.length > 0) {
      const order = rows.map((_, i) => i);
      order.sort((a, b) => {
        for (const sort of sorts) {
          const x = rows[a]![sort.column];
          const y = rows[b]![sort.column];
          if (x == null || y == null) {
            if (x == null && y == null) continue;
            const nullsFirst = sort.nulls === NullOrder.FIRST;
            return (x == null) === nullsFirst ? -1 : 1;
          }
          const result = compare(x, y);
          if (result !== 0) return sort.direction === SortDirection.DESC ? -result : result;
        }
        return a - b;
      });
      rows = order.map((i) => rows[i]!);
    }
    return { rows, types };
  };

  const build = (rows: Row[], types: Map<string, DataType>, columns: string[]): Table => {
    const names = columns.length > 0 ? columns : [...types.keys()];
    return new Table(
      Object.fromEntries(
        names.map((name) => {
          const type = types.get(name);
          if (!type) throw new Error(`Column not found: ${name}`);
          // Dictionary-encoded columns are rebuilt as their plain value type.
          const plain = ArrowType.isDictionary(type) ? (type as Dictionary).dictionary : type;
          return [name, vectorFromArray(rows.map((row) => row[name] ?? null), plain)];
        }),
      ),
    );
  };

  return {
    async *execute(init, callOptions) {
      const started = Date.now();
      const request = create(ExecuteRequestSchema, init);
      const query = request.query;
      const { rows, types } = shaped(query);
      const offset = Number(query?.page?.offset ?? 0n);
      const limit = query?.page?.limit ?? 0;
      const window = limit > 0 ? rows.slice(offset, offset + limit) : rows.slice(offset);
      const result = build(window, types, query?.columns ?? []);
      const encoded = encodeTable(result, request.batchRows);
      const part = (value: ExecuteResponse["part"]) => create(ExecuteResponseSchema, { part: value });
      yield part({
        case: "header",
        value: {
          arrowSchema: encoded.schema,
          executedSql: query?.baseSql ?? "",
          rewriteMode: RewriteMode.NONE,
          queryId: request.queryId,
          columns: result.schema.fields.map((f) => ({
            name: f.name,
            nativeType: String(f.type),
            sortable: true,
            filterable: true,
          })),
          notices:
            limit > 0 && (query?.sorts.length ?? 0) === 0 && !query?.sample?.rows
              ? [{ severity: NoticeSeverity.INFO, code: "UNSTABLE_PAGE_ORDER", message: "Paging without a sort." }]
              : [],
        },
      } as ExecuteResponse["part"]);
      for (const batch of encoded.batches) {
        if (callOptions?.signal?.aborted) throw new Error("cancelled");
        yield part({ case: "batch", value: { arrowBatch: batch.bytes, rowCount: BigInt(batch.rows) } } as ExecuteResponse["part"]);
      }
      const more = limit > 0 && offset + limit < rows.length;
      yield part({
        case: "footer",
        value: {
          totalRowsReturned: BigInt(window.length),
          nextCursor: "",
          truncated: more,
          elapsedMs: BigInt(Date.now() - started),
        },
      } as ExecuteResponse["part"]);
    },
    async count(init) {
      const request = create(CountRequestSchema, init);
      return create(CountResponseSchema, { rowCount: BigInt(shaped(request.query).rows.length) });
    },
    async explain(init) {
      return create(ExplainResponseSchema, {
        planText: "In-memory scan",
        executedSql: create(ExplainRequestSchema, init).query?.baseSql ?? "",
      });
    },
    async cancel() {
      return create(CancelResponseSchema, { cancelled: false });
    },
    async listSources() {
      return create(ListSourcesResponseSchema, {
        sources: [{ id: sourceId, displayName: "In memory", kind: SourceKind.FILES, readOnly: true, capabilities: { exactCount: true } }],
      });
    },
    ...(options.files
      ? {
          async listFiles(init: { path?: string; pageSize?: number; pageToken?: string }) {
            const prefix = init.path ? `${init.path.replace(/\/+$/, "")}/` : "";
            const folders = new Set<string>();
            const here: NonNullable<MemoryDataSourceOptions["files"]> = [];
            for (const file of options.files ?? []) {
              if (!file.path.startsWith(prefix)) continue;
              const rest = file.path.slice(prefix.length);
              const cut = rest.indexOf("/");
              if (cut >= 0) folders.add(rest.slice(0, cut));
              else here.push(file);
            }
            const format = (name: string) => (name.endsWith(".parquet") ? TableFormat.PARQUET : name.endsWith(".csv") ? TableFormat.CSV : name.endsWith(".json") ? TableFormat.JSON : TableFormat.UNSPECIFIED);
            const entries = [
              ...[...folders].sort().map((name) => ({ name, path: `${prefix}${name}`, kind: FileEntryKind.FOLDER })),
              ...here
                .sort((a, b) => a.path.localeCompare(b.path))
                .map((file) => ({
                  name: file.path.slice(prefix.length),
                  path: file.path,
                  kind: FileEntryKind.FILE,
                  ...(file.sizeBytes !== undefined ? { sizeBytes: BigInt(file.sizeBytes) } : {}),
                  modifiedAt: file.modifiedAt ?? "",
                  format: format(file.path),
                  table: file.table ?? "",
                })),
            ];
            const size = init.pageSize || 500;
            const from = Number.parseInt(init.pageToken || "0", 10) || 0;
            return create(ListFilesResponseSchema, { entries: entries.slice(from, from + size), nextPageToken: from + size < entries.length ? String(from + size) : "" });
          },
        }
      : {}),
    async testSource() {
      return create(TestSourceResponseSchema, {
        ok: true,
        message: "Connected",
        engineVersion: "in memory",
        checks: [...tables.keys()].map((name) => ({ name, ok: true, message: "Reachable" })),
      });
    },
    async listCatalogs() {
      return create(ListCatalogsResponseSchema, { catalogs: [{ name: "memory" }] });
    },
    async listSchemas() {
      return create(ListSchemasResponseSchema, { schemas: [{ catalog: "memory", name: "main" }] });
    },
    async listTables(init) {
      const request = create(ListTablesRequestSchema, init);
      const search = request.search.toLowerCase();
      const names = [...tables.keys()].filter((name) => name.toLowerCase().includes(search));
      const offset = Number(request.pageToken || 0);
      const end = request.pageSize > 0 ? offset + request.pageSize : names.length;
      return create(ListTablesResponseSchema, {
        tables: names.slice(offset, end).map((table) => ({ ref: { catalog: "memory", schema: "main", table }, kind: TableKind.TABLE })),
        nextPageToken: end < names.length ? String(end) : "",
      });
    },
    async describeTable(init) {
      const name = create(DescribeTableRequestSchema, init).ref?.table ?? "";
      const table = tables.get(name);
      if (!table) throw new Error(`Table not found: ${name}`);
      return create(DescribeTableResponseSchema, {
        table: {
          summary: { ref: { catalog: "memory", schema: "main", table: name }, kind: TableKind.TABLE },
          rowCount: BigInt(table.numRows),
          columns: table.schema.fields.map((f, i) => ({
            name: f.name,
            nativeType: String(f.type),
            arrowType: String(f.type),
            nullable: f.nullable,
            ordinal: i + 1,
          })),
        },
      });
    },
    async listSnapshots() {
      return create(ListSnapshotsResponseSchema, {});
    },
  };
}
