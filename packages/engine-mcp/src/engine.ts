import { type Engine, type EngineCheck, EngineError, type EngineResult, type ExecuteOptions, type Param } from "@surfaces-ui/engine";
import { type TeradataClient, arrowResult, columnType, createTeradataEngine } from "@surfaces-ui/engine-teradata";
import { ConnectionKind, Engine as EngineKind, SqlDialect, TableKind, type TableRef } from "@surfaces-ui/proto";
import type { RecordBatch } from "apache-arrow";
import { type McpSql, type McpSqlOptions, mcpSql } from "./client.js";
import { inlineParams, literal } from "./literal.js";
import type { SqlColumn, SqlRows } from "./parse.js";

export interface McpEngineOptions extends McpSqlOptions {
  /** The database behind the server, which decides the SQL that is written for it. */
  dialect: "postgres" | "duckdb" | "teradata";
  /** Shown as where this source connects, such as the server's address. Never a credential. */
  address?: string;
  /** Teradata: the default database, and the databases a listing covers when none is named. */
  database?: string;
  databases?: string[];
  /** Rows in one Arrow batch. Default 4096. */
  batchRows?: number;
}

const SYSTEM_SCHEMAS = "('information_schema', 'pg_catalog', 'pg_toast')";
const quoted = (name: string) => `"${name.replace(/"/g, '""')}"`;
const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);

/** A database's type name as one the Arrow builder knows. Anything else arrives as text. */
export function standardType(native: string): string {
  const text = native.trim().toUpperCase();
  const base = text.replace(/\(.*?\)/g, "").replace(/\s+/g, " ").trim();
  if (base === "BOOLEAN" || base === "BOOL" || base === "TINYINT") return "BYTEINT";
  if (base === "INT2") return "SMALLINT";
  if (base === "INT4" || base === "USMALLINT") return "INTEGER";
  if (base === "INT8" || base === "UINTEGER") return "BIGINT";
  if (base === "HUGEINT" || base === "UBIGINT" || base === "UHUGEINT") return "DECIMAL(38,0)";
  if (base === "TIMESTAMP WITHOUT TIME ZONE" || base === "DATETIME" || /^TIMESTAMP_(S|MS|NS)$/.test(base)) return "TIMESTAMP";
  if (base === "TIMESTAMPTZ") return "TIMESTAMP WITH TIME ZONE";
  // Postgres says "numeric" without its precision, so the scale is not known and the column is a float.
  if (base === "NUMERIC" && !text.includes("(")) return "FLOAT";
  if (base === "FLOAT4" || base === "FLOAT8") return "FLOAT";
  if (base === "BYTEA") return "VARBYTE";
  return text;
}

/** The names Python gives the values the Teradata server read, as Teradata type names. */
const PYTHON_TYPES: Record<string, string> = { int: "BIGINT", float: "FLOAT", Decimal: "FLOAT", str: "VARCHAR", date: "DATE", datetime: "TIMESTAMP(6)", bool: "BYTEINT", bytes: "VARBYTE", bytearray: "VARBYTE" };

/**
 * The Teradata MCP server as a transport for the Teradata engine, so the
 * catalog, types and checks are the ones that engine already has. The
 * server takes no bound values, so they are written into the statement as
 * checked literals. It owns the session: the time zone and default database
 * are whatever its own connection has.
 */
export function teradataMcpClient(sql: McpSql): TeradataClient {
  return {
    async query(text, params, options) {
      const result = await sql.query(inlineParams(text, params as Param[], SqlDialect.TERADATA), options);
      return { columns: result.columns.map((c) => ({ name: c.name, type: PYTHON_TYPES[c.type ?? ""] ?? "" })), rows: result.rows, truncated: result.truncated };
    },
    close: () => sql.close(),
  };
}

/**
 * A database reached through its own MCP server, behind the Engine
 * interface. Every sort, filter, page and total is SQL sent through the
 * server's query tool; rows come back as that tool's answer and never pass
 * through a model.
 *
 * It only reads: there is no `store` or `materialize`, so views of a query
 * run it again and pipelines cannot use this engine. A query cannot be
 * cancelled once sent, and there is no time travel. A result the server cut
 * short is an error, never a short result, so raise the server's row limit
 * for a large export.
 */
export async function createMcpEngine(options: McpEngineOptions): Promise<Engine> {
  if (options.dialect === "teradata") {
    // The Teradata server stops at 1,000 rows unless asked; 50,000 is the most it gives.
    const sql = mcpSql({ ...options, arguments: { row_limit: 50_000, ...options.arguments } });
    return createTeradataEngine({ client: teradataMcpClient(sql), database: options.database, databases: options.databases, address: options.address });
  }
  const postgres = options.dialect === "postgres";
  const dialect = postgres ? SqlDialect.POSTGRES : SqlDialect.DUCKDB;
  const sql = mcpSql(options);
  const batchRows = Math.max(1, Math.floor(options.batchRows ?? 4096));
  const text = (value: string) => literal(value, dialect);

  const complete = (rows: SqlRows): SqlRows => {
    if (rows.truncated) throw new EngineError("UNSUPPORTED", "The data server cut this result short. Ask for fewer rows at a time, or raise the server's row limit.");
    return rows;
  };

  /** Postgres: each row as one JSON object, so a number is a number and text is text whatever driver the server uses. */
  const jsonRows = async (query: string, signal?: AbortSignal): Promise<Record<string, unknown>[]> => {
    const answer = complete(await sql.query(`SELECT row_to_json(t) AS r FROM (${query}) AS t`, { signal }));
    return answer.rows.map((row) => {
      const value = row[0];
      const parsed: unknown = typeof value === "string" ? JSON.parse(value) : value;
      if (!isRecord(parsed)) throw new EngineError("ENGINE", "The data server answered in a form that is not rows.");
      return parsed;
    });
  };

  /**
   * Postgres: a result's column names and types without running the query.
   * Joined to one row on a condition that is never true, the query is never
   * executed, yet its columns are there to name and to ask the type of.
   */
  const described = new Map<string, SqlColumn[]>();
  const describe = async (query: string, names?: string[]): Promise<SqlColumn[]> => {
    const key = query.replace(/\s+(LIMIT\s+\d+)?(\s+OFFSET\s+\d+)?\s*$/i, "");
    const known = described.get(key);
    if (known) return known;
    const never = `FROM (SELECT 1) AS o LEFT JOIN (${query}) AS q ON false`;
    const found = names ?? Object.keys((await jsonRows(`SELECT q.* ${never}`))[0] ?? {});
    if (found.length === 0) return [];
    const types = (await jsonRows(`SELECT ${found.map((name) => `pg_typeof(q.${quoted(name)})::text AS ${quoted(name)}`).join(", ")} ${never}`))[0] ?? {};
    const columns = found.map((name) => ({ name, type: String(types[name] ?? "") }));
    if (described.size > 200) described.clear();
    described.set(key, columns);
    return columns;
  };

  /** Runs a statement and gives its rows with each column's type. */
  const run = async (query: string, signal?: AbortSignal): Promise<{ columns: SqlColumn[]; rows: unknown[][] }> => {
    if (!postgres) return complete(await sql.query(query, { signal }));
    const objects = await jsonRows(query, signal);
    const columns = await describe(query, objects[0] ? Object.keys(objects[0]) : undefined);
    return { columns, rows: objects.map((row) => columns.map((c) => row[c.name] ?? null)) };
  };
  const objectsOf = async (query: string): Promise<Record<string, unknown>[]> => {
    const { columns, rows } = await run(query);
    return rows.map((row) => Object.fromEntries(columns.map((c, i) => [c.name.toLowerCase(), row[i]])));
  };

  const schemaFilter = (schema: string) => (schema ? `table_schema = ${text(schema)}` : `table_schema NOT IN ${SYSTEM_SCHEMAS}`);
  const find = async (ref: TableRef | undefined) => {
    const table = ref?.table ?? "";
    const rows = await objectsOf(
      `SELECT table_schema, table_name, table_type FROM information_schema.tables WHERE lower(table_name) = lower(${text(table)}) AND ${schemaFilter(ref?.schema ?? "")} ORDER BY table_schema`,
    );
    if (!rows[0]) throw new EngineError("UNKNOWN_TABLE", `Table not found: ${table}`);
    return { schema: String(rows[0].table_schema), table: String(rows[0].table_name), view: /VIEW/i.test(String(rows[0].table_type)) };
  };

  return {
    kind: postgres ? EngineKind.POSTGRES : EngineKind.DUCKDB,
    dialect,
    capabilities: { cancel: false, explain: true, explainJson: false, timeTravel: false, keysetPaging: false, exactCount: true, columnStats: false },
    connections: [{ name: options.dialect, kind: ConnectionKind.HTTP, scope: options.address ?? "" }],

    async execute(query: string, params: Param[], executeOptions: ExecuteOptions = {}): Promise<EngineResult> {
      if (executeOptions.timeTravel?.at.case) throw new EngineError("UNSUPPORTED", "This source cannot read tables as of an earlier time.");
      const result = await run(inlineParams(query, params, dialect), executeOptions.signal);
      const arrow = arrowResult({ columns: result.columns.map((c) => ({ name: c.name, type: c.type ? standardType(c.type) : "" })), rows: result.rows });
      async function* batches(): AsyncGenerator<RecordBatch> {
        for (let at = 0; at < result.rows.length; at += batchRows) yield arrow.batch(result.rows.slice(at, at + batchRows));
      }
      return { schema: arrow.schema, batches: batches() };
    },

    async explain(query, params) {
      const plan = complete(await sql.query(`EXPLAIN ${inlineParams(query, params, dialect)}`));
      return { planText: plan.rows.map((row) => String(row[row.length - 1] ?? "")).join("\n"), planJson: "" };
    },

    async check(): Promise<EngineCheck[]> {
      const started = Date.now();
      try {
        const { tool, server } = await sql.describe();
        await sql.query("SELECT 1 AS ok");
        return [{ name: server || options.dialect, ok: true, message: `Reachable through the tool ${tool}`, elapsedMs: Date.now() - started }];
      } catch (error) {
        return [{ name: options.dialect, ok: false, message: error instanceof Error ? error.message : String(error), elapsedMs: Date.now() - started }];
      }
    },

    async listCatalogs() {
      const rows = await objectsOf("SELECT current_database() AS name");
      return [{ name: String(rows[0]?.name ?? options.dialect) }];
    },

    async listSchemas(catalog) {
      const rows = await objectsOf(`SELECT DISTINCT table_schema AS name FROM information_schema.tables WHERE table_schema NOT IN ${SYSTEM_SCHEMAS} ORDER BY 1`);
      return rows.map((row) => ({ catalog, name: String(row.name) }));
    },

    async listTables({ schema, search }) {
      const like = search ? ` AND lower(table_name) LIKE ${text(`%${search.toLowerCase().replace(/[\\%_]/g, "\\$&")}%`)} ESCAPE ${text("\\")}` : "";
      const rows = await objectsOf(
        `SELECT table_schema, table_name, table_type FROM information_schema.tables WHERE ${schemaFilter(schema)}${like} ORDER BY table_schema, table_name LIMIT 1000`,
      );
      return rows.map((row) => ({ ref: { catalog: "", schema: String(row.table_schema), table: String(row.table_name) }, kind: /VIEW/i.test(String(row.table_type)) ? TableKind.VIEW : TableKind.TABLE }));
    },

    async describeTable(ref, includeStats) {
      const found = await find(ref);
      const at = `table_schema = ${text(found.schema)} AND table_name = ${text(found.table)}`;
      const columns = await objectsOf(`SELECT column_name, data_type, is_nullable, ordinal_position FROM information_schema.columns WHERE ${at} ORDER BY ordinal_position`);
      // Keys and comments are extras: a database or a login that will not give them leaves them out, it does not fail the description.
      const optional = async (query: string) => objectsOf(query).catch(() => []);
      const keys = await optional(
        postgres
          ? // pg_catalog, because information_schema shows a table's constraints only to a role that owns it or may write to it.
            `SELECT a.attname AS column_name FROM pg_constraint con JOIN pg_class c ON c.oid = con.conrelid JOIN pg_namespace n ON n.oid = c.relnamespace JOIN pg_attribute a ON a.attrelid = c.oid AND a.attnum = ANY (con.conkey) WHERE con.contype = 'p' AND n.nspname = ${text(found.schema)} AND c.relname = ${text(found.table)}`
          : `SELECT kcu.column_name FROM information_schema.table_constraints tc JOIN information_schema.key_column_usage kcu ON kcu.constraint_name = tc.constraint_name AND kcu.table_schema = tc.table_schema AND kcu.table_name = tc.table_name WHERE tc.constraint_type = 'PRIMARY KEY' AND tc.table_schema = ${text(found.schema)} AND tc.table_name = ${text(found.table)}`,
      );
      const primary = new Set(keys.map((row) => String(row.column_name)));
      const comments = postgres
        ? await optional(
            `SELECT a.attname AS column_name, col_description(c.oid, a.attnum) AS comment, obj_description(c.oid) AS table_comment FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace JOIN pg_attribute a ON a.attrelid = c.oid AND a.attnum > 0 AND NOT a.attisdropped WHERE n.nspname = ${text(found.schema)} AND c.relname = ${text(found.table)}`,
          )
        : [];
      const comment = new Map(comments.map((row) => [String(row.column_name), row.comment ? String(row.comment) : ""]));
      const references = postgres
        ? await optional(
            `SELECT con.conname AS name, a.attname AS column_name, fn.nspname AS ref_schema, fc.relname AS ref_table, fa.attname AS ref_column, k.ord FROM pg_constraint con JOIN pg_class c ON c.oid = con.conrelid JOIN pg_namespace n ON n.oid = c.relnamespace JOIN pg_class fc ON fc.oid = con.confrelid JOIN pg_namespace fn ON fn.oid = fc.relnamespace CROSS JOIN LATERAL unnest(con.conkey, con.confkey) WITH ORDINALITY AS k(col, fcol, ord) JOIN pg_attribute a ON a.attrelid = c.oid AND a.attnum = k.col JOIN pg_attribute fa ON fa.attrelid = fc.oid AND fa.attnum = k.fcol WHERE con.contype = 'f' AND n.nspname = ${text(found.schema)} AND c.relname = ${text(found.table)} ORDER BY con.conname, k.ord`,
          )
        : [];
      const foreign = new Map<string, { columns: string[]; references: { catalog: string; schema: string; table: string }; referencedColumns: string[] }>();
      for (const row of references) {
        const key = foreign.get(String(row.name)) ?? { columns: [], references: { catalog: "", schema: String(row.ref_schema), table: String(row.ref_table) }, referencedColumns: [] };
        key.columns.push(String(row.column_name));
        key.referencedColumns.push(String(row.ref_column));
        foreign.set(String(row.name), key);
      }
      const counted = includeStats ? (await objectsOf(`SELECT COUNT(*) AS n FROM ${quoted(found.schema)}.${quoted(found.table)}`))[0]?.n : undefined;
      return {
        summary: { ref: { catalog: "", schema: found.schema, table: found.table }, kind: found.view ? TableKind.VIEW : TableKind.TABLE, comment: comments[0]?.table_comment ? String(comments[0].table_comment) : "" },
        columns: columns.map((row, i) => {
          const native = String(row.data_type);
          return { name: String(row.column_name), nativeType: native, arrowType: String(columnType(standardType(native)).arrow), nullable: String(row.is_nullable).toUpperCase() !== "NO", ordinal: Number(row.ordinal_position ?? i + 1), primaryKey: primary.has(String(row.column_name)), comment: comment.get(String(row.column_name)) ?? "" };
        }),
        rowCount: counted === undefined || counted === null ? undefined : BigInt(counted as number | string | bigint),
        foreignKeys: [...foreign.values()],
      };
    },

    listSnapshots: async () => [],
    async version() {
      const rows = await objectsOf(postgres ? "SELECT current_setting('server_version') AS v" : "SELECT version() AS v");
      const { server } = await sql.describe();
      return `${postgres ? "PostgreSQL" : "DuckDB"} ${String(rows[0]?.v ?? "")}${server ? ` through ${server}` : ""}`.trim();
    },
    close: () => sql.close(),
  };
}
