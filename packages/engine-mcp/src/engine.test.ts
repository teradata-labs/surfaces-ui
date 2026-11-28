import { InMemoryTransport, McpServer } from "@modelcontextprotocol/server";
import { SqlDialect } from "@surfaces-ui/proto";
import { initSql } from "@surfaces-ui/sql";
import { Table } from "apache-arrow";
import { beforeAll, describe, expect, it } from "vitest";
import { z } from "zod";
import { databaseError } from "./client.js";
import { paging } from "./engine.js";
import { createMcpEngine, findQueryTool, inlineParams, literal, pythonLiteral, readRows, standardType, toolError, typeOfValues } from "./index.js";

const text = (value: string) => ({ content: [{ type: "text" as const, text: value }] });

describe("readRows", () => {
  // Each answer below is the shape the named server really returns; the Postgres, MySQL and DuckDB ones were captured from the servers running against a database.
  it("reads a list of row objects (the reference Postgres server)", () => {
    const rows = readRows(text('[\n  {\n    "order_id": "1",\n    "status": "pending",\n    "amount": "79.19",\n    "note": null\n  }\n]'));
    expect(rows).toEqual({ columns: [{ name: "order_id" }, { name: "status" }, { name: "amount" }, { name: "note" }], rows: [["1", "pending", "79.19", null]], truncated: false });
    expect(readRows(text("[]"))).toEqual({ columns: [], rows: [], truncated: false });
  });

  it("reads rows followed by a note in a second block (a MySQL server)", () => {
    const answer = { content: [{ type: "text", text: '[{"status":null,"total":"2498950.00","n":5000}]' }, { type: "text", text: "Query execution time: 11.74 ms" }] };
    expect(readRows(answer).rows).toEqual([[null, "2498950.00", 5000]]);
    expect(readRows({ content: [{ type: "text", text: "[]" }, { type: "text", text: "Query execution time: 0.70 ms" }] }).rows).toEqual([]);
  });

  it("reads columns, their types and rows as lists (the DuckDB server), and that it was cut short", () => {
    const rows = readRows(text(JSON.stringify({ success: true, columns: ["order_id", "amount"], columnTypes: ["BIGINT", "DECIMAL(12,2)"], rows: [[1, "79.19"]], rowCount: 1 })));
    expect(rows).toEqual({ columns: [{ name: "order_id", type: "BIGINT" }, { name: "amount", type: "DECIMAL(12,2)" }], rows: [[1, "79.19"]], truncated: false });
    const empty = readRows(text(JSON.stringify({ success: true, columns: ["order_id"], columnTypes: ["BIGINT"], rows: [], rowCount: 0 })));
    expect(empty.columns).toEqual([{ name: "order_id", type: "BIGINT" }]);
    expect(readRows(text(JSON.stringify({ success: true, columns: ["a"], columnTypes: ["INTEGER"], rows: [[1]], truncated: true }))).truncated).toBe(true);
  });

  it("reads the Teradata server's envelope, with the types it names", () => {
    const envelope = { status: "success", results: [{ Region: "Europe", Total: 12.5 }], metadata: { tool_name: "base_readQuery", columns: [{ name: "Region", type: "str" }, { name: "Total", type: "Decimal" }], row_count: 1, truncated: true, row_limit: 1 } };
    expect(readRows(text(JSON.stringify(envelope, null, 2)))).toEqual({ columns: [{ name: "Region", type: "str" }, { name: "Total", type: "Decimal" }], rows: [["Europe", 12.5]], truncated: true });
  });

  it("reads one row per block, rows inside prose, structured content and a Python literal", () => {
    expect(readRows({ content: [{ type: "text", text: '{"a":1,"b":"x"}' }, { type: "text", text: '{"a":2,"b":"y"}' }] }).rows).toEqual([[1, "x"], [2, "y"]]);
    const fenced = { result: 'Below is the result. <untrusted-data-7f3a>\n[{"n": 3}]\n</untrusted-data-7f3a>\nUse this data carefully.' };
    expect(readRows(text(JSON.stringify(fenced))).rows).toEqual([[3]]);
    expect(readRows({ content: [], structuredContent: { result: [{ n: 4 }] } }).rows).toEqual([[4]]);
    expect(readRows(text("[{'status': 'it''s', 'total': Decimal('2500050.00'), 'day': datetime.date(2026, 1, 2), 'note': None, 'ok': True}]".replace("it''s", "it\\'s"))).rows).toEqual([["it's", "2500050.00", "2026-01-02", null, true]]);
    expect(readRows(text("No results")).rows).toEqual([]);
    expect(() => readRows(text("The weather is fine."))).toThrow(/not rows/);
  });

  it("finds a failure however the server reports it", () => {
    expect(toolError({ isError: true, content: [{ type: "text", text: 'Error calling tool \'execute_query\': {\n  "success": false,\n  "error": "Binder Error: Referenced column \\"nope\\" not found",\n  "errorType": "BinderException"\n}' }] })).toMatch(/Referenced column/);
    expect(toolError({ isError: true, content: [{ type: "text", text: "Error: Unknown column 'nope' in 'SELECT'" }] })).toBe("Unknown column 'nope' in 'SELECT'");
    expect(toolError(text("Error: relation does not exist"))).toBe("relation does not exist");
    expect(toolError(text(JSON.stringify({ status: "error", message: "[Error 3807] Object 'x' does not exist." })))).toMatch(/3807/);
    expect(toolError(text('[{"a":1}]'))).toBeUndefined();
  });
});

describe("pythonLiteral", () => {
  it("reads values and never evaluates", () => {
    expect(pythonLiteral("[(1, 'a'), {'k': [1.5, -2, None, False]}]")).toEqual([[1, "a"], { k: [1.5, -2, null, false] }]);
    expect(pythonLiteral("datetime.datetime(2026, 1, 2, 3, 4, 5, tzinfo=datetime.timezone.utc)")).toBe("2026-01-02T03:04:05.000000Z");
    expect(pythonLiteral("__import__('os').system('true')")).not.toBe(0);
    expect(pythonLiteral("[1, 2")).toBeUndefined();
  });
});

describe("values written into a statement", () => {
  it("cannot end the text they are in, in any dialect", () => {
    const hostile = "x'; DROP TABLE t; -- \\";
    expect(literal(hostile, SqlDialect.DUCKDB)).toBe("'x''; DROP TABLE t; -- \\'");
    expect(literal(hostile, SqlDialect.TERADATA)).toBe("'x''; DROP TABLE t; -- \\'");
    expect(literal(hostile, SqlDialect.POSTGRES)).toBe(`$v$${hostile}$v$`);
    // A value that holds the tag gets a longer one, so it still cannot close the quote.
    expect(literal("a $v$ b $vv$", SqlDialect.POSTGRES)).toBe("$vvv$a $v$ b $vv$$vvv$");
    // MySQL reads a backslash as an escape, so its text is sent as hexadecimal and decoded by the database.
    expect(literal("a'\\", SqlDialect.MYSQL)).toBe("CONVERT(X'61275c' USING utf8mb4)");
    expect(literal(12.5, SqlDialect.POSTGRES)).toBe("12.5");
    expect(literal(10n, SqlDialect.DUCKDB)).toBe("10");
    expect(literal(true, SqlDialect.TERADATA)).toBe("1");
    expect(() => literal(Number.NaN, SqlDialect.DUCKDB)).toThrow(/finite/);
    expect(() => literal("a\0b", SqlDialect.POSTGRES)).toThrow();
  });

  it("go where the placeholders are, and nowhere else", () => {
    expect(inlineParams("SELECT '?' AS q, a FROM t WHERE a = ? AND b > ? -- ?", ["x", 3], SqlDialect.DUCKDB)).toBe("SELECT '?' AS q, a FROM t WHERE a = 'x' AND b > 3 -- ?");
    expect(inlineParams("SELECT '$1' FROM t WHERE a = $2 AND b = $1", ["x", 3], SqlDialect.POSTGRES)).toBe("SELECT '$1' FROM t WHERE a = 3 AND b = $v$x$v$");
    // In MySQL a backslash keeps the string open, so the question mark after it is still text.
    expect(inlineParams("SELECT 'a\\' ?' AS q, `b?` FROM t WHERE a = ? # ?", [3], SqlDialect.MYSQL)).toBe("SELECT 'a\\' ?' AS q, `b?` FROM t WHERE a = 3 # ?");
    expect(() => inlineParams("SELECT ? , ?", ["x"], SqlDialect.DUCKDB)).toThrow(/not given/);
    expect(() => inlineParams("SELECT ?", ["x", "y"], SqlDialect.DUCKDB)).toThrow(/more values/);
  });
});

describe("findQueryTool", () => {
  const tool = (name: string, ...args: string[]) => ({ name, inputSchema: { properties: Object.fromEntries(args.map((a) => [a, { type: "string" }])) } });
  it("picks the tool that takes SQL, preferring a read-only one, without needing the argument to be marked required", () => {
    expect(findQueryTool([tool("base_tableList", "database_name"), tool("base_readQuery", "sql", "persist", "row_limit")])).toEqual({ tool: "base_readQuery", argument: "sql" });
    expect(findQueryTool([tool("execute_sql", "query"), tool("execute_sql_read_only", "query"), tool("poll_sql_result", "statement_id")])).toEqual({ tool: "execute_sql_read_only", argument: "query" });
    expect(findQueryTool([tool("run_snowflake_query", "statement")])).toEqual({ tool: "run_snowflake_query", argument: "statement" });
    expect(findQueryTool([tool("SQL_Execution_Tool", "sql")])).toEqual({ tool: "SQL_Execution_Tool", argument: "sql" });
    expect(findQueryTool([tool("a", "x"), tool("named", "text")], { tool: "named", argument: "text" })).toEqual({ tool: "named", argument: "text" });
    expect(() => findQueryTool([tool("read_records", "entity")])).toThrow(/no tool that takes SQL/);
    expect(() => findQueryTool([tool("query", "sql")], { tool: "missing" })).toThrow(/no tool named missing/);
  });
});

describe("text from elsewhere is read without patterns that can stall", () => {
  it("takes the page off the end of a statement, and says whether it had a limit", () => {
    expect(paging("SELECT a FROM t ORDER BY a LIMIT 25 OFFSET 50")).toEqual({ base: "SELECT a FROM t ORDER BY a", limited: true });
    expect(paging("SELECT a FROM t limit 10  ")).toEqual({ base: "SELECT a FROM t", limited: true });
    expect(paging("SELECT a FROM t OFFSET 5")).toEqual({ base: "SELECT a FROM t", limited: false });
    expect(paging("SELECT ' LIMIT 5' AS x FROM t")).toEqual({ base: "SELECT ' LIMIT 5' AS x FROM t", limited: false });
    expect(paging("SELECT a FROM t LIMIT 5 FOR UPDATE")).toEqual({ base: "SELECT a FROM t LIMIT 5 FOR UPDATE", limited: false });
  });

  it("names a database's error by its words, in the forms each database uses", () => {
    expect(databaseError('column "nope" does not exist').code).toBe("UNKNOWN_COLUMN");
    expect(databaseError("Unknown column 'nope' in 'SELECT'").code).toBe("UNKNOWN_COLUMN");
    expect(databaseError('Binder Error: Referenced column "nope" not found in FROM clause!').code).toBe("UNKNOWN_COLUMN");
    expect(databaseError("[Error 3810] Column/Parameter 'nope' does not exist.").code).toBe("UNKNOWN_COLUMN");
    expect(databaseError('relation "sales.nope" does not exist').code).toBe("UNKNOWN_TABLE");
    expect(databaseError("Table 'sales.nope' doesn't exist").code).toBe("UNKNOWN_TABLE");
    expect(databaseError("Catalog Error: Table with name nope does not exist!").code).toBe("UNKNOWN_TABLE");
    expect(databaseError("[Error 3807] Object 'x' does not exist.").code).toBe("UNKNOWN_TABLE");
    expect(databaseError('syntax error at or near "FORM"').code).toBe("SYNTAX");
    expect(databaseError("Request timed out").code).toBe("TIMEOUT");
    expect(databaseError("permission denied for table orders").code).toBe("ENGINE");
  });

  it("stays quick on text built to make a pattern backtrack", () => {
    const started = Date.now();
    const long = " ".repeat(200_000);
    paging(`SELECT 1${long}LIMIT${long}x`);
    standardType(`BIGINT${long}UNSIGNEDX`);
    databaseError(`column ${"a ".repeat(100_000)}`);
    expect(() => readRows({ content: [{ type: "text", text: `<untrusted-data-${"<untrusted-data-".repeat(20_000)}` }] })).toThrow(/not rows/);
    expect(Date.now() - started).toBeLessThan(2000);
  });
});

describe("typeOfValues", () => {
  it("tells whole numbers, decimals, dates and times apart, and reads anything else as text", () => {
    expect([[1, 2, null], [1, 2.5], ["2026-01-02", null], ["2026-01-02 03:04:05", "2026-01-02T03:04:05.123"], ["02139", "10001"], [null], ["2026-01-02", "soon"]].map(typeOfValues)).toEqual(["BIGINT", "FLOAT", "DATE", "TIMESTAMP", "VARCHAR", "VARCHAR", "VARCHAR"]);
  });
});

describe("standardType", () => {
  it("names a database's types as the Arrow builder knows them", () => {
    expect(["boolean", "timestamp without time zone", "numeric", "DECIMAL(12,2)", "HUGEINT", "character varying", "bigint(20) unsigned", "datetime", "smallint(6)"].map(standardType)).toEqual(["BYTEINT", "TIMESTAMP", "FLOAT", "DECIMAL(12,2)", "DECIMAL(38,0)", "CHARACTER VARYING", "BIGINT", "TIMESTAMP", "SMALLINT"]);
  });
});

/**
 * A stand-in for the Teradata MCP server: the tool name, its arguments and
 * the envelope are the real server's (its tool list was read from the real
 * server; its answers are from its source, since no Teradata system was
 * within reach to run it against).
 */
function teradataStandIn() {
  const server = new McpServer({ name: "teradata-mcp-server", version: "0" });
  const seen: { sql: string; row_limit?: number | null; persist?: boolean }[] = [];
  server.registerTool(
    "base_readQuery",
    { description: "Runs a query", inputSchema: { sql: z.string().nullable().default(null), persist: z.boolean().default(false), row_limit: z.number().int().nullable().default(null) }, annotations: { readOnlyHint: true } },
    async (input) => {
      seen.push(input as (typeof seen)[number]);
      const sql = String(input.sql);
      if (/nope/i.test(sql)) throw new Error("(teradatasql.OperationalError) [Error 3810] Column/Parameter 'nope' does not exist.\n at gosqldriver/teradatasql.formatError");
      const envelope = (results: Record<string, unknown>[], columns: { name: string; type: string }[], more = {}) => text(JSON.stringify({ status: "success", results, metadata: { tool_name: "base_readQuery", sql, columns, row_count: results.length, ...more } }, null, 2));
      if (/huge/i.test(sql)) return envelope([{ n: 1 }], [{ name: "n", type: "int" }], { truncated: true, row_limit: 1 });
      return envelope(
        [{ region: "Europe", total: 1250.5, ordered: "2026-01-02", at: "2026-01-02T03:04:05", n: 3 }, { region: "O'Hare", total: 7, ordered: "2026-01-03", at: "2026-01-03T00:00:00", n: null }],
        [{ name: "region", type: "str" }, { name: "total", type: "Decimal" }, { name: "ordered", type: "date" }, { name: "at", type: "datetime" }, { name: "n", type: "int" }],
      );
    },
  );
  server.registerTool("base_tableList", { description: "Lists tables", inputSchema: { database_name: z.string().default("") } }, async () => text("{}"));
  const [a, b] = InMemoryTransport.createLinkedPair();
  void server.connect(a);
  return { transport: () => b, seen };
}

describe("Teradata through its MCP server", () => {
  beforeAll(() => initSql());

  it("sends Teradata SQL with values written in, never asks the server to keep a table, and reads the types it names", async () => {
    const server = teradataStandIn();
    const engine = await createMcpEngine({ dialect: "teradata", transport: server.transport });
    expect(engine.dialect).toBe(SqlDialect.TERADATA);
    const result = await engine.execute("SELECT TOP 2 region, total FROM sales WHERE region = ? AND total > ?", ["O'Hare", 5]);
    const batches = [];
    for await (const batch of result.batches) batches.push(batch);
    const table = new Table(result.schema, batches);
    expect(result.schema.fields.map((f) => `${f.name}:${f.type}`)).toEqual(["region:Utf8", "total:Float64", "ordered:Date32<DAY>", "at:Timestamp<MICROSECOND>", "n:Int64"]);
    expect(table.numRows).toBe(2);
    expect(table.get(0)!.toJSON()).toMatchObject({ region: "Europe", total: 1250.5, n: 3n });
    expect(table.get(1)!.toJSON().n).toBeNull();
    const sent = server.seen.at(-1)!;
    expect(sent.sql).toBe("SELECT TOP 2 region, total FROM sales WHERE region = 'O''Hare' AND total > 5");
    expect(sent.persist).toBe(false);
    expect(sent.row_limit).toBe(50_000);
    await engine.close();
  });

  it("reports the database's error by its code, and a result the server cut short as an error", async () => {
    const engine = await createMcpEngine({ dialect: "teradata", transport: teradataStandIn().transport });
    await expect(engine.execute("SELECT nope FROM sales", [])).rejects.toMatchObject({ code: "UNKNOWN_COLUMN", message: expect.not.stringContaining("gosqldriver") });
    await expect(engine.execute("SELECT * FROM huge", [])).rejects.toThrow();
    await expect(engine.execute("DELETE FROM sales", [])).rejects.toThrow();
    await engine.close();
  });
});

describe("a server that cannot be used", () => {
  it("says what the server lists when it has no SQL tool, and does not repeat how it was reached when it cannot be", async () => {
    const server = new McpServer({ name: "entities", version: "0" });
    server.registerTool("read_records", { description: "Reads", inputSchema: { entity: z.string() } }, async () => text("{}"));
    const [a, b] = InMemoryTransport.createLinkedPair();
    void server.connect(a);
    const engine = await createMcpEngine({ dialect: "postgres", transport: () => b });
    await expect(engine.execute("SELECT 1", [])).rejects.toThrow(/no tool that takes SQL.*read_records/);
    const unreachable = await createMcpEngine({ dialect: "postgres", transport: () => Promise.reject(new Error("spawn uvx postgresql://reader:secret@host/db ENOENT")) });
    await expect(unreachable.execute("SELECT 1", [])).rejects.toThrow(/could not be reached/);
    await expect(unreachable.execute("SELECT 1", [])).rejects.not.toThrow(/secret/);
    expect((await unreachable.check!())[0]).toMatchObject({ ok: false });
  });
});
