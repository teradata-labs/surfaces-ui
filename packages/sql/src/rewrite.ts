import { clone, create } from "@bufbuild/protobuf";
import * as polyglot from "@polyglot-sql/sdk";
import { MeasureExpressionError, measureNames, parseMeasureExpression, writeMeasure } from "@surfaces-ui/data";
import {
  type Aggregate,
  AggregateFunction,
  type Bucket,
  type Filter,
  FilterOperator,
  type Notice,
  NoticeSchema,
  NoticeSeverity,
  NullOrder,
  RewriteMode,
  type Sort,
  SortDirection,
  SqlDialect,
  TimeGrain,
  type Value,
  type ViewQuery,
  ViewQuerySchema,
} from "@surfaces-ui/proto";
import { SqlError } from "./errors.js";
import { blankLiterals, guardText, trimStatement } from "./guard.js";

/** A value bound to a `?` placeholder. */
export type Param = string | number | bigint | boolean;

export interface Rewritten {
  /** SQL to send to the engine, with `?` placeholders. */
  sql: string;
  /** Values for the placeholders, in order. */
  params: Param[];
  mode: RewriteMode;
  notices: Notice[];
}

const DIALECT_NAME: Partial<Record<SqlDialect, string>> = {
  [SqlDialect.DUCKDB]: "duckdb",
  [SqlDialect.DATAFUSION]: "datafusion",
  [SqlDialect.TERADATA]: "teradata",
  [SqlDialect.POSTGRES]: "postgresql",
};

const QUERY_KINDS = new Set(["select", "union", "intersect", "except"]);
const ALIAS = '"_sf"';
const GROUPED = '"_ag"';

type Ast = Record<string, Record<string, unknown>>;

let ready = false;

/** Loads the SQL parser. Call once before `rewriteQuery` or `countQuery`. */
export async function initSql(): Promise<void> {
  if (ready) return;
  const init = (polyglot as { init?: () => Promise<unknown> }).init;
  if (init) await init();
  ready = true;
}

function dialectName(dialect: SqlDialect): string {
  const name = DIALECT_NAME[dialect];
  if (!name) throw new SqlError("INVALID_VIEW", "The source has no SQL dialect set.");
  return name;
}

function generate(ast: Ast, dialect: string): string {
  const result = polyglot.generate([ast] as never, dialect as never);
  if (!result.success || !result.sql?.[0]) throw new Error(result.error ?? "could not generate SQL");
  return result.sql[0];
}

function quote(identifier: string): string {
  if (identifier === "") throw new SqlError("INVALID_VIEW", "A column name is empty.");
  return `"${identifier.replace(/"/g, '""')}"`;
}

function param(value: Value | undefined): Param {
  const kind = value?.kind;
  if (!kind || kind.case === undefined) throw new SqlError("INVALID_VIEW", "A filter or parameter value is missing.");
  return kind.value;
}

/** Splits a parsed base query into the parts a wrapper needs. */
interface Parts {
  /** e.g. `LOCKING ROW FOR ACCESS ` — must stay at the very front. */
  prefix: string;
  /** e.g. `WITH a AS (...) ` — hoisted, because Teradata rejects WITH inside a derived table. */
  with: string;
  /** The query body, safe to place inside `FROM (...)`. */
  inner: string;
  parsed: boolean;
}

function split(baseSql: string, dialect: string): Parts {
  const text = trimStatement(baseSql);
  if (text === "") throw new SqlError("SYNTAX", "The query is empty.");
  const result = polyglot.parse(text, dialect as never);
  if (!result.success) {
    // Not every dialect construct parses. Fall back to a strict text check.
    guardText(text);
    return { prefix: "", with: "", inner: text, parsed: false };
  }
  const statements = (Array.isArray(result.ast) ? result.ast : [result.ast]) as Ast[];
  if (statements.length !== 1) {
    throw new SqlError("MULTIPLE_STATEMENTS", "Only one statement can run at a time.");
  }
  let root = statements[0]!;
  let prefix = "";
  if (root.locking_statement) {
    const whole = generate(root, dialect);
    root = root.locking_statement.expression as Ast;
    const body = generate(root, dialect);
    if (!whole.endsWith(body)) throw new Error("could not separate the LOCKING modifier");
    prefix = whole.slice(0, whole.length - body.length);
  }
  const kind = Object.keys(root)[0]!;
  if (!QUERY_KINDS.has(kind)) {
    throw new SqlError("NOT_READ_ONLY", "Only queries (SELECT or WITH) can run here.");
  }
  const body = { ...root[kind]! };
  let withSql = "";
  if (body.with) {
    const whole = generate({ [kind]: body }, dialect);
    const rest = generate({ [kind]: { ...body, with: null } }, dialect);
    if (!whole.endsWith(rest)) throw new Error("could not separate the WITH clause");
    withSql = whole.slice(0, whole.length - rest.length);
    body.with = null;
  }
  // ORDER BY inside a derived table is an error on Teradata unless TOP is
  // present, and has no effect elsewhere: the outer query decides the order.
  if (body.order_by && !body.top && !body.limit) body.order_by = null;
  return { prefix, with: withSql, inner: generate({ [kind]: body }, dialect), parsed: true };
}

function escapeLike(text: string): string {
  return text.replace(/[\\%_]/g, (c) => `\\${c}`);
}

function predicate(filter: Filter, params: Param[]): string {
  const col = quote(filter.column);
  const values = filter.values;
  const need = (n: number) => {
    if (values.length !== n) {
      throw new SqlError("INVALID_VIEW", `The filter on ${filter.column} needs ${n} value${n === 1 ? "" : "s"}.`);
    }
  };
  const compare = (op: string) => {
    need(1);
    params.push(param(values[0]));
    return `${col} ${op} ?`;
  };
  const like = (wrap: (text: string) => string) => {
    need(1);
    params.push(wrap(escapeLike(String(param(values[0])))));
    return `LOWER(${col}) LIKE LOWER(?) ESCAPE '\\'`;
  };
  switch (filter.operator) {
    case FilterOperator.EQ:
      return compare("=");
    case FilterOperator.NEQ:
      return compare("<>");
    case FilterOperator.LT:
      return compare("<");
    case FilterOperator.LTE:
      return compare("<=");
    case FilterOperator.GT:
      return compare(">");
    case FilterOperator.GTE:
      return compare(">=");
    case FilterOperator.IN:
    case FilterOperator.NOT_IN: {
      if (values.length === 0) throw new SqlError("INVALID_VIEW", `The filter on ${filter.column} has no values.`);
      for (const v of values) params.push(param(v));
      const not = filter.operator === FilterOperator.NOT_IN ? "NOT " : "";
      return `${col} ${not}IN (${values.map(() => "?").join(", ")})`;
    }
    case FilterOperator.BETWEEN:
      need(2);
      params.push(param(values[0]), param(values[1]));
      return `${col} BETWEEN ? AND ?`;
    case FilterOperator.CONTAINS:
      return like((t) => `%${t}%`);
    case FilterOperator.STARTS_WITH:
      return like((t) => `${t}%`);
    case FilterOperator.ENDS_WITH:
      return like((t) => `%${t}`);
    case FilterOperator.IS_NULL:
      return `${col} IS NULL`;
    case FilterOperator.IS_NOT_NULL:
      return `${col} IS NOT NULL`;
    default:
      throw new SqlError("INVALID_VIEW", `The filter on ${filter.column} has no operator.`);
  }
}

function orderBy(sorts: Sort[]): string {
  return sorts
    .map((sort) => {
      const direction = sort.direction === SortDirection.DESC ? "DESC" : "ASC";
      const nulls =
        sort.nulls === NullOrder.FIRST ? " NULLS FIRST" : sort.nulls === NullOrder.LAST ? " NULLS LAST" : "";
      return `${quote(sort.column)} ${direction}${nulls}`;
    })
    .join(", ");
}

function notice(severity: NoticeSeverity, code: string, message: string): Notice {
  return create(NoticeSchema, { severity, code, message });
}

const within = (fraction: number, column: string) => `PERCENTILE_CONT(${fraction}) WITHIN GROUP (ORDER BY ${column})`;

function aggregateSql(item: Aggregate, column: string, dialect: SqlDialect): string {
  switch (item.function) {
    case AggregateFunction.COUNT:
      return `COUNT(${column})`;
    case AggregateFunction.COUNT_DISTINCT:
      return `COUNT(DISTINCT ${column})`;
    case AggregateFunction.SUM:
      return `SUM(${column})`;
    case AggregateFunction.AVG:
      return `AVG(${column})`;
    case AggregateFunction.MIN:
      return `MIN(${column})`;
    case AggregateFunction.MAX:
      return `MAX(${column})`;
    case AggregateFunction.MEDIAN:
      return dialect === SqlDialect.POSTGRES ? within(0.5, column) : `MEDIAN(${column})`;
    case AggregateFunction.STDDEV:
      return `STDDEV_SAMP(${column})`;
    case AggregateFunction.VARIANCE:
      return `VAR_SAMP(${column})`;
    case AggregateFunction.PERCENTILE: {
      const fraction = item.percentile;
      if (!(fraction >= 0 && fraction <= 1)) {
        throw new SqlError("INVALID_VIEW", `The percentile for ${item.alias} must be between 0 and 1.`);
      }
      if (dialect === SqlDialect.DUCKDB) return `QUANTILE_CONT(${column}, ${fraction})`;
      if (dialect === SqlDialect.DATAFUSION) return `APPROX_PERCENTILE_CONT(${column}, ${fraction})`;
      return within(fraction, column);
    }
    case AggregateFunction.APPROX_COUNT_DISTINCT:
      if (dialect === SqlDialect.DUCKDB) return `APPROX_COUNT_DISTINCT(${column})`;
      // Teradata and Postgres have no built-in estimate, and DataFusion's does not
      // accept every column type (floats and timestamps fail), so they count exactly.
      return `COUNT(DISTINCT ${column})`;
    default:
      throw new SqlError("INVALID_VIEW", "An aggregate has no function.");
  }
}

/** An aggregate as an expression, without its output name. */
function aggregateExpression(item: Aggregate, dialect: SqlDialect): string {
  if (item.alias === "") throw new SqlError("INVALID_VIEW", "An aggregate needs a name for its output column.");
  if (item.column === "" && item.function !== AggregateFunction.COUNT) {
    throw new SqlError("INVALID_VIEW", `The aggregate ${item.alias} needs a column.`);
  }
  return aggregateSql(item, item.column === "" ? "*" : quote(item.column), dialect);
}

function aggregate(item: Aggregate, dialect: SqlDialect): string {
  return `${aggregateExpression(item, dialect)} AS ${quote(item.alias)}`;
}

/**
 * A derived measure as SQL: its expression with each aggregate's name
 * replaced by the aggregate itself, since one output of a SELECT cannot
 * refer to another. The expression is parsed, never pasted: only names of
 * this query's aggregates, numbers and arithmetic get through. A division
 * is done in floating point (Teradata would otherwise divide whole numbers
 * as whole numbers) and by zero gives null.
 */
function derivedMeasure(item: { alias: string; expression: string }, aggregates: Aggregate[], dialect: SqlDialect): string {
  if (item.alias === "") throw new SqlError("INVALID_VIEW", "A derived measure needs a name for its output column.");
  let tree: ReturnType<typeof parseMeasureExpression>;
  try {
    tree = parseMeasureExpression(item.expression);
  } catch (error) {
    throw new SqlError("INVALID_VIEW", `The calculation for ${item.alias} cannot be read: ${error instanceof MeasureExpressionError ? error.message : String(error)}`);
  }
  const byAlias = new Map(aggregates.map((a) => [a.alias, a]));
  const unknown = measureNames(tree).filter((name) => !byAlias.has(name));
  if (unknown.length > 0) throw new SqlError("INVALID_VIEW", `The calculation for ${item.alias} uses ${unknown.map((n) => `"${n}"`).join(", ")}, which ${unknown.length === 1 ? "is not an aggregate" : "are not aggregates"} of this query.`);
  const float = dialect === SqlDialect.TERADATA ? "FLOAT" : "DOUBLE";
  const sql = writeMeasure(tree, {
    name: (name) => `(${aggregateExpression(byAlias.get(name)!, dialect)})`,
    divide: (left, right) => `(CAST(${left} AS ${float}) / NULLIF(${right}, 0))`,
  });
  return `${sql} AS ${quote(item.alias)}`;
}

const GRAIN_NAME: Partial<Record<TimeGrain, string>> = {
  [TimeGrain.MINUTE]: "minute",
  [TimeGrain.HOUR]: "hour",
  [TimeGrain.DAY]: "day",
  [TimeGrain.WEEK]: "week",
  [TimeGrain.MONTH]: "month",
  [TimeGrain.QUARTER]: "quarter",
  [TimeGrain.YEAR]: "year",
};

/** Teradata has no DATE_TRUNC: dates are truncated with TRUNC, times rebuilt from text. */
const TERADATA_GRAIN: Partial<Record<TimeGrain, (column: string) => string>> = {
  [TimeGrain.MINUTE]: (c) => `CAST(TO_CHAR(${c}, 'YYYY-MM-DD HH24:MI') || ':00' AS TIMESTAMP(0))`,
  [TimeGrain.HOUR]: (c) => `CAST(TO_CHAR(${c}, 'YYYY-MM-DD HH24') || ':00:00' AS TIMESTAMP(0))`,
  [TimeGrain.DAY]: (c) => `CAST(${c} AS DATE)`,
  [TimeGrain.WEEK]: (c) => `TRUNC(CAST(${c} AS DATE), 'IW')`,
  [TimeGrain.MONTH]: (c) => `TRUNC(CAST(${c} AS DATE), 'MM')`,
  [TimeGrain.QUARTER]: (c) => `TRUNC(CAST(${c} AS DATE), 'Q')`,
  [TimeGrain.YEAR]: (c) => `TRUNC(CAST(${c} AS DATE), 'YYYY')`,
};

/** The grouping expression for a bucket, and the name of its output column. */
function bucket(item: Bucket, dialect: SqlDialect): { expression: string; alias: string } {
  const column = quote(item.column);
  const alias = item.alias || item.column;
  if (item.by.case === "grain") {
    const name = GRAIN_NAME[item.by.value];
    const teradata = TERADATA_GRAIN[item.by.value];
    if (!name || !teradata) throw new SqlError("INVALID_VIEW", `The bucket on ${item.column} has no time grain.`);
    return { expression: dialect === SqlDialect.TERADATA ? teradata(column) : `DATE_TRUNC('${name}', ${column})`, alias };
  }
  if (item.by.case === "binWidth") {
    const width = item.by.value;
    if (!Number.isFinite(width) || width <= 0) {
      throw new SqlError("INVALID_VIEW", `The bin width for ${item.column} must be greater than zero.`);
    }
    // Integer division would round towards zero and misplace negative values.
    const value =
      dialect === SqlDialect.DUCKDB ? column : `CAST(${column} AS ${dialect === SqlDialect.TERADATA ? "FLOAT" : "DOUBLE PRECISION"})`;
    return { expression: `FLOOR(${value} / ${width}) * ${width}`, alias };
  }
  throw new SqlError("INVALID_VIEW", `The bucket on ${item.column} needs a time grain or a bin width.`);
}

interface Wrapped {
  parts: Parts;
  /** `FROM ...` clause holding the base query with filters (and grouping) applied. */
  from: string;
  params: Param[];
  notices: Notice[];
  /** Rows to sample with a clause at the end of the statement (Teradata), or 0. */
  trailingSample: number;
}

function isGrouped(query: ViewQuery): boolean {
  return query.groupBy.length > 0 || query.aggregates.length > 0 || query.buckets.length > 0;
}

function wrap(query: ViewQuery, kind: SqlDialect): Wrapped {
  const dialect = dialectName(kind);
  const parts = split(query.baseSql, dialect);
  const params: Param[] = query.parameters.map(param);
  const where = query.filters.map((f) => predicate(f, params)).join(" AND ");
  const notices: Notice[] = [];
  if (!parts.parsed) {
    notices.push(
      notice(
        NoticeSeverity.WARNING,
        "REWRITE_FALLBACK",
        "This query uses syntax the rewriter could not read, so it was wrapped as written. Sorting, filtering or paging may fail if it contains WITH or ORDER BY.",
      ),
    );
  }
  let from = ` FROM (${parts.inner}) AS ${ALIAS}${where ? ` WHERE ${where}` : ""}`;
  let trailingSample = 0;
  const sampleRows = query.sample?.rows ?? 0;
  if (sampleRows > 0) {
    if (isGrouped(query) || (query.page?.offset ?? 0n) > 0n) {
      throw new SqlError("INVALID_VIEW", "A sample cannot be combined with grouping or a page offset.");
    }
    const limit = query.page?.limit ?? 0;
    const rows = limit > 0 ? Math.min(limit, sampleRows) : sampleRows;
    if (kind === SqlDialect.TERADATA) {
      trailingSample = rows;
    } else if (kind === SqlDialect.DUCKDB) {
      // DuckDB samples before WHERE, so the filtered rows get their own derived
      // table. The fixed seed keeps a chart the same between two loads.
      from = ` FROM (SELECT *${from}) AS ${ALIAS} USING SAMPLE reservoir(${rows} ROWS) REPEATABLE (1)`;
    } else {
      from = ` FROM (SELECT *${from} ORDER BY RANDOM() LIMIT ${rows}) AS ${ALIAS}`;
    }
  }
  if (query.derived.length > 0 && query.aggregates.length === 0) {
    throw new SqlError("INVALID_VIEW", "A derived measure is worked out from aggregates, and this query has none.");
  }
  if (isGrouped(query)) {
    // Grouping gets its own derived table so sorting and paging (including
    // Teradata's QUALIFY) act on the summarised rows by output name.
    const buckets = query.buckets.map((b) => bucket(b, kind));
    const groups = [...query.groupBy.map(quote), ...buckets.map((b) => b.expression)];
    const outputs = [
      ...query.groupBy.map(quote),
      ...buckets.map((b) => `${b.expression} AS ${quote(b.alias)}`),
      ...query.aggregates.map((a) => aggregate(a, kind)),
      ...query.derived.map((d) => derivedMeasure(d, query.aggregates, kind)),
    ];
    const names = [...query.groupBy, ...buckets.map((b) => b.alias), ...query.aggregates.map((a) => a.alias), ...query.derived.map((d) => d.alias)].map((n) =>
      n.toLowerCase(),
    );
    if (new Set(names).size !== names.length) {
      throw new SqlError("INVALID_VIEW", "Grouped and aggregated columns must have different names.");
    }
    const groupBy = groups.length > 0 ? ` GROUP BY ${groups.join(", ")}` : "";
    from = ` FROM (SELECT ${outputs.join(", ")}${from}${groupBy}) AS ${GROUPED}`;
  }
  return { parts, from, params, notices, trailingSample };
}

/**
 * Turns grid or chart state into SQL the engine can run.
 *
 * The base query is kept intact inside a derived table; filters, sorts and
 * paging are applied around it in the target dialect. Filter values always
 * travel as bound parameters, never as SQL text.
 */
export function rewriteQuery(query: ViewQuery, dialect: SqlDialect): Rewritten {
  if (!ready) throw new Error("call initSql() before rewriteQuery()");
  const { parts, from, params, notices, trailingSample } = wrap(query, dialect);
  const page = query.page;
  const limit = page?.limit ?? 0;
  const offset = Number(page?.offset ?? 0n);
  if (page?.cursor) throw new SqlError("INVALID_VIEW", "Cursor paging is not supported by this rewriter yet.");

  const untouched =
    query.filters.length === 0 &&
    query.sorts.length === 0 &&
    query.columns.length === 0 &&
    !isGrouped(query) &&
    !query.sample?.rows &&
    limit === 0 &&
    offset === 0;
  if (untouched) {
    return placeholders({ sql: trimStatement(query.baseSql), params, mode: RewriteMode.NONE, notices: [] }, dialect);
  }

  const order = orderBy(query.sorts);
  const sampled = (query.sample?.rows ?? 0) > 0;
  if ((limit > 0 || offset > 0) && !order && !sampled) {
    notices.push(
      notice(
        NoticeSeverity.WARNING,
        "UNSTABLE_PAGE_ORDER",
        "Paging without a sort has no fixed order, so rows can repeat or go missing between pages. Sort by a column to make paging stable.",
      ),
    );
  }

  const columns = query.columns.length > 0 ? query.columns.map(quote).join(", ") : "*";
  const head = `${parts.prefix}${parts.with}`;
  let sql: string;

  if (dialect === SqlDialect.TERADATA) {
    // Teradata has no LIMIT/OFFSET: TOP for the first page, ROW_NUMBER after it.
    if (trailingSample > 0) {
      // SAMPLE and TOP cannot be used together; the sample size already honours the limit.
      sql = `${head}SELECT ${columns}${from} SAMPLE ${trailingSample}${order ? ` ORDER BY ${order}` : ""}`;
    } else if (offset === 0) {
      const top = limit > 0 ? `TOP ${limit} ` : "";
      sql = `${head}SELECT ${top}${columns}${from}${order ? ` ORDER BY ${order}` : ""}`;
    } else {
      const last = limit > 0 ? ` BETWEEN ${offset + 1} AND ${offset + limit}` : ` > ${offset}`;
      sql = `${head}SELECT ${columns}${from} QUALIFY ROW_NUMBER() OVER (ORDER BY ${order || "1"})${last}${order ? ` ORDER BY ${order}` : ""}`;
    }
  } else {
    sql = `${head}SELECT ${columns}${from}${order ? ` ORDER BY ${order}` : ""}`;
    if (limit > 0 && !sampled) sql += ` LIMIT ${limit}`;
    if (offset > 0) sql += ` OFFSET ${offset}`;
  }

  return placeholders({ sql, params, mode: parts.parsed ? RewriteMode.PARSED : RewriteMode.WRAPPED, notices }, dialect);
}

/**
 * A query that returns no rows but the columns the base query gives, to learn
 * which columns a view can be filtered on. Its parameters are bound as usual.
 */
export function columnsQuery(query: ViewQuery, dialect: SqlDialect): Rewritten {
  if (!ready) throw new Error("call initSql() before columnsQuery()");
  const bare = create(ViewQuerySchema, { baseSql: query.baseSql, parameters: query.parameters });
  const { parts, from, params } = wrap(bare, dialect);
  return placeholders({ sql: `${parts.prefix}${parts.with}SELECT *${from} WHERE 1 = 0`, params, mode: parts.parsed ? RewriteMode.PARSED : RewriteMode.WRAPPED, notices: [] }, dialect);
}

/**
 * Drops each filter on a column the base query does not return, so a view
 * under a page-wide filter it cannot take is drawn unfiltered by it instead of
 * failing, and says so. Names are compared without regard to case.
 */
export function withoutMissingFilters(query: ViewQuery, columns: readonly string[]): { query: ViewQuery; notices: Notice[] } {
  const has = new Set(columns.map((c) => c.toLowerCase()));
  const missing = query.filters.filter((f) => !has.has(f.column.toLowerCase()));
  if (missing.length === 0) return { query, notices: [] };
  const kept = clone(ViewQuerySchema, query);
  kept.filters = kept.filters.filter((f) => has.has(f.column.toLowerCase()));
  const names = [...new Set(missing.map((f) => f.column))];
  const notices = names.map((name) =>
    notice(NoticeSeverity.WARNING, "FILTER_COLUMN_MISSING", `Not filtered by ${name}: its rows have no ${name} column.`),
  );
  return { query: kept, notices };
}

/** Dialects whose parameters are written as a dollar sign and a number instead of a question mark. */
const NUMBERED = new Set<SqlDialect>([SqlDialect.DATAFUSION, SqlDialect.POSTGRES]);

/**
 * Rewrites question-mark placeholders as numbered ones in the order they
 * appear, which is the order of the bound values. Question marks inside
 * string literals, quoted names and comments are left alone.
 */
export function numberPlaceholders(sql: string): string {
  const bare = blankLiterals(sql);
  let n = 0;
  let out = "";
  for (let i = 0; i < sql.length; i++) {
    if (bare[i] === "?") {
      n += 1;
      out += "$" + String(n);
    } else out += sql[i];
  }
  return out;
}

const placeholders = (rewritten: Rewritten, dialect: SqlDialect): Rewritten =>
  NUMBERED.has(dialect) ? { ...rewritten, sql: numberPlaceholders(rewritten.sql) } : rewritten;

function withoutSample(query: ViewQuery): ViewQuery {
  const copy = clone(ViewQuerySchema, query);
  copy.sample = undefined;
  return copy;
}

/** SQL that counts the rows a view query would return, ignoring sort and paging. */
export function countQuery(query: ViewQuery, dialect: SqlDialect): Rewritten {
  if (!ready) throw new Error("call initSql() before countQuery()");
  const { parts, from, params, notices } = wrap(withoutSample(query), dialect);
  return placeholders(
    {
      sql: `${parts.prefix}${parts.with}SELECT COUNT(*) AS "row_count"${from}`,
      params,
      mode: parts.parsed ? RewriteMode.PARSED : RewriteMode.WRAPPED,
      notices,
    },
    dialect,
  );
}

/** Checks that SQL is a single read-only query without rewriting it. Throws SqlError if not. */
export function assertReadOnly(sql: string, dialect: SqlDialect): void {
  if (!ready) throw new Error("call initSql() before assertReadOnly()");
  split(sql, dialectName(dialect));
}

/** Validates the rewritten SQL parses in its dialect. For tests and diagnostics. */
export function parses(sql: string, dialect: SqlDialect): boolean {
  return polyglot.parse(sql.replace(/\?|\$\d+/g, "0"), dialectName(dialect) as never).success;
}

const NAME = String.raw`(?:"[^"]+"|[A-Za-z_][\w$]*)`;
const PLAIN_SCAN = new RegExp(String.raw`^select\s+\*\s+from\s+${NAME}(?:\.${NAME}){0,2}$`, "i");

/**
 * True when the query is just `SELECT * FROM <table>`. Engines page and
 * filter a plain table directly, so there is nothing to gain from keeping a
 * copy of its result.
 */
export function isPlainScan(sql: string): boolean {
  return PLAIN_SCAN.test(trimStatement(sql));
}

/** True when the view asks for anything beyond running base_sql as written. */
export function hasViewState(query: ViewQuery): boolean {
  return (
    query.filters.length > 0 ||
    query.sorts.length > 0 ||
    query.columns.length > 0 ||
    isGrouped(query) ||
    (query.sample?.rows ?? 0) > 0 ||
    (query.page?.limit ?? 0) > 0 ||
    (query.page?.offset ?? 0n) > 0n
  );
}
