import { type Engine, type EngineCheck, EngineError, type EngineResult, type ExecuteOptions, type Param } from "@surfaces-ui/engine";
import { ConnectionKind, Engine as EngineKind, SqlDialect, TableFormat, TableKind, type TableRef } from "@surfaces-ui/proto";
import { SqlError, assertReadOnly, blankLiterals, initSql } from "@surfaces-ui/sql";
import type { RecordBatch } from "apache-arrow";
import { arrowResult } from "./arrow.js";
import { type TeradataClient, type TeradataResult, quoteName } from "./client.js";
import { type QueryServiceOptions, queryServiceClient } from "./query-service.js";
import { columnType, nativeType } from "./types.js";

export * from "./client.js";
export * from "./driver.js";
export * from "./errors.js";
export * from "./query-service.js";
export { type ColumnType, type DictionaryColumn, type Family, columnType, nativeType } from "./types.js";
export { arrowResult } from "./arrow.js";

interface Shared {
  /**
   * Default database. Names written without a database resolve here, and a
   * table listing that names no database covers this one only.
   */
  database?: string;
  /**
   * The databases a table listing covers when it names none, and so the ones
   * search and agent context are built from. Defaults to the default database.
   */
  databases?: string[];
  /** Most databases or tables one listing returns when the caller sets no page size. Default 1000. */
  maxListed?: number;
  /** Rows in one Arrow batch. Default 4096. */
  batchRows?: number;
}

export type TeradataEngineOptions =
  | (Shared & {
      /** Your own transport: `driverClient(...)`, or anything that implements `TeradataClient`. */
      client: TeradataClient;
      /** Shown as where this source connects, e.g. the host name. Never a credential. */
      address?: string;
    })
  | (Shared & Omit<QueryServiceOptions, "database"> & { client?: undefined; transport?: "query-service" });

/** A label for the one level above databases, which Teradata does not have. */
const CATALOG = "teradata";
/** `DBC.TablesV.TableKind` values that can be read with SELECT. */
const KINDS: Record<string, TableKind> = { T: TableKind.TABLE, O: TableKind.TABLE, Q: TableKind.TABLE, V: TableKind.VIEW, "1": TableKind.EXTERNAL };
const READABLE = Object.keys(KINDS)
  .map((kind) => `'${kind}'`)
  .join(", ");
/** How many tables of one database are described, and how close together, before its dictionary is read whole; and how long that is kept. */
const DICTIONARY_AFTER = 3;
const DICTIONARY_WINDOW_MS = 5_000;
const DICTIONARY_KEPT_MS = 300_000;

interface Dictionary {
  tables: Map<string, { database: string; table: string; kind: string; comment: string }>;
  columns: Map<string, unknown[][]>;
  indexes: Map<string, unknown[][]>;
}

/** Databases that hold the system's own objects, left out of a listing that names no database. */
const SYSTEM = ["dbc", "syslib", "sysudtlib", "sysbar", "sysjdbc", "sysspatial", "systemfe", "sysadmin", "sys_calendar", "td_sysfnlib", "td_sysxml", "td_sysgpl", "td_server_db", "tdstats", "tdqcd", "tdmaps", "sqlj", "locklogshredder", "dbcmngr", "crashdumps", "external_ap", "tdwm", "tdpuser"];

/**
 * Table operators and clauses that reach outside the database from inside a
 * SELECT, where the read-only check cannot follow: WRITE_NOS writes files to
 * an object store, SCRIPT runs a program on the database nodes, and
 * FOREIGN TABLE hands a statement to another system.
 */
const OUTSIDE = /\b(WRITE_NOS|SCRIPT)\s*\(|\bFOREIGN\s+TABLE\s*\(/i;

const trimmed = (value: unknown) => (value === null || value === undefined ? "" : String(value).trim());
const count = (value: unknown) => (value === null || value === undefined || value === "" ? undefined : Number(value));
const likeText = (search: string) => `%${search.toLowerCase().replace(/[\\%_]/g, (ch) => `\\${ch}`)}%`;

/**
 * Teradata behind the Engine interface.
 *
 * It only reads. Every statement a caller passes must be a single SELECT or
 * WITH (checked here as well as by the server), values are bound to `?`
 * placeholders by the transport and never written into a statement, and
 * there is no `store` or `materialize`: views of a query run it again and
 * pipelines cannot use this engine. Teradata has no read-only session, so
 * the database user should hold SELECT rights only.
 *
 * The catalog comes from the data dictionary: databases from
 * `DBC.DatabasesV`, tables and views from `DBC.TablesV`, columns from
 * `DBC.ColumnsV` and the primary index from `DBC.IndicesV`. Listings are
 * searched, ordered and cut to a page by Teradata, never read whole.
 *
 * The session is set to UTC with a query band naming the application (see
 * `sessionStatements`). Teradata gives no character position for an error,
 * and tables cannot be read as of an earlier time.
 */
export async function createTeradataEngine(options: TeradataEngineOptions): Promise<Engine> {
  await initSql();
  let client: TeradataClient;
  let connection: { name: string; scope: string; secret: string };
  if (options.client) {
    client = options.client;
    connection = { name: "teradata", scope: options.address ?? "", secret: "" };
  } else {
    if (!options.baseUrl || !options.system) throw new EngineError("UNSUPPORTED", "A Teradata source needs the address of Teradata Query Service (baseUrl) and a system name.");
    if (!options.secret) throw new EngineError("UNSUPPORTED", "A Teradata source needs the name of a secret that holds its password or token.");
    client = queryServiceClient({ ...options, database: options.database });
    connection = { name: options.system, scope: options.baseUrl, secret: options.secret };
  }
  const database = options.database ?? "";
  const listed = (options.databases?.length ? options.databases : database ? [database] : []).map((name) => name.trim().toLowerCase()).filter(Boolean);
  const maxListed = Math.max(1, Math.floor(options.maxListed ?? 1000));
  const batchRows = Math.max(1, Math.floor(options.batchRows ?? 4096));

  /** Refuses anything that is not one read-only query, whoever the caller is. */
  const guard = (sql: string) => {
    try {
      assertReadOnly(sql, SqlDialect.TERADATA);
    } catch (error) {
      if (error instanceof SqlError) throw new EngineError("UNSUPPORTED", error.message, error.code);
      throw error;
    }
    if (OUTSIDE.test(blankLiterals(sql))) throw new EngineError("UNSUPPORTED", "Queries cannot write files, run scripts or send SQL to another system.");
  };

  /** A statement this adapter wrote itself (catalog queries); values are still bound. */
  const ask = (sql: string, params: unknown[] = [], signal?: AbortSignal): Promise<TeradataResult> => client.query(sql, params, { signal });

  /** Finds a table's exact names, so later queries can compare them as they are stored. */
  const find = async (ref: TableRef | undefined): Promise<{ database: string; table: string; kind: string; comment: string }> => {
    const table = ref?.table ?? "";
    const within = ref?.schema || database;
    if (!table) throw new EngineError("UNKNOWN_TABLE", "Table not found: no name was given.");
    const found = await ask(
      `SELECT TOP 2 DatabaseName, TableName, TableKind, CommentString FROM DBC.TablesV WHERE LOWER(TableName) = ?${within ? " AND LOWER(DatabaseName) = ?" : ""} AND TableKind IN (${READABLE}) ORDER BY DatabaseName, TableName`,
      within ? [table.toLowerCase(), within.toLowerCase()] : [table.toLowerCase()],
    );
    if (found.rows.length === 0) throw new EngineError("UNKNOWN_TABLE", `Table not found: ${within ? `${within}.` : ""}${table}`);
    if (found.rows.length > 1 && !within) throw new EngineError("UNKNOWN_TABLE", `More than one table is called ${table}. Say which database it is in.`);
    const [d, t, k, c] = found.rows[0]!;
    return { database: trimmed(d), table: trimmed(t), kind: trimmed(k), comment: trimmed(c) };
  };

  /**
   * One database's dictionary, read whole. Describing many tables of one
   * database (building a search index) would otherwise ask three questions
   * per table over a session that runs one request at a time. It is read only
   * once several tables of the same database have been described in quick
   * succession, kept briefly, and given up on for a database too large to read.
   */
  const recent = new Map<string, number[]>();
  const dictionaries = new Map<string, { at: number; loaded: Promise<Dictionary | undefined> }>();
  const dictionaryOf = (name: string): Promise<Dictionary | undefined> => {
    const key = name.toLowerCase();
    const now = Date.now();
    const kept = dictionaries.get(key);
    // Kept from when it finished loading (a large database takes a while), or while it is still loading.
    if (kept && (kept.at === 0 || now - kept.at < DICTIONARY_KEPT_MS)) return kept.loaded;
    const asked = [...(recent.get(key) ?? []).filter((at) => now - at < DICTIONARY_WINDOW_MS), now];
    recent.set(key, asked);
    if (asked.length < DICTIONARY_AFTER) return Promise.resolve(undefined);
    const loaded = (async (): Promise<Dictionary | undefined> => {
      try {
        const [tables, columns, indexes] = [
          await ask(`SELECT DatabaseName, TableName, TableKind, CommentString FROM DBC.TablesV WHERE LOWER(DatabaseName) = ? AND TableKind IN (${READABLE})`, [key]),
          await ask("SELECT TableName, ColumnName, ColumnType, ColumnLength, DecimalTotalDigits, DecimalFractionalDigits, CharType, Nullable, CommentString FROM DBC.ColumnsV WHERE LOWER(DatabaseName) = ? ORDER BY TableName, ColumnId", [key]),
          await ask("SELECT TableName, ColumnName, IndexType, UniqueFlag FROM DBC.IndicesV WHERE LOWER(DatabaseName) = ? AND IndexType IN ('P', 'Q') ORDER BY TableName, ColumnPosition", [key]),
        ];
        const byTable = (rows: unknown[][]) => {
          const out = new Map<string, unknown[][]>();
          for (const [table, ...rest] of rows) {
            const at = trimmed(table).toLowerCase();
            out.set(at, [...(out.get(at) ?? []), rest]);
          }
          return out;
        };
        return {
          tables: new Map(tables.rows.map(([d, t, k, c]) => [trimmed(t).toLowerCase(), { database: trimmed(d), table: trimmed(t), kind: trimmed(k), comment: trimmed(c) }])),
          columns: byTable(columns.rows),
          indexes: byTable(indexes.rows),
        };
      } catch {
        // Too large to read at once, or not allowed: each table is asked for on its own.
        return undefined;
      }
    })();
    const entry = { at: 0, loaded };
    dictionaries.set(key, entry);
    void loaded.then(() => {
      entry.at = Date.now();
    });
    return loaded;
  };

  return {
    kind: EngineKind.TERADATA,
    dialect: SqlDialect.TERADATA,
    capabilities: { cancel: true, explain: true, explainJson: false, timeTravel: false, keysetPaging: false, exactCount: true, columnStats: false },
    connections: [{ name: connection.name, kind: ConnectionKind.HTTP, scope: connection.scope, credentialsSecret: connection.secret }],
    pagesTables: true,

    async execute(sql: string, params: Param[], executeOptions: ExecuteOptions = {}): Promise<EngineResult> {
      if (executeOptions.timeTravel?.at.case) throw new EngineError("UNSUPPORTED", "This source cannot read tables as of an earlier time.");
      guard(sql);
      const signal = executeOptions.signal;
      const result = await client.query(sql, params, { signal });
      if (result.truncated) throw new EngineError("UNSUPPORTED", `The result has more than ${result.rows.length.toLocaleString("en")} rows, which is the most this source returns at once. Add a filter, or group the rows.`);
      const arrow = arrowResult(result);
      async function* batches(): AsyncGenerator<RecordBatch> {
        for (let at = 0; at < result.rows.length; at += batchRows) {
          if (signal?.aborted) throw new EngineError("CANCELLED", "The query was cancelled.");
          yield arrow.batch(result.rows.slice(at, at + batchRows));
        }
      }
      return { schema: arrow.schema, batches: batches() };
    },

    async explain(sql, params) {
      guard(sql);
      // EXPLAIN describes the plan without running the query; each row is a line of it.
      const plan = await client.query(`EXPLAIN ${sql}`, params);
      return { planText: plan.rows.map((row) => String(row[0] ?? "").trimEnd()).join("\n"), planJson: "" };
    },

    async check(): Promise<EngineCheck[]> {
      const targets = [
        { name: "Session", sql: "SELECT 1" },
        { name: "Data dictionary (DBC)", sql: "SELECT TOP 1 DatabaseName FROM DBC.DatabasesV" },
        ...(database ? [{ name: `Database ${database}`, sql: "SELECT TOP 1 DatabaseName FROM DBC.DatabasesV WHERE LOWER(DatabaseName) = ?", params: [database.toLowerCase()], needsRow: true }] : []),
      ];
      const checks: EngineCheck[] = [];
      for (const target of targets) {
        const started = Date.now();
        try {
          const found = await ask(target.sql, "params" in target ? target.params : []);
          const ok = !("needsRow" in target) || found.rows.length > 0;
          checks.push({ name: target.name, ok, message: ok ? "Reachable" : "This user cannot see it, or it does not exist.", elapsedMs: Date.now() - started });
        } catch (error) {
          checks.push({ name: target.name, ok: false, message: error instanceof Error ? error.message : String(error), elapsedMs: Date.now() - started });
        }
      }
      return checks;
    },

    listCatalogs: async () => [{ name: CATALOG }],

    async listSchemas() {
      const found = await ask(`SELECT TOP ${maxListed} DatabaseName, CommentString FROM DBC.DatabasesV ORDER BY DatabaseName`);
      return found.rows.map(([name, comment]) => ({ catalog: CATALOG, name: trimmed(name), comment: trimmed(comment) }));
    },

    async listTables({ schema, search, limit, offset }) {
      const within = schema ? [schema.toLowerCase()] : listed;
      const where = [`TableKind IN (${READABLE})`];
      const params: string[] = [];
      if (within.length > 0) {
        where.push(within.length === 1 ? "LOWER(DatabaseName) = ?" : `LOWER(DatabaseName) IN (${within.map(() => "?").join(", ")})`);
        params.push(...within);
      } else {
        where.push(`LOWER(DatabaseName) NOT IN (${SYSTEM.map((name) => `'${name}'`).join(", ")})`);
      }
      if (search) {
        where.push("LOWER(TableName) LIKE ? ESCAPE '\\'");
        params.push(likeText(search));
      }
      // The page is cut by Teradata: TOP for the first, ROW_NUMBER after it (there is no LIMIT or OFFSET).
      const size = Math.min(maxListed + 1, limit && limit > 0 ? Math.floor(limit) : maxListed);
      const skip = Math.max(0, Math.floor(offset ?? 0));
      const order = "DatabaseName, TableName";
      const sql =
        skip === 0
          ? `SELECT TOP ${size} DatabaseName, TableName, TableKind, CommentString FROM DBC.TablesV WHERE ${where.join(" AND ")} ORDER BY ${order}`
          : `SELECT DatabaseName, TableName, TableKind, CommentString FROM DBC.TablesV WHERE ${where.join(" AND ")} QUALIFY ROW_NUMBER() OVER (ORDER BY ${order}) BETWEEN ${skip + 1} AND ${skip + size} ORDER BY ${order}`;
      const found = await ask(sql, params);
      return found.rows.map(([d, t, k, c]) => ({
        // No catalog: a qualified name on Teradata is database.table.
        ref: { catalog: "", schema: trimmed(d), table: trimmed(t) },
        kind: KINDS[trimmed(k)] ?? TableKind.TABLE,
        format: TableFormat.NATIVE,
        comment: trimmed(c),
      }));
    },

    async describeTable(ref, includeStats) {
      const within = ref?.schema || database;
      const dictionary = within && ref?.table ? await dictionaryOf(within) : undefined;
      const known = dictionary?.tables.get((ref?.table ?? "").toLowerCase());
      const table = known ?? (await find(ref));
      const named = [table.database, table.table];
      const qualified = `${quoteName(table.database)}.${quoteName(table.table)}`;
      const [columns, indexes] =
        dictionary && known
          ? [{ rows: dictionary.columns.get(known.table.toLowerCase()) ?? [] }, { rows: dictionary.indexes.get(known.table.toLowerCase()) ?? [] }]
          : await Promise.all([
              ask("SELECT ColumnName, ColumnType, ColumnLength, DecimalTotalDigits, DecimalFractionalDigits, CharType, Nullable, CommentString FROM DBC.ColumnsV WHERE DatabaseName = ? AND TableName = ? ORDER BY ColumnId", named),
              ask("SELECT ColumnName, IndexType, UniqueFlag FROM DBC.IndicesV WHERE DatabaseName = ? AND TableName = ? AND IndexType IN ('P', 'Q') ORDER BY ColumnPosition", named),
            ]);
      // The dictionary holds no types for a view's columns; the view itself says them, without reading a row.
      const untyped = columns.rows.length === 0 || columns.rows.some((row) => trimmed(row[1]) === "");
      const shape = untyped ? await ask(`SELECT * FROM ${qualified} WHERE 1 = 0`) : undefined;
      const shapeType = new Map(shape?.columns.map((c) => [c.name.toLowerCase(), c.type.trim()]));
      const primary = new Set(indexes.rows.map((row) => trimmed(row[0]).toLowerCase()));
      const comments = new Map(columns.rows.map((row) => [trimmed(row[0]).toLowerCase(), row]));
      const listed = shape && shape.columns.length > 0 ? shape.columns.map((c) => c.name) : columns.rows.map((row) => trimmed(row[0]));
      const counted = includeStats ? (await ask(`SELECT CAST(COUNT(*) AS BIGINT) FROM ${qualified}`)).rows[0]?.[0] : undefined;
      const index = indexes.rows[0];
      return {
        summary: { ref: { catalog: "", schema: table.database, table: table.table }, kind: KINDS[table.kind] ?? TableKind.TABLE, format: TableFormat.NATIVE, comment: table.comment },
        columns: listed.map((name, i) => {
          const row = comments.get(name.toLowerCase());
          const code = trimmed(row?.[1]);
          const native = code
            ? nativeType({ code, length: count(row?.[2]), digits: count(row?.[3]), fraction: count(row?.[4]), charType: count(row?.[5]) })
            : (shapeType.get(name.toLowerCase()) ?? "");
          return {
            name,
            nativeType: native,
            arrowType: native ? String(columnType(native).arrow) : "",
            nullable: trimmed(row?.[6]).toUpperCase() !== "N",
            comment: trimmed(row?.[7]),
            ordinal: i + 1,
            // Teradata's primary index decides where rows are stored; it is what a primary key is elsewhere.
            primaryKey: primary.has(name.toLowerCase()),
          };
        }),
        rowCount: counted === undefined || counted === null ? undefined : BigInt(counted as number | bigint | string),
        properties: {
          tableKind: table.kind,
          ...(index
            ? {
                primaryIndex: indexes.rows.map((row) => trimmed(row[0])).join(", "),
                primaryIndexKind: `${trimmed(index[2]).toUpperCase() === "Y" ? "unique" : "non-unique"}${trimmed(index[1]).toUpperCase() === "Q" ? ", partitioned" : ""}`,
              }
            : {}),
        },
      };
    },

    listSnapshots: async () => [],

    async version() {
      const found = await ask("SELECT InfoData FROM DBC.DBCInfoV WHERE InfoKey = 'VERSION'");
      const version = trimmed(found.rows[0]?.[0]);
      return version ? `Teradata ${version}` : "Teradata";
    },

    close: async () => {
      await client.close?.();
    },
  };
}
