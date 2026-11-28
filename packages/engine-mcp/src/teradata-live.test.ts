import { Table } from "apache-arrow";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { type McpSql, createMcpEngine, mcpSql } from "./index.js";
import { stdioServer } from "./node.js";

/**
 * Runs the Teradata path against a real Teradata system through the real
 * Teradata MCP server. It needs both, so it runs only when told how to start
 * the server, as a JSON list of the command and its arguments, with the
 * connection in the environment the server reads it from:
 *
 *   read -rs TD_PASSWORD        # typed, not echoed, and not kept in the shell's history
 *   DATABASE_URI="teradata://USER:$TD_PASSWORD@HOST:1025/DATABASE" \
 *   SURFACES_TEST_MCP_TERADATA='["uvx","teradata-mcp-server"]' \
 *   pnpm --filter @surfaces-ui/engine-mcp exec vitest run src/teradata-live.test.ts
 *
 * It reads only the dictionary (`DBC`) and constants, so it needs no table
 * of its own and prints no row of anyone's data. What it prints is the shape
 * of the server's answers, which is what the stand-in in engine.test.ts was
 * written from the server's source to imitate: paste it back if a test fails.
 */
const command = process.env.SURFACES_TEST_MCP_TERADATA;
const kinds = (row: unknown[]) => row.map((value) => (value === null ? "null" : typeof value));

describe.skipIf(!command)("Teradata through the Teradata MCP server, live", () => {
  let sql: McpSql;
  const transport = () => {
    const [program, ...args] = JSON.parse(command!) as string[];
    const pass = ["DATABASE_URI", "PROFILE", ...(process.env.SURFACES_TEST_MCP_ENV ?? "").split(",").filter(Boolean)];
    return stdioServer(program!, args, { env: pass });
  };

  beforeAll(() => {
    sql = mcpSql({ transport: transport(), arguments: { row_limit: 50_000 }, timeoutMs: 120_000 });
  });
  afterAll(() => sql?.close());

  it("finds the query tool, and the server names each column's type", async () => {
    const found = await sql.describe();
    console.log("server:", found.server, "| query tool:", found.tool, "| argument:", found.argument, "| tools:", found.tools.length);
    expect(found).toMatchObject({ tool: "base_readQuery", argument: "sql" });

    const constants = await sql.query("SELECT 1 AS whole, CAST(12.50 AS DECIMAL(10,2)) AS amount, CAST('2026-01-02' AS DATE FORMAT 'YYYY-MM-DD') AS day_of, CAST('2026-01-02 03:04:05' AS TIMESTAMP(0)) AS at_time, 'text' AS word, CAST(NULL AS INTEGER) AS nothing, CAST(9007199254740993 AS BIGINT) AS big");
    console.log("columns as the server names them:", JSON.stringify(constants.columns));
    console.log("value kinds:", JSON.stringify(kinds(constants.rows[0] ?? [])), "| values (constants):", JSON.stringify(constants.rows[0]));
    expect(constants.columns.map((c) => c.name.toLowerCase())).toEqual(["whole", "amount", "day_of", "at_time", "word", "nothing", "big"]);
    expect(constants.columns.map((c) => c.type)).toEqual(["int", "Decimal", "date", "datetime", "str", expect.anything(), "int"]);
    expect(constants.truncated).toBe(false);
  });

  it("says when it cut a result short, and still names the columns of a result with no rows", async () => {
    const short = mcpSql({ transport: transport(), arguments: { row_limit: 2 }, timeoutMs: 120_000 });
    try {
      const cut = await short.query("SELECT TOP 5 TableName FROM DBC.TablesV");
      console.log("with row_limit 2 of 5 rows: rows", cut.rows.length, "| truncated:", cut.truncated);
      expect(cut.rows.length).toBeLessThanOrEqual(2);
      expect(cut.truncated).toBe(true);
    } finally {
      await short.close();
    }
    const empty = await sql.query("SELECT DatabaseName, TableName FROM DBC.TablesV WHERE 1 = 0");
    console.log("no rows: columns", JSON.stringify(empty.columns));
    expect(empty.rows).toEqual([]);
    expect(empty.columns.map((c) => c.name)).toEqual(["DatabaseName", "TableName"]);
  });

  it("reports a failed query as the database's error, with its code", async () => {
    const failure = await sql.query("SELECT nope FROM DBC.DBCInfoV").then(
      () => undefined,
      (error: { code?: string; message?: string }) => error,
    );
    console.log("unknown column:", failure?.code, "|", failure?.message);
    expect(failure?.code).toBe("UNKNOWN_COLUMN");
    const missing = await sql.query("SELECT * FROM DBC.NoSuchTableHere").then(
      () => undefined,
      (error: { code?: string; message?: string }) => error,
    );
    console.log("unknown table:", missing?.code, "|", missing?.message);
    expect(missing?.code).toBe("UNKNOWN_TABLE");
  });

  it("works as an engine: the catalog, a typed result, and a value that tries to end the statement", async () => {
    const engine = await createMcpEngine({ dialect: "teradata", transport: transport(), databases: ["DBC"], timeoutMs: 120_000 });
    try {
      console.log("version:", await engine.version());
      const tables = await engine.listTables({ catalog: "", schema: "DBC", search: "TablesV", limit: 5, offset: 0 });
      console.log("tables matching TablesV in DBC:", tables.map((t) => t.ref?.table));
      expect(tables.map((t) => t.ref?.table)).toContain("TablesV");
      const detail = await engine.describeTable({ $typeName: "surfaces.v1.TableRef", catalog: "", schema: "DBC", table: "DBCInfoV" }, false);
      console.log("DBC.DBCInfoV columns:", detail.columns?.map((c) => `${c.name}:${c.nativeType}`));
      expect(detail.columns?.length).toBeGreaterThan(0);

      const result = await engine.execute("SELECT TOP 3 DatabaseName, TableName, CreateTimeStamp FROM DBC.TablesV WHERE TableKind = ? ORDER BY 1, 2", ["V"]);
      const batches = [];
      for await (const batch of result.batches) batches.push(batch);
      console.log("typed result:", result.schema.fields.map((f) => `${f.name}:${f.type}`).join(", "), "| rows:", new Table(result.schema, batches).numRows);
      expect(String(result.schema.fields[2]!.type)).toMatch(/^Timestamp/);

      const hostile = await engine.execute("SELECT COUNT(*) AS n FROM DBC.TablesV WHERE TableName = ?", ["x'; DROP TABLE nothing; --"]);
      const counted = [];
      for await (const batch of hostile.batches) counted.push(batch);
      expect(Number(new Table(hostile.schema, counted).get(0)!.toJSON().n)).toBe(0);
      await expect(engine.execute("DELETE FROM DBC.TablesV", [])).rejects.toThrow();
    } finally {
      await engine.close();
    }
  });
});
