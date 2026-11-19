import { type Engine, EngineError, type Param, type StoreOptions, type StoredRelation, type TableModel, withTableModel } from "@surfaces-ui/engine";
import { Engine as EngineKind, SqlDialect, TableFormat, TableKind, type TableRef } from "@surfaces-ui/proto";
import { assertReadOnly } from "@surfaces-ui/sql";
import { type RecordBatch, tableFromIPC } from "apache-arrow";

/**
 * The calls this package needs from DuckDB-wasm. `AsyncDuckDB` (the browser
 * worker) and the blocking Node bindings both have them; values come back as
 * Arrow IPC bytes, which are read with this repo's own Arrow, so the version
 * DuckDB-wasm bundles does not matter.
 */
export interface DuckDbWasmBindings {
  runQuery(conn: number, text: string): Uint8Array | Promise<Uint8Array>;
  createPrepared(conn: number, text: string): number | Promise<number>;
  runPrepared(conn: number, statement: number, params: unknown[]): Uint8Array | Promise<Uint8Array>;
  closePrepared(conn: number, statement: number): unknown;
  cancelPendingQuery(conn: number): boolean | Promise<boolean>;
  registerFileBuffer(name: string, buffer: Uint8Array): unknown;
  getVersion(): string | Promise<string>;
}

const CATALOG = "memory";
const RESULTS = "_sf_results";
const NAME = /^[A-Za-z_][A-Za-z0-9_]*$/;
const SECRET_FUNCTIONS = /\b(duckdb_secrets|which_secret)\s*\(/i;
const ident = (name: string) => `"${name.replace(/"/g, '""')}"`;
const text = (value: string) => `'${value.replace(/'/g, "''")}'`;

/** Turns a DuckDB-wasm failure into an EngineError a person can act on. `shift` is anything put in front of the caller's SQL. */
function engineError(error: unknown, shift = 0): EngineError {
  if (error instanceof EngineError) return error;
  const raw = error instanceof Error ? error.message : String(error);
  const start = raw.indexOf("{");
  let parsed: { exception_type?: string; exception_message?: string; position?: string; error_subtype?: string } | undefined;
  if (start >= 0) {
    try {
      parsed = JSON.parse(raw.slice(start));
    } catch {
      parsed = undefined;
    }
  }
  if (!parsed) {
    const clean = raw.replace(/^.*?(?=(Binder|Catalog|Parser|Conversion|Invalid Input|IO|Permission|Not implemented) Error)/s, "");
    return new EngineError(/^Catalog Error/.test(clean) ? "UNKNOWN_TABLE" : "ENGINE", clean.split("\n")[0]!.trim() || "The query failed.");
  }
  const kind = parsed.exception_type ?? "";
  const code = kind === "Parser" ? "SYNTAX" : kind === "Catalog" ? "UNKNOWN_TABLE" : parsed.error_subtype === "COLUMN_NOT_FOUND" ? "UNKNOWN_COLUMN" : "ENGINE";
  const lines = (parsed.exception_message ?? "").split("\n").map((l) => l.trim()).filter(Boolean);
  const message = `${kind ? `${kind} error: ` : ""}${lines.join(" ")}` || "The query failed.";
  const offset = parsed.position === undefined ? Number.NaN : Number(parsed.position) - shift;
  return new EngineError(code, message, parsed.error_subtype ?? "", Number.isInteger(offset) && offset >= 0 ? offset : undefined);
}

/** Values DuckDB-wasm can bind: it sends parameters as JSON. */
function bindable(value: Param): unknown {
  if (typeof value !== "bigint") return value;
  return value >= BigInt(Number.MIN_SAFE_INTEGER) && value <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(value) : value.toString();
}

/** The kinds of file a table can be read from. */
export type FileFormat = "parquet" | "csv" | "json";

/** A file's format from its name, or undefined when it is not one DuckDB here reads. */
export function fileFormatOf(fileName: string): FileFormat | undefined {
  const ext = /\.([a-z]+)$/i.exec(fileName)?.[1]?.toLowerCase();
  return ext === "parquet" ? "parquet" : ext === "csv" || ext === "tsv" ? "csv" : ext === "json" || ext === "jsonl" || ext === "ndjson" ? "json" : undefined;
}

/** A table name made from a file name: letters, digits and underscores, starting with a letter. */
export function tableNameOf(fileName: string): string {
  const base = fileName.replace(/\.[^.]*$/, "").toLowerCase().replace(/[^a-z0-9_]+/g, "_").replace(/^_+|_+$/g, "");
  return /^[a-z_]/.test(base) ? base : `t_${base || "file"}`;
}

export interface WasmTableInfo {
  name: string;
  comment?: string;
  /** Where the rows came from, for display: a file name or "generated". */
  location?: string;
  format?: FileFormat | "generated";
  /** Keys and column descriptions the data itself does not hold. */
  model?: TableModel;
}

/** What a person should know about a table: shown in the catalog, search and diagrams. */
export interface TableAbout {
  comment?: string;
  model?: TableModel;
}

export interface DuckDbWasmEngine extends Engine {
  /** The DuckDB schema this source's tables live in. */
  readonly schema: string;
  /** Adds a Parquet file (bytes) as a table of this source. */
  registerParquet(name: string, bytes: Uint8Array, about?: TableAbout): Promise<void>;
  /** Adds a file a person brought (Parquet, CSV or JSON bytes) as a table of this source. The bytes stay in this browser. */
  registerFile(name: string, bytes: Uint8Array, format: FileFormat, about?: TableAbout): Promise<void>;
  /** Records a table's description, keys and column notes, for tables made by `runStatements`. */
  describeAs(name: string, about: TableAbout): Promise<void>;
  /**
   * Runs generator statements (CREATE TABLE … AS …) inside this source's
   * schema. This is the one write path, kept apart from `execute`, which
   * only reads. Use it for seed SQL a person chose to run in their own browser.
   */
  runStatements(statements: string[]): Promise<void>;
  /** Drops every table of this source. */
  clear(): Promise<void>;
}

export interface DuckDbWasmEngineOptions {
  bindings: DuckDbWasmBindings;
  /** A connection id of its own: the engine sets its default schema on it. */
  connection: number;
  /** DuckDB schema for this source, letters, digits and underscores. */
  schema: string;
}

/** An Engine over one schema of a DuckDB-wasm database. */
export async function createDuckDbWasmEngine(options: DuckDbWasmEngineOptions): Promise<DuckDbWasmEngine> {
  const { bindings: db, connection: conn, schema } = options;
  if (!NAME.test(schema)) throw new Error(`Schema names use letters, digits and underscores: ${schema}`);
  const info = new Map<string, WasmTableInfo>();
  // The worker runs one request at a time per connection; this keeps statements that belong together in order.
  let queue: Promise<unknown> = Promise.resolve();
  const serial = <T>(run: () => Promise<T>): Promise<T> => {
    const next = queue.then(run, run);
    queue = next.catch(() => undefined);
    return next;
  };
  const raw = async (sql: string) => tableFromIPC(await db.runQuery(conn, sql));
  const READERS: Record<FileFormat, string> = { parquet: "read_parquet", csv: "read_csv_auto", json: "read_json_auto" };
  const register = (name: string, bytes: Uint8Array, format: FileFormat, about: TableAbout) =>
    serial(async () => {
      if (!NAME.test(name)) throw new EngineError("UNSUPPORTED", `Table names use letters, digits and underscores: ${name}`);
      if (!(format in READERS)) throw new EngineError("UNSUPPORTED", `Files are read as Parquet, CSV or JSON, not ${format}.`);
      const file = `${schema}__${name}.${format}`;
      await db.registerFileBuffer(file, bytes);
      try {
        await raw(`CREATE OR REPLACE VIEW ${ident(name)} AS SELECT * FROM ${READERS[format]}(${text(file)})`);
        // Reading one row now reports a file that cannot be read here, not at the first query.
        await raw(`SELECT * FROM ${ident(name)} LIMIT 1`);
      } catch (error) {
        await raw(`DROP VIEW IF EXISTS ${ident(name)}`).catch(() => undefined);
        throw engineError(error);
      }
      if (about.comment) await raw(`COMMENT ON VIEW ${ident(name)} IS ${text(about.comment)}`);
      info.set(name.toLowerCase(), { name, comment: about.comment, model: about.model, location: file, format });
    });
  const rows =async (sql: string) => (await raw(sql)).toArray().map((r) => r.toJSON() as Record<string, unknown>);
  const prepared = async (sql: string, params: Param[]) => {
    if (params.length === 0) return tableFromIPC(await db.runQuery(conn, sql));
    const statement = await db.createPrepared(conn, sql);
    try {
      return tableFromIPC(await db.runPrepared(conn, statement, params.map(bindable)));
    } finally {
      await db.closePrepared(conn, statement);
    }
  };

  await raw("SET errors_as_json = true");
  await raw(`CREATE SCHEMA IF NOT EXISTS ${ident(schema)}`);
  await raw(`CREATE SCHEMA IF NOT EXISTS ${ident(RESULTS)}`);
  await raw(`USE ${ident(CATALOG)}.${ident(schema)}`);
  // Dates and times are handled in UTC, as on the server.
  await raw("SET TimeZone = 'UTC'");

  const guard = (sql: string) => {
    assertReadOnly(sql, SqlDialect.DUCKDB);
    if (SECRET_FUNCTIONS.test(sql)) throw new EngineError("UNSUPPORTED", "Queries cannot read connection secrets.");
  };
  const tableNames = () =>
    rows(`SELECT table_name AS t, 'TABLE' AS k, comment AS c FROM duckdb_tables() WHERE schema_name = ${text(schema)} AND NOT temporary UNION ALL SELECT view_name, 'VIEW', comment FROM duckdb_views() WHERE schema_name = ${text(schema)} AND NOT internal ORDER BY 1`);
  const lookup = async (ref: TableRef | undefined) => {
    const wanted = (ref?.table ?? "").toLowerCase();
    const found = (await tableNames()).find((r) => String(r.t).toLowerCase() === wanted);
    if (!found) throw new EngineError("UNKNOWN_TABLE", `Table not found: ${ref?.table ?? ""}`);
    return String(found.t);
  };

  return {
    kind: EngineKind.DUCKDB,
    dialect: SqlDialect.DUCKDB,
    schema,
    capabilities: { cancel: true, explain: true, explainJson: true, timeTravel: false, keysetPaging: false, storedResults: true, exactCount: true, columnStats: false },

    execute: (sql, params, executeOptions = {}) =>
      serial(async () => {
        guard(sql);
        if (executeOptions.timeTravel) throw new EngineError("UNSUPPORTED", "Time travel is not available in the browser engine.");
        if (executeOptions.signal?.aborted) throw new EngineError("CANCELLED", "The query was cancelled.");
        const onAbort = () => void db.cancelPendingQuery(conn);
        executeOptions.signal?.addEventListener("abort", onAbort, { once: true });
        try {
          const table = await prepared(sql, params);
          async function* batches(): AsyncGenerator<RecordBatch> {
            yield* table.batches;
          }
          return { schema: table.schema, batches: batches() };
        } catch (error) {
          throw executeOptions.signal?.aborted ? new EngineError("CANCELLED", "The query was cancelled.") : engineError(error);
        } finally {
          executeOptions.signal?.removeEventListener("abort", onAbort);
        }
      }),

    explain: (sql, params) =>
      serial(async () => {
        guard(sql);
        try {
          const value = (t: Awaited<ReturnType<typeof prepared>>) => t.toArray().map((r) => String((r.toJSON() as Record<string, unknown>).explain_value ?? "")).join("\n");
          return { planText: value(await prepared(`EXPLAIN ${sql}`, params)), planJson: value(await prepared(`EXPLAIN (FORMAT JSON) ${sql}`, params)) };
        } catch (error) {
          throw engineError(error, "EXPLAIN ".length);
        }
      }),

    store: (sql: string, params: Param[], storeOptions: StoreOptions): Promise<StoredRelation> =>
      serial(async () => {
        guard(sql);
        const relation = `${ident(RESULTS)}.${ident(`r_${schema}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`)}`;
        try {
          // One row past the limit shows whether the result was cut short.
          const created = await prepared(`CREATE TABLE ${relation} AS SELECT * FROM (${sql}) AS "_sf" LIMIT ${storeOptions.maxRows + 1}`, params);
          const rowCount = Number((created.toArray()[0]?.toJSON() as { Count?: number | bigint } | undefined)?.Count ?? 0);
          return { relation, rowCount: Math.min(rowCount, storeOptions.maxRows), complete: rowCount <= storeOptions.maxRows };
        } catch (error) {
          throw engineError(error);
        }
      }),

    dropStored: (relation) =>
      serial(async () => {
        if (!relation.startsWith(`${ident(RESULTS)}."r_${schema}_`)) return;
        await raw(`DROP TABLE IF EXISTS ${relation}`);
      }),

    listCatalogs: async () => [{ name: CATALOG }],
    listSchemas: async (catalog) => (catalog === "" || catalog === CATALOG ? [{ catalog: CATALOG, name: schema }] : []),

    listTables: ({ catalog, schema: wanted, search }) =>
      serial(async () => {
        if ((catalog && catalog !== CATALOG) || (wanted && wanted !== schema)) return [];
        const needle = search.toLowerCase();
        return (await tableNames())
          .filter((r) => String(r.t).toLowerCase().includes(needle))
          .map((r) => {
            const known = info.get(String(r.t).toLowerCase());
            return {
              ref: { catalog: CATALOG, schema, table: String(r.t) },
              kind: known?.format === "parquet" ? TableKind.EXTERNAL : r.k === "VIEW" ? TableKind.VIEW : TableKind.TABLE,
              format: known?.format === "parquet" ? TableFormat.PARQUET : TableFormat.UNSPECIFIED,
              comment: known?.comment ?? String(r.c ?? ""),
            };
          });
      }),

    describeTable: (ref, includeStats) =>
      serial(async () => {
        try {
          const name = await lookup(ref);
          const described = await rows(`DESCRIBE ${ident(name)}`);
          const arrow = (await raw(`SELECT * FROM ${ident(name)} LIMIT 0`)).schema;
          const count = includeStats ? (await rows(`SELECT COUNT(*) AS n FROM ${ident(name)}`))[0]?.n : undefined;
          const known = info.get(name.toLowerCase());
          return withTableModel({
            summary: {
              ref: { catalog: CATALOG, schema, table: name },
              kind: known?.format === "parquet" ? TableKind.EXTERNAL : TableKind.TABLE,
              format: known?.format === "parquet" ? TableFormat.PARQUET : TableFormat.UNSPECIFIED,
              comment: known?.comment ?? "",
            },
            columns: described.map((column, i) => ({
              name: String(column.column_name),
              nativeType: String(column.column_type),
              arrowType: String(arrow.fields[i]?.type ?? ""),
              nullable: column.null !== "NO",
              ordinal: i + 1,
            })),
            rowCount: count === undefined ? undefined : BigInt(count as bigint | number),
            location: known?.location ?? "",
            properties: { format: known?.format ?? "generated" },
          }, known?.model);
        } catch (error) {
          throw engineError(error);
        }
      }),

    listSnapshots: async () => [],

    registerParquet: (name, bytes, about = {}) => register(name, bytes, "parquet", about),
    registerFile: (name, bytes, format, about = {}) => register(name, bytes, format, about),

    describeAs: (name, about) =>
      serial(async () => {
        const known = info.get(name.toLowerCase());
        info.set(name.toLowerCase(), { ...known, name: known?.name ?? name, format: known?.format ?? "generated", ...(about.comment ? { comment: about.comment } : {}), ...(about.model ? { model: about.model } : {}) });
      }),

    runStatements: (statements) =>
      serial(async () => {
        try {
          for (const statement of statements) await raw(statement);
        } catch (error) {
          throw engineError(error);
        }
      }),

    clear: () =>
      serial(async () => {
        await raw(`DROP SCHEMA IF EXISTS ${ident(schema)} CASCADE`);
        await raw(`CREATE SCHEMA ${ident(schema)}`);
        await raw(`USE ${ident(CATALOG)}.${ident(schema)}`);
        info.clear();
      }),

    version: async () => String(await db.getVersion()),
    close: async () => {},
  };
}
