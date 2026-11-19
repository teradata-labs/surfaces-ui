import { type Engine, EngineError } from "@surfaces-ui/engine";
import { Engine as EngineKind, SqlDialect, TableKind, type TableRef } from "@surfaces-ui/proto";
import { type RecordBatch, Table } from "apache-arrow";
import { describe, expect, it } from "vitest";
import { type TeradataClient, type TeradataResult, columnType, createTeradataEngine, driverClient, nativeType, sessionStatements, teradataError } from "./index.js";

interface Call {
  sql: string;
  params: unknown[];
}

/** A transport that answers from a list of rules and records what it was asked. */
function fakeClient(answers: [RegExp, TeradataResult | Error][] = []) {
  const calls: Call[] = [];
  const client: TeradataClient = {
    async query(sql, params) {
      calls.push({ sql, params });
      const answer = answers.find(([pattern]) => pattern.test(sql))?.[1];
      if (answer instanceof Error) throw answer;
      return answer ?? { columns: [], rows: [] };
    },
  };
  return { client, calls };
}

const ref = (schema: string, table: string) => ({ catalog: "", schema, table }) as TableRef;
const tableOf = async (engine: Engine, sql: string, params: (string | number | bigint | boolean)[] = []) => {
  const result = await engine.execute(sql, params);
  const batches: RecordBatch[] = [];
  for await (const batch of result.batches) batches.push(batch);
  return { schema: result.schema, table: new Table(result.schema, batches) };
};

describe("what the engine says it is", () => {
  it("is a read-only Teradata engine with no kept results, pipelines or time travel", async () => {
    const engine = await createTeradataEngine({ client: fakeClient().client, address: "td.example.com" });
    expect(engine.kind).toBe(EngineKind.TERADATA);
    expect(engine.dialect).toBe(SqlDialect.TERADATA);
    expect(engine.capabilities).toMatchObject({ explain: true, explainJson: false, timeTravel: false, columnStats: false });
    expect(engine.store).toBeUndefined();
    expect(engine.materialize).toBeUndefined();
    expect(await engine.listSnapshots(ref("sales", "orders"))).toEqual([]);
    await expect(engine.execute("SELECT 1", [], { timeTravel: { at: { case: "version", value: 1n } } as never })).rejects.toThrow(/earlier time/);
  });

  it("names a secret for its connection, never a value", async () => {
    const engine = await createTeradataEngine({ baseUrl: "https://qs.example.com:1443", system: "prod", user: "reader", secret: "TD", fetch: (async () => new Response("{}")) as typeof fetch });
    expect(engine.connections).toEqual([{ name: "prod", kind: expect.any(Number), scope: "https://qs.example.com:1443", credentialsSecret: "TD" }]);
    await expect(createTeradataEngine({ baseUrl: "https://qs.example.com", system: "", secret: "TD" })).rejects.toThrow(/system name/);
  });
});

describe("catalog", () => {
  const tables: TeradataResult = {
    columns: [],
    rows: [
      ["sales ", "orders", "T", "All orders"],
      ["sales", "orders_v", "V", null],
      ["sales", "s3_orders", "1", ""],
    ],
  };

  it("lists databases from the dictionary, capped by Teradata", async () => {
    const { client, calls } = fakeClient([[/DBC\.DatabasesV/, { columns: [], rows: [["finance", "Ledgers"], ["sales", null]] }]]);
    const engine = await createTeradataEngine({ client, maxListed: 200 });
    expect(await engine.listCatalogs()).toEqual([{ name: "teradata" }]);
    expect(await engine.listSchemas("teradata")).toEqual([
      { catalog: "teradata", name: "finance", comment: "Ledgers" },
      { catalog: "teradata", name: "sales", comment: "" },
    ]);
    expect(calls[0]!.sql).toBe("SELECT TOP 200 DatabaseName, CommentString FROM DBC.DatabasesV ORDER BY DatabaseName");
  });

  it("searches and cuts the first page of tables in SQL, with the values bound", async () => {
    const { client, calls } = fakeClient([[/DBC\.TablesV/, tables]]);
    const engine = await createTeradataEngine({ client });
    const found = await engine.listTables({ catalog: "", schema: "Sales", search: "Ord_%", limit: 51, offset: 0 });
    expect(calls[0]!.sql).toBe(
      "SELECT TOP 51 DatabaseName, TableName, TableKind, CommentString FROM DBC.TablesV WHERE TableKind IN ('1', 'T', 'O', 'Q', 'V') AND LOWER(DatabaseName) = ? AND LOWER(TableName) LIKE ? ESCAPE '\\' ORDER BY DatabaseName, TableName",
    );
    // The search text is a bound value with its wildcards escaped, not part of the statement.
    expect(calls[0]!.params).toEqual(["sales", "%ord\\_\\%%"]);
    expect(found).toEqual([
      { ref: { catalog: "", schema: "sales", table: "orders" }, kind: TableKind.TABLE, format: expect.any(Number), comment: "All orders" },
      { ref: { catalog: "", schema: "sales", table: "orders_v" }, kind: TableKind.VIEW, format: expect.any(Number), comment: "" },
      { ref: { catalog: "", schema: "sales", table: "s3_orders" }, kind: TableKind.EXTERNAL, format: expect.any(Number), comment: "" },
    ]);
  });

  it("cuts later pages with ROW_NUMBER, since Teradata has no OFFSET", async () => {
    const { client, calls } = fakeClient([[/DBC\.TablesV/, tables]]);
    const engine = await createTeradataEngine({ client });
    await engine.listTables({ catalog: "", schema: "sales", search: "", limit: 51, offset: 100 });
    expect(calls[0]!.sql).toBe(
      "SELECT DatabaseName, TableName, TableKind, CommentString FROM DBC.TablesV WHERE TableKind IN ('1', 'T', 'O', 'Q', 'V') AND LOWER(DatabaseName) = ? QUALIFY ROW_NUMBER() OVER (ORDER BY DatabaseName, TableName) BETWEEN 101 AND 151 ORDER BY DatabaseName, TableName",
    );
    expect(calls[0]!.sql).not.toMatch(/LIMIT|OFFSET/);
  });

  it("never lists everything: no page size means the cap, and no database means the default one or no system databases", async () => {
    const scoped = fakeClient([[/DBC\.TablesV/, tables]]);
    await (await createTeradataEngine({ client: scoped.client, database: "Sales", maxListed: 300 })).listTables({ catalog: "", schema: "", search: "" });
    expect(scoped.calls[0]!.sql).toMatch(/^SELECT TOP 300 /);
    expect(scoped.calls[0]!.params).toEqual(["sales"]);

    const open = fakeClient([[/DBC\.TablesV/, tables]]);
    const engine = await createTeradataEngine({ client: open.client });
    await engine.listTables({ catalog: "", schema: "", search: "" });
    expect(open.calls[0]!.sql).toMatch(/^SELECT TOP 1000 /);
    expect(open.calls[0]!.sql).toMatch(/LOWER\(DatabaseName\) NOT IN \('dbc', /);
    // A caller cannot ask for more than the cap in one go either.
    await engine.listTables({ catalog: "", schema: "", search: "", limit: 1_000_000 });
    expect(open.calls[1]!.sql).toMatch(/^SELECT TOP 1001 /);
  });

  it("lists the databases it was given when a listing names none", async () => {
    const { client, calls } = fakeClient([[/DBC\.TablesV/, tables]]);
    const engine = await createTeradataEngine({ client, database: "Scratch", databases: ["Sales", " Finance "] });
    await engine.listTables({ catalog: "", schema: "", search: "" });
    expect(calls[0]!.sql).toMatch(/LOWER\(DatabaseName\) IN \(\?, \?\)/);
    expect(calls[0]!.params).toEqual(["sales", "finance"]);
    // A listing that names a database still covers that one only.
    await engine.listTables({ catalog: "", schema: "Other", search: "" });
    expect(calls[1]!.params).toEqual(["other"]);
  });

  it("reads a database's dictionary whole once several of its tables are described together", async () => {
    const { client, calls } = fakeClient([
      [/SELECT TOP 2 .*DBC\.TablesV/, { columns: [], rows: [["sales", "orders", "T", null]] }],
      [/^SELECT DatabaseName, TableName, TableKind, CommentString FROM DBC\.TablesV/, { columns: [], rows: [["sales", "orders", "T", "All orders"], ["sales", "stores", "T", null]] }],
      [/^SELECT TableName, ColumnName, ColumnType.*DBC\.ColumnsV/, { columns: [], rows: [["orders", "order_id", "I", 4, null, null, null, "N", "Key"], ["stores", "store_id", "I", 4, null, null, null, "N", null], ["stores", "city", "CV", 40, null, null, 1, "Y", null]] }],
      [/^SELECT TableName, ColumnName, IndexType.*DBC\.IndicesV/, { columns: [], rows: [["stores", "store_id", "P", "Y"]] }],
      [/^SELECT ColumnName, ColumnType.*DBC\.ColumnsV/, { columns: [], rows: [["order_id", "I", 4, null, null, null, "N", "Key"]] }],
    ]);
    const engine = await createTeradataEngine({ client });
    await engine.describeTable(ref("sales", "orders"), false);
    await engine.describeTable(ref("sales", "orders"), false);
    const before = calls.length;
    const stores = await engine.describeTable(ref("Sales", "Stores"), false);
    expect(stores.columns!.map((c) => [c.name, c.nativeType, c.primaryKey])).toEqual([["store_id", "INTEGER", true], ["city", "VARCHAR(40)", false]]);
    expect(calls.length - before).toBe(3);
    // Further tables of that database cost nothing more.
    const orders = await engine.describeTable(ref("sales", "orders"), false);
    expect(orders.summary?.comment).toBe("All orders");
    expect(calls.length - before).toBe(3);
  });

  const dictionary: [RegExp, TeradataResult][] = [
    [/FROM DBC\.TablesV/, { columns: [], rows: [["Sales", "Orders", "T", "All orders"]] }],
    [
      /FROM DBC\.ColumnsV/,
      {
        columns: [],
        rows: [
          ["order_id", "I8", 8, null, null, null, "N", "Order number"],
          ["line", "I ", 4, null, null, null, "N", null],
          ["flag", "I1", 1, null, null, null, "Y", null],
          ["small", "I2", 2, null, null, null, "Y", null],
          ["amount", "D ", 8, 18, 2, null, "Y", null],
          ["ratio", "F ", 8, null, null, null, "Y", null],
          ["score", "N ", 18, -128, -128, null, "Y", null],
          ["ordered_on", "DA", 4, null, null, null, "Y", null],
          ["ordered_at", "TS", 26, null, 6, null, "Y", null],
          ["seen_at", "SZ", 32, null, 0, null, "Y", null],
          ["region", "CV", 60, null, null, 2, "Y", null],
          ["code", "CF", 3, null, null, 1, "Y", null],
          ["note", "CO", 2097088000, null, null, 1, "Y", null],
          ["raw", "BV", 16, null, null, null, "Y", null],
          ["opened", "AT", 15, null, 0, null, "Y", null],
          ["lasted", "DS", 20, null, 6, null, "Y", null],
          ["doc", "JN", 16776192, null, null, 1, "Y", null],
          ["odd", "ZZ", 1, null, null, null, "Y", null],
        ],
      },
    ],
    [/FROM DBC\.IndicesV/, { columns: [], rows: [["order_id", "Q", "Y"], ["line", "Q", "Y"]] }],
    [/COUNT\(\*\)/, { columns: [{ name: "n", type: "BIGINT" }], rows: [[5000n]] }],
  ];

  it("describes a table: Teradata's type names, the Arrow types, and the primary index as the key", async () => {
    const { client, calls } = fakeClient(dictionary);
    const engine = await createTeradataEngine({ client });
    const detail = await engine.describeTable(ref("sales", "orders"), true);
    expect(detail.summary).toMatchObject({ ref: { catalog: "", schema: "Sales", table: "Orders" }, kind: TableKind.TABLE, comment: "All orders" });
    expect(detail.columns!.map((c) => [c.name, c.nativeType, c.arrowType])).toEqual([
      ["order_id", "BIGINT", "Int64"],
      ["line", "INTEGER", "Int32"],
      ["flag", "BYTEINT", "Int8"],
      ["small", "SMALLINT", "Int16"],
      ["amount", "DECIMAL(18,2)", String(columnType("DECIMAL(18,2)").arrow)],
      ["ratio", "FLOAT", "Float64"],
      ["score", "NUMBER", "Float64"],
      ["ordered_on", "DATE", String(columnType("DATE").arrow)],
      ["ordered_at", "TIMESTAMP(6)", String(columnType("TIMESTAMP(6)").arrow)],
      ["seen_at", "TIMESTAMP(0) WITH TIME ZONE", String(columnType("TIMESTAMP(0) WITH TIME ZONE").arrow)],
      ["region", "VARCHAR(30)", "Utf8"],
      ["code", "CHAR(3)", "Utf8"],
      ["note", "CLOB", "Utf8"],
      ["raw", "VARBYTE(16)", "Binary"],
      ["opened", "TIME(0)", "Utf8"],
      ["lasted", "INTERVAL DAY TO SECOND", "Utf8"],
      ["doc", "JSON", "Utf8"],
      ["odd", "ZZ", "Utf8"],
    ]);
    expect(String(columnType("DECIMAL(18,2)").arrow)).toMatch(/Decimal/);
    expect(String(columnType("TIMESTAMP(0) WITH TIME ZONE").arrow)).toMatch(/UTC/);
    expect(detail.columns!.filter((c) => c.primaryKey).map((c) => c.name)).toEqual(["order_id", "line"]);
    expect(detail.columns![0]).toMatchObject({ nullable: false, comment: "Order number", ordinal: 1 });
    expect(detail.columns![4]).toMatchObject({ nullable: true, ordinal: 5 });
    expect(detail.rowCount).toBe(5000n);
    expect(detail.properties).toEqual({ tableKind: "T", primaryIndex: "order_id, line", primaryIndexKind: "unique, partitioned" });

    // The table is looked up by lower-cased bound names; later queries use the names as stored.
    expect(calls[0]!.params).toEqual(["orders", "sales"]);
    expect(calls.find((c) => /ColumnsV/.test(c.sql))!.params).toEqual(["Sales", "Orders"]);
    expect(calls.find((c) => /COUNT/.test(c.sql))!.sql).toBe('SELECT CAST(COUNT(*) AS BIGINT) FROM "Sales"."Orders"');
    // No row count unless asked.
    const again = fakeClient(dictionary);
    expect((await (await createTeradataEngine({ client: again.client })).describeTable(ref("sales", "orders"), false)).rowCount).toBeUndefined();
    expect(again.calls.some((c) => /COUNT/.test(c.sql))).toBe(false);
  });

  it("asks a view for its column types, which the dictionary does not hold", async () => {
    const { client, calls } = fakeClient([
      [/FROM DBC\.TablesV/, { columns: [], rows: [["sales", "orders_v", "V", ""]] }],
      [/FROM DBC\.ColumnsV/, { columns: [], rows: [["order_id", null, null, null, null, null, null, "Order number"], ["amount", null, null, null, null, null, null, null]] }],
      [/WHERE 1 = 0/, { columns: [{ name: "order_id", type: "BIGINT" }, { name: "amount", type: "DECIMAL(18,2)" }], rows: [] }],
    ]);
    const detail = await (await createTeradataEngine({ client })).describeTable(ref("sales", "orders_v"), false);
    expect(detail.summary!.kind).toBe(TableKind.VIEW);
    expect(detail.columns!.map((c) => [c.name, c.nativeType, c.comment])).toEqual([
      ["order_id", "BIGINT", "Order number"],
      ["amount", "DECIMAL(18,2)", ""],
    ]);
    expect(calls.at(-1)!.sql).toBe('SELECT * FROM "sales"."orders_v" WHERE 1 = 0');
  });

  it("says when a table is missing or the name fits more than one", async () => {
    const missing = await createTeradataEngine({ client: fakeClient().client });
    await expect(missing.describeTable(ref("sales", "nope"), false)).rejects.toMatchObject({ code: "UNKNOWN_TABLE", message: "Table not found: sales.nope" });
    const twice = fakeClient([[/TablesV/, { columns: [], rows: [["a", "orders", "T", ""], ["b", "orders", "T", ""]] }]]);
    await expect((await createTeradataEngine({ client: twice.client })).describeTable(ref("", "orders"), false)).rejects.toThrow(/which database/);
  });

  it("names types from dictionary codes", () => {
    expect(nativeType({ code: "CV", length: 200, charType: 1 })).toBe("VARCHAR(200)");
    expect(nativeType({ code: "CV", length: 200, charType: 2 })).toBe("VARCHAR(100)");
    expect(nativeType({ code: "D", digits: 38, fraction: 10 })).toBe("DECIMAL(38,10)");
    expect(nativeType({ code: "N", digits: 10, fraction: 2 })).toBe("NUMBER(10,2)");
    expect(nativeType({ code: "TS", fraction: 3 })).toBe("TIMESTAMP(3)");
    expect(nativeType({ code: "PD" })).toBe("PERIOD(DATE)");
    expect(nativeType({ code: "YM" })).toBe("INTERVAL YEAR TO MONTH");
  });

  it("checks the session, the dictionary and the default database", async () => {
    const { client } = fakeClient([
      [/WHERE LOWER\(DatabaseName\)/, { columns: [], rows: [] }],
      [/DatabasesV/, new EngineError("ENGINE", "The user does not have SELECT access to DBC.DatabasesV.", "3523")],
      [/SELECT 1/, { columns: [{ name: "1", type: "BYTEINT" }], rows: [[1]] }],
    ]);
    const checks = await (await createTeradataEngine({ client, database: "sales" })).check!();
    expect(checks.map((c) => [c.name, c.ok])).toEqual([["Session", true], ["Data dictionary (DBC)", false], ["Database sales", false]]);
    expect(checks[1]!.message).toMatch(/SELECT access/);
  });

  it("reports the database version", async () => {
    const { client } = fakeClient([[/DBCInfoV/, { columns: [], rows: [["17.20.03.09"]] }]]);
    expect(await (await createTeradataEngine({ client })).version()).toBe("Teradata 17.20.03.09");
  });
});

describe("running queries", () => {
  it("returns Arrow with the right type for each family", async () => {
    const { client } = fakeClient([
      [
        /FROM t/,
        {
          columns: [
            { name: "tiny", type: "BYTEINT" },
            { name: "small", type: "SMALLINT" },
            { name: "id", type: "INTEGER" },
            { name: "big", type: "BIGINT" },
            { name: "amount", type: "DECIMAL(18,2)" },
            { name: "loose", type: "DECIMAL" },
            { name: "ratio", type: "FLOAT" },
            { name: "day", type: "DATE" },
            { name: "at", type: "TIMESTAMP(6)" },
            { name: "seen", type: "TIMESTAMP(0) WITH TIME ZONE" },
            { name: "name", type: "VARCHAR(30)" },
            { name: "raw", type: "VARBYTE(4)" },
            { name: "opened", type: "TIME(0)" },
          ],
          rows: [
            [1, 2, 3, 9007199254740993n, "12345678901234.56", 1.5, 0.25, "2026-03-01", "2026-03-01 12:30:00.123456", "2026-03-01 12:30:00+05:30", "Zoë", "00ff", "09:00:00"],
            [null, null, null, null, null, null, null, null, null, null, null, null, null],
            [-1, -2, -3, "-4", -0.5, "2", "1E2", 1_772_323_200_000, "2026-03-01T12:30:00Z", "2026-03-01T12:30:00.5-02:00", "", new Uint8Array([1, 2]), "10:00:00"],
          ],
        },
      ],
    ]);
    const engine = await createTeradataEngine({ client });
    const { schema, table } = await tableOf(engine, "SELECT * FROM t");
    expect(schema.fields.map((f) => String(f.type))).toEqual([
      "Int8",
      "Int16",
      "Int32",
      "Int64",
      String(columnType("DECIMAL(18,2)").arrow),
      "Float64",
      "Float64",
      String(columnType("DATE").arrow),
      String(columnType("TIMESTAMP").arrow),
      String(columnType("TIMESTAMP WITH TIME ZONE").arrow),
      "Utf8",
      "Binary",
      "Utf8",
    ]);
    const cell = (name: string, row: number) => table.getChild(name)!.get(row) as unknown;
    expect(table.numRows).toBe(3);
    expect([cell("tiny", 0), cell("small", 0), cell("id", 0)]).toEqual([1, 2, 3]);
    expect([cell("tiny", 2), cell("small", 2), cell("id", 2)]).toEqual([-1, -2, -3]);
    // A BIGINT beyond what a float holds keeps every digit.
    expect(cell("big", 0)).toBe(9007199254740993n);
    expect(cell("big", 2)).toBe(-4n);
    // DECIMAL is exact: the unscaled whole number, with the scale in the type.
    const amount = schema.fields[4]!.type as { scale: number; precision: number };
    expect([amount.precision, amount.scale]).toEqual([18, 2]);
    const unscaled = (value: unknown) => {
      const words = value as Uint32Array;
      return BigInt.asIntN(128, words.reduce((sum, word, i) => sum | (BigInt(word) << BigInt(32 * i)), 0n));
    };
    expect(unscaled(cell("amount", 0))).toBe(1234567890123456n);
    expect(unscaled(cell("amount", 2))).toBe(-50n);
    expect([cell("loose", 0), cell("loose", 2)]).toEqual([1.5, 2]);
    expect([cell("ratio", 0), cell("ratio", 2)]).toEqual([0.25, 100]);
    // Dates and times are UTC.
    const day = Date.UTC(2026, 2, 1);
    expect(Number(cell("day", 0))).toBe(day);
    expect(Number(cell("day", 2))).toBe(day);
    expect(Math.floor(Number(cell("at", 0)))).toBe(Date.UTC(2026, 2, 1, 12, 30, 0, 123));
    expect(Number(cell("at", 2))).toBe(Date.UTC(2026, 2, 1, 12, 30));
    // A stated zone is moved to UTC.
    expect(Number(cell("seen", 0))).toBe(Date.UTC(2026, 2, 1, 7, 0));
    expect(Number(cell("seen", 2))).toBe(Date.UTC(2026, 2, 1, 14, 30, 0, 500));
    expect([cell("name", 0), cell("name", 2)]).toEqual(["Zoë", ""]);
    expect(Array.from(cell("raw", 0) as Uint8Array)).toEqual([0, 255]);
    expect(Array.from(cell("raw", 2) as Uint8Array)).toEqual([1, 2]);
    expect(cell("opened", 0)).toBe("09:00:00");
    for (const field of schema.fields) expect(cell(field.name, 1)).toBeNull();
  });

  it("keeps microseconds in a timestamp", async () => {
    const { client } = fakeClient([[/./, { columns: [{ name: "at", type: "TIMESTAMP(6)" }], rows: [["2026-03-01 12:30:00.123456"]] }]]);
    const { table } = await tableOf(await createTeradataEngine({ client }), "SELECT at FROM t");
    const raw = table.getChild("at")!.data[0]!.values as BigInt64Array;
    expect(raw[0]).toBe(BigInt(Date.UTC(2026, 2, 1, 12, 30)) * 1000n + 123_456n);
  });

  it("goes by the values when a transport names no types, and keeps the columns of an empty result", async () => {
    const { client } = fakeClient([
      [/FROM untyped/, { columns: [{ name: "n", type: "" }, { name: "f", type: "" }, { name: "s", type: "" }, { name: "d", type: "" }], rows: [[null, null, null, null], [7n, 1.5, "x", new Date(Date.UTC(2026, 0, 1))]] }],
      [/FROM empty/, { columns: [{ name: "id", type: "INTEGER" }, { name: "name", type: "VARCHAR(10)" }], rows: [] }],
    ]);
    const engine = await createTeradataEngine({ client });
    expect((await tableOf(engine, "SELECT * FROM untyped")).schema.fields.map((f) => String(f.type))).toEqual(["Int64", "Float64", "Utf8", String(columnType("TIMESTAMP").arrow)]);
    const empty = await tableOf(engine, "SELECT * FROM empty");
    expect(empty.schema.fields.map((f) => `${f.name}:${String(f.type)}`)).toEqual(["id:Int32", "name:Utf8"]);
    expect(empty.table.numRows).toBe(0);
  });

  it("yields batches of the size asked for", async () => {
    const { client } = fakeClient([[/./, { columns: [{ name: "n", type: "INTEGER" }], rows: Array.from({ length: 10 }, (_, i) => [i]) }]]);
    const result = await (await createTeradataEngine({ client, batchRows: 4 })).execute("SELECT n FROM t", []);
    const sizes: number[] = [];
    for await (const batch of result.batches) sizes.push(batch.numRows);
    expect(sizes).toEqual([4, 4, 2]);
  });

  it("passes values to the transport to bind, never into the statement", async () => {
    const { client, calls } = fakeClient();
    const engine = await createTeradataEngine({ client });
    const hostile = "Europe'; DROP TABLE orders; --";
    const sql = 'SELECT TOP 25 * FROM (SELECT * FROM orders) AS "_sf" WHERE "region" = ? AND "amount" >= ?';
    await engine.execute(sql, [hostile, 100]);
    expect(calls).toEqual([{ sql, params: [hostile, 100] }]);
    await engine.explain(sql, [hostile, 100]);
    expect(calls[1]).toEqual({ sql: `EXPLAIN ${sql}`, params: [hostile, 100] });
    expect(calls.every((c) => !c.sql.includes("DROP"))).toBe(true);
  });

  it("accepts what the rewriter writes for Teradata", async () => {
    const { client, calls } = fakeClient();
    const engine = await createTeradataEngine({ client });
    for (const sql of [
      'SELECT "a" FROM (SELECT * FROM orders) AS "_sf" QUALIFY ROW_NUMBER() OVER (ORDER BY "a" ASC) BETWEEN 51 AND 75 ORDER BY "a" ASC',
      'SELECT * FROM (SELECT * FROM orders) AS "_sf" SAMPLE 300',
      'SELECT COUNT(*) AS "row_count" FROM (SELECT * FROM orders) AS "_sf" WHERE "region" = ?',
      "LOCKING ROW FOR ACCESS SELECT * FROM orders",
      "WITH a AS (SELECT 1 AS x) SELECT * FROM a",
      "SEL TOP 5 * FROM orders",
    ]) {
      await engine.execute(sql, sql.includes("?") ? ["Europe"] : []);
    }
    expect(calls).toHaveLength(6);
  });

  it("refuses anything that is not one read-only query, before it reaches Teradata", async () => {
    const { client, calls } = fakeClient();
    const engine = await createTeradataEngine({ client });
    for (const sql of [
      "DROP TABLE orders",
      "DELETE FROM orders",
      "INSERT INTO orders SELECT * FROM orders",
      "UPDATE orders SET amount = 0",
      "CREATE TABLE t AS (SELECT * FROM orders) WITH DATA",
      "CALL sysdba.cleanup()",
      "SELECT 1; DELETE FROM orders",
      "SELECT 1; SELECT 2",
      "COLLECT STATISTICS ON orders COLUMN (region)",
      "SELECT * FROM WRITE_NOS (ON (SELECT * FROM orders) USING LOCATION('/s3/bucket/')) AS d",
      "SELECT * FROM SCRIPT (ON orders SCRIPT_COMMAND('cat') RETURNS ('x VARCHAR(10)')) AS d",
      "SELECT * FROM FOREIGN TABLE (SELECT * FROM other.orders)@remote AS d",
      "",
    ]) {
      await expect(engine.execute(sql, []), sql).rejects.toBeInstanceOf(EngineError);
      await expect(engine.explain(sql, []), sql).rejects.toBeInstanceOf(EngineError);
    }
    expect(calls).toEqual([]);
    // The words are fine as data.
    await engine.execute("SELECT 'DROP TABLE x; WRITE_NOS (' AS note FROM orders", []);
    expect(calls).toHaveLength(1);
  });

  it("returns Teradata's EXPLAIN text, a line a row", async () => {
    const { client } = fakeClient([[/^EXPLAIN /, { columns: [{ name: "Explanation", type: "VARCHAR(80)" }], rows: [["  1) First, we lock sales.orders for read.   "], ["  2) Next, we do an all-AMPs RETRIEVE step."]] }]]);
    const plan = await (await createTeradataEngine({ client })).explain("SELECT * FROM orders", []);
    expect(plan).toEqual({ planText: "  1) First, we lock sales.orders for read.\n  2) Next, we do an all-AMPs RETRIEVE step.", planJson: "" });
  });

  it("fails rather than return part of a result", async () => {
    const { client } = fakeClient([[/./, { columns: [{ name: "n", type: "INTEGER" }], rows: [[1], [2]], truncated: true }]]);
    await expect((await createTeradataEngine({ client })).execute("SELECT n FROM t", [])).rejects.toThrow(/more than 2 rows/);
  });

  it("says which column held a value it could not read, without repeating the value", async () => {
    const { client } = fakeClient([[/./, { columns: [{ name: "at", type: "TIMESTAMP(0)" }], rows: [["card 4111-1111"]] }]]);
    const result = await (await createTeradataEngine({ client })).execute("SELECT at FROM t", []);
    const error = (await (async () => {
      for await (const _ of result.batches) void _;
    })().then(
      () => undefined,
      (e: unknown) => e,
    )) as Error;
    expect(error).toBeInstanceOf(EngineError);
    expect(error.message).toMatch(/column "at" could not be read/);
    expect(error.message).not.toMatch(/4111/);
  });
});

describe("errors", () => {
  it("gives Teradata's error numbers codes the UI understands", () => {
    const jdbc = (n: number, text: string) => teradataError(undefined, `[Teradata Database] [TeraJDBC 20.00.00.10] [Error ${n}] [SQLState 42000] ${text}`);
    expect(jdbc(3706, "Syntax error: expected something between the word 'orders' and the 'WHER' keyword.")).toMatchObject({
      code: "SYNTAX",
      engineCode: "3706",
      message: "Syntax error: expected something between the word 'orders' and the 'WHER' keyword.",
      position: undefined,
    });
    expect(jdbc(3707, "Syntax error, expected something like a name between ',' and the 'FROM' keyword.").code).toBe("SYNTAX");
    expect(jdbc(3807, "Object 'missing' does not exist.")).toMatchObject({ code: "UNKNOWN_TABLE", engineCode: "3807", message: "Object 'missing' does not exist." });
    expect(teradataError("3802", "Database 'MyDatabase' does not exist.")).toMatchObject({ code: "UNKNOWN_TABLE", engineCode: "3802" });
    expect(jdbc(3810, "Column/Parameter 'nope' does not exist.").code).toBe("UNKNOWN_COLUMN");
    expect(jdbc(5628, "Column nope not found in sales.orders.").code).toBe("UNKNOWN_COLUMN");
    const denied = jdbc(3523, "The user does not have SELECT access to hr.salaries.");
    expect(denied).toMatchObject({ code: "ENGINE", engineCode: "3523" });
    expect(denied.message).toMatch(/does not have SELECT access to hr\.salaries\. This user has no access/);
    expect(jdbc(2646, "No more spool space in reader.")).toMatchObject({ code: "ENGINE", engineCode: "2646" });
    expect(jdbc(2646, "No more spool space in reader.").message).toMatch(/Narrow it/);
    expect(jdbc(3610, "Internal error: Please do not resubmit the last request.")).toMatchObject({ code: "ENGINE", engineCode: "3610" });
    expect(jdbc(3156, "Request aborted by TDWM. Exception criteria exceeded: CPU Time.").code).toBe("CANCELLED");
    expect(teradataError(undefined, "socket hang up")).toMatchObject({ code: "ENGINE", engineCode: "", message: "socket hang up" });
    expect(teradataError("9999", "")).toMatchObject({ code: "ENGINE", message: "The query failed." });
  });

  it("passes a transport's EngineError through", async () => {
    const { client } = fakeClient([[/./, teradataError("3807", "Object 'missing' does not exist.")]]);
    await expect((await createTeradataEngine({ client })).execute("SELECT * FROM missing", [])).rejects.toMatchObject({ code: "UNKNOWN_TABLE", engineCode: "3807" });
  });
});

describe("session settings", () => {
  it("sets UTC, a query band and the default database", () => {
    expect(sessionStatements({ database: 'Sa"les' })).toEqual([
      "SET TIME ZONE INTERVAL '00:00' HOUR TO MINUTE",
      "SET QUERY_BAND = 'ApplicationName=surfaces-ui;' FOR SESSION",
      'DATABASE "Sa""les"',
    ]);
    expect(sessionStatements({ applicationName: "Sales desk 2" })[1]).toBe("SET QUERY_BAND = 'ApplicationName=Sales desk 2;' FOR SESSION");
    expect(() => sessionStatements({ applicationName: "x'; DROP" })).toThrow(/application name/);
  });
});

describe("a driver connection the consumer supplies", () => {
  function fakeDriver(fail?: (sql: string) => Error | undefined) {
    const log: { sql: string; params?: unknown[] }[] = [];
    let closed = 0;
    let cursors = 0;
    const connection = {
      cursor() {
        cursors += 1;
        let description: unknown;
        return {
          get description() {
            return description;
          },
          execute(sql: string, params?: unknown[]) {
            log.push({ sql, params });
            const error = fail?.(sql);
            if (error) throw error;
            description = /^SELECT/.test(sql) ? [["id", "INTEGER", null, null, null, null, true], ["name", function str() {}, null, null, null, null, true]] : null;
          },
          fetchall: () => [[1, "a"], [2, "b"]],
          close() {
            cursors -= 1;
          },
        };
      },
      close() {
        closed += 1;
      },
    };
    return { connection, log, state: () => ({ closed, cursors }) };
  }

  it("reads a large result a batch at a time, so one result does not hold the process still", async () => {
    const all = Array.from({ length: 4500 }, (_, i) => [i, `row ${i}`]);
    let at = 0;
    const asked: number[] = [];
    let fetchedAll = 0;
    const connection = {
      cursor: () => ({
        description: undefined as unknown,
        // Setting up the session comes first and returns nothing; only the query has rows.
        execute(sql: string) {
          this.description = /^SELECT id/.test(sql) ? [["id", "INTEGER"], ["name", "VARCHAR"]] : undefined;
          at = 0;
        },
        fetchall() {
          fetchedAll += 1;
          return all;
        },
        fetchmany(count: number) {
          asked.push(count);
          const batch = all.slice(at, at + count);
          at += count;
          return batch;
        },
        close() {},
      }),
      close() {},
    };
    // Other work runs between batches: a timer set before the query fires before it returns.
    let ticked = false;
    setImmediate(() => {
      ticked = true;
    });
    const result = await driverClient(() => connection).query("SELECT id, name FROM t", [], {});
    expect(result.rows).toHaveLength(4500);
    expect(result.rows.at(-1)).toEqual([4499, "row 4499"]);
    expect(asked.length).toBe(4);
    expect(fetchedAll).toBe(0);
    expect(ticked).toBe(true);
  });

  it("opens once, sets the session, binds values and closes its cursors", async () => {
    const driver = fakeDriver();
    let opened = 0;
    const client = driverClient(() => {
      opened += 1;
      return driver.connection;
    }, { database: "sales" });
    const [first, second] = await Promise.all([client.query("SELECT * FROM t WHERE a = ?", ["x'y"]), client.query("SELECT 2", [])]);
    expect(opened).toBe(1);
    expect(driver.log).toEqual([
      { sql: "SET TIME ZONE INTERVAL '00:00' HOUR TO MINUTE", params: undefined },
      { sql: "SET QUERY_BAND = 'ApplicationName=surfaces-ui;' FOR SESSION", params: undefined },
      { sql: 'DATABASE "sales"', params: undefined },
      { sql: "SELECT * FROM t WHERE a = ?", params: ["x'y"] },
      { sql: "SELECT 2", params: undefined },
    ]);
    // A type the driver gives as something other than a name is left for the engine to work out.
    expect(first).toEqual({ columns: [{ name: "id", type: "INTEGER" }, { name: "name", type: "" }], rows: [[1, "a"], [2, "b"]] });
    expect(second.rows).toHaveLength(2);
    expect(driver.state()).toEqual({ closed: 0, cursors: 0 });
    await client.close!();
    expect(driver.state().closed).toBe(1);
  });

  it("works behind the engine and maps the driver's errors", async () => {
    const driver = fakeDriver((sql) => (/missing/.test(sql) ? new Error("[Version 20.0.0.30] [Session 1077] [Teradata Database] [Error 3807] Object 'missing' does not exist.\n at gosqldriver/teradatasql.formatError") : undefined));
    const engine = await createTeradataEngine({ client: driverClient(() => driver.connection) });
    const { table } = await tableOf(engine, "SELECT * FROM t");
    expect(table.toArray().map((row) => ({ ...row }))).toEqual([{ id: 1, name: "a" }, { id: 2, name: "b" }]);
    await expect(engine.execute("SELECT * FROM missing", [])).rejects.toMatchObject({ code: "UNKNOWN_TABLE", engineCode: "3807", message: "Object 'missing' does not exist." });
    expect(driver.state().cursors).toBe(0);
  });

  it("does not repeat a driver's connection error, which can hold the connection settings", async () => {
    const client = driverClient(() => {
      throw new Error('Failed to connect: {"host":"td","user":"reader","password":"hunter2-s3cret"}');
    });
    const error = (await client.query("SELECT 1", []).then(
      () => undefined,
      (e: unknown) => e,
    )) as Error;
    expect(error).toBeInstanceOf(EngineError);
    expect(error.message).not.toMatch(/hunter2|reader/);
    expect(error.message).toMatch(/could not be opened/);
  });

  it("reads the type teradatasql puts after a tab in each name (column_type: true)", async () => {
    const connection = {
      cursor: () => ({
        description: [["region\tVARCHAR(30)", function str() {}], ["amount\tDECIMAL(18,2)", function num() {}]],
        execute() {},
        fetchall: () => [["Europe", "120.50"]],
        close() {},
      }),
      close() {},
    };
    const result = await driverClient(() => connection).query("SELECT region, amount FROM t", []);
    expect(result.columns).toEqual([
      { name: "region", type: "VARCHAR(30)" },
      { name: "amount", type: "DECIMAL(18,2)" },
    ]);
  });

  it("does not start a query that was cancelled while waiting", async () => {
    const driver = fakeDriver();
    const client = driverClient(() => driver.connection);
    const stop = new AbortController();
    stop.abort();
    await expect(client.query("SELECT 1", [], { signal: stop.signal })).rejects.toMatchObject({ code: "CANCELLED" });
    expect(driver.log).toEqual([]);
  });
});
