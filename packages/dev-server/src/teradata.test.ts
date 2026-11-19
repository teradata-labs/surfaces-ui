import { type DataSource, collect, queryErrorInfo, toRows } from "@surfaces-ui/data";
import { type DriverConnection, type TeradataClient, type TeradataResult, createTeradataEngine, driverClient } from "@surfaces-ui/engine-teradata";
import { createRequire } from "node:module";
import { homedir } from "node:os";
import path from "node:path";
import { AggregateFunction, Engine, FilterOperator, SortDirection, SourceKind, SqlDialect, TableKind } from "@surfaces-ui/proto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { envSecrets, openSources } from "./config.js";
import { type SurfacesServer, createSurfacesServer } from "./server.js";

const s = (value: string) => ({ kind: { case: "stringValue" as const, value } });

/**
 * The server over the Teradata engine with a stand-in transport: what the
 * server asks of Teradata, with no Teradata. Always runs.
 */
describe("Teradata engine behind the server (stand-in transport)", () => {
  const calls: { sql: string; params: unknown[] }[] = [];
  const names = Array.from({ length: 7 }, (_, i) => `orders_${i + 1}`);
  const client: TeradataClient = {
    async query(sql, params): Promise<TeradataResult> {
      calls.push({ sql, params });
      if (/FROM DBC\.TablesV/.test(sql)) {
        const top = /^SELECT TOP (\d+)/.exec(sql);
        const between = /BETWEEN (\d+) AND (\d+)/.exec(sql);
        const page = top ? names.slice(0, Number(top[1])) : names.slice(Number(between![1]) - 1, Number(between![2]));
        return { columns: [], rows: page.map((name) => ["sales", name, "T", ""]) };
      }
      if (/row_count/.test(sql)) return { columns: [{ name: "row_count", type: "INTEGER" }], rows: [[1250]] };
      return { columns: [{ name: "region", type: "VARCHAR(30)" }, { name: "amount", type: "DECIMAL(18,2)" }], rows: [["Europe", "120.50"]] };
    },
  };
  let server: SurfacesServer;
  let data: DataSource;

  beforeAll(async () => {
    server = await createSurfacesServer({ sources: [{ id: "td", kind: SourceKind.TERADATA, engine: await createTeradataEngine({ client, database: "sales" }) }], discovery: false });
    data = server.dataSource;
  });
  afterAll(() => server?.close());

  it("describes the source", async () => {
    const [source] = (await data.listSources({})).sources;
    expect(source).toMatchObject({ id: "td", kind: SourceKind.TERADATA, engine: Engine.TERADATA, dialect: SqlDialect.TERADATA, readOnly: true });
    expect(source!.capabilities).toMatchObject({ explain: true, timeTravel: false, storedResults: false });
  });

  it("has Teradata cut each page of tables, asking for one extra to know whether there is another", async () => {
    calls.length = 0;
    const first = await data.listTables({ sourceId: "td", pageSize: 3 });
    expect(first.tables.map((t) => t.ref?.table)).toEqual(["orders_1", "orders_2", "orders_3"]);
    expect(first.tables[0]).toMatchObject({ ref: { catalog: "", schema: "sales" }, kind: TableKind.TABLE });
    expect(first.nextPageToken).toBe("3");
    const second = await data.listTables({ sourceId: "td", pageSize: 3, pageToken: first.nextPageToken });
    expect(second.tables.map((t) => t.ref?.table)).toEqual(["orders_4", "orders_5", "orders_6"]);
    const last = await data.listTables({ sourceId: "td", pageSize: 3, pageToken: second.nextPageToken });
    expect(last.tables.map((t) => t.ref?.table)).toEqual(["orders_7"]);
    expect(last.nextPageToken).toBe("");
    expect(calls.map((c) => c.sql.replace(/^.*?(TOP \d+|BETWEEN \d+ AND \d+).*$/, "$1"))).toEqual(["TOP 4", "BETWEEN 4 AND 7", "BETWEEN 7 AND 10"]);
  });

  it("sends Teradata SQL with the filter values bound, and returns typed Arrow", async () => {
    calls.length = 0;
    const hostile = "Europe'; DROP TABLE orders; --";
    const page = await collect(
      data.execute({
        sourceId: "td",
        query: {
          baseSql: "SELECT * FROM orders",
          filters: [{ column: "region", operator: FilterOperator.EQ, values: [s(hostile)] }],
          sorts: [{ column: "amount", direction: SortDirection.DESC }],
          page: { limit: 25, offset: 50n },
        },
      }),
    );
    expect(calls).toEqual([
      {
        sql: 'SELECT * FROM (SELECT * FROM orders) AS "_sf" WHERE "region" = ? QUALIFY ROW_NUMBER() OVER (ORDER BY "amount" DESC) BETWEEN 51 AND 75 ORDER BY "amount" DESC',
        params: [hostile],
      },
    ]);
    expect(page.header.stored).toBeUndefined();
    expect(page.table.schema.fields.map((f) => f.name)).toEqual(["region", "amount"]);
    expect(String(page.table.schema.fields[1]!.type)).toMatch(/Decimal/);
    expect((await data.count({ sourceId: "td", query: { baseSql: "SELECT * FROM orders" } })).rowCount).toBe(1250n);
  });

  it("refuses to write before anything reaches Teradata", async () => {
    calls.length = 0;
    const refused = await collect(data.execute({ sourceId: "td", query: { baseSql: "DROP TABLE orders" } })).then(
      () => undefined,
      (error: unknown) => queryErrorInfo(error),
    );
    expect(refused).toMatchObject({ code: "NOT_READ_ONLY" });
    expect(calls).toEqual([]);
  });

  it("opens a Teradata source from configuration with a secret's name, and no password in it", async () => {
    const seen: string[] = [];
    const config = { sources: [{ id: "td", engine: "teradata" as const, baseUrl: "https://qs.example.com:1443", system: "prod", user: "reader", secret: "TD_TEST", database: "sales" }] };
    const [source] = await openSources(config, ".", (name) => {
      seen.push(name);
      return envSecrets({ TD_TEST_PASSWORD: "not-in-config" })(name);
    });
    expect(source).toMatchObject({ id: "td", kind: SourceKind.TERADATA });
    expect(source!.engine.kind).toBe(Engine.TERADATA);
    expect(source!.engine.connections).toEqual([{ name: "prod", kind: expect.any(Number), scope: "https://qs.example.com:1443", credentialsSecret: "TD_TEST" }]);
    expect(JSON.stringify(config)).not.toMatch(/password/i);
    // Nothing is looked up or sent until a query runs.
    expect(seen).toEqual([]);
    await source!.engine.close();
  });
});

/**
 * Runs the whole stack on a real Teradata system through Teradata Query
 * Service. It needs one, so it only runs when told where it is:
 *
 *   SURFACES_TEST_TERADATA=https://vantage.example.com:1443   (Query Service, up to /systems)
 *   SURFACES_TEST_TERADATA_SYSTEM=prod                        (the system name in Query Service)
 *   SURFACES_TEST_TERADATA_USER=reader                        (not needed with a JWT)
 *   TERADATA_TEST_PASSWORD=...   or   TERADATA_TEST_TOKEN=... (the secret, named TERADATA_TEST)
 *
 * Or directly, through the `teradatasql` driver installed outside this repo
 * (this repo never installs one):
 *
 *   SURFACES_TEST_TERADATA_HOST=host.example.com
 *   SURFACES_TEST_TERADATA_USER=reader
 *   TERADATA_PASSWORD=...
 *   SURFACES_TERADATA_DRIVER=/path/to/folder   (default ~/.cache/surfaces/teradata-driver)
 *
 * It reads only the data dictionary (DBC), which every system has, so no
 * tables need loading. The user needs SELECT on the DBC views.
 */
const address = process.env.SURFACES_TEST_TERADATA;
const host = process.env.SURFACES_TEST_TERADATA_HOST;

/** A driver connection over teradatasql from the folder it was installed in, with its async calls. */
function teradatasqlConnection(): () => Promise<DriverConnection> {
  const dir = process.env.SURFACES_TERADATA_DRIVER ?? path.join(homedir(), ".cache", "surfaces", "teradata-driver");
  type Cursor = { executeAsync(sql: string, params?: unknown[]): Promise<unknown>; fetchall(): unknown; fetchmany(count: number): unknown; readonly description?: unknown; close(): unknown };
  const td = createRequire(path.join(dir, "package.json"))("teradatasql") as {
    connectAsync(params: Record<string, string>): Promise<{ cursor(): Cursor; closeAsync(): Promise<unknown> }>;
  };
  return async () => {
    const connection = await td.connectAsync({ host: host!, user: process.env.SURFACES_TEST_TERADATA_USER ?? "", password: process.env.TERADATA_PASSWORD ?? "", encryptdata: "true", column_type: "true" });
    return {
      cursor() {
        const cursor = connection.cursor();
        return {
          execute: (sql: string, params?: unknown[]) => cursor.executeAsync(sql, params),
          fetchall: () => cursor.fetchall(),
          fetchmany: (count: number) => cursor.fetchmany(count),
            get description() {
            return cursor.description;
          },
          close: () => cursor.close(),
        };
      },
      close: () => connection.closeAsync(),
    };
  };
}
const info = "SELECT InfoKey, InfoData FROM DBC.DBCInfoV";

describe.skipIf(!address && !host)(`Teradata (${host ? "teradatasql driver" : "Query Service"})`, () => {
  let server: SurfacesServer;
  let data: DataSource;

  beforeAll(async () => {
    const engine = host
      ? await createTeradataEngine({ client: driverClient(teradatasqlConnection()), address: host })
      : await createTeradataEngine({
      baseUrl: address!,
      system: process.env.SURFACES_TEST_TERADATA_SYSTEM ?? "",
      user: process.env.SURFACES_TEST_TERADATA_USER,
      secret: "TERADATA_TEST",
      resolveSecret: envSecrets(),
    });
    server = await createSurfacesServer({ sources: [{ id: "td", kind: SourceKind.TERADATA, engine }], discovery: false });
    data = server.dataSource;
  }, 120_000);
  afterAll(() => server?.close());

  const fail = async (baseSql: string) => {
    try {
      await collect(data.execute({ sourceId: "td", query: { baseSql, page: { limit: 5 } } }));
    } catch (error) {
      return queryErrorInfo(error);
    }
    throw new Error("expected a failure");
  };

  it("describes itself, connects, and pages its catalog", async () => {
    const [source] = (await data.listSources({})).sources;
    expect(source).toMatchObject({ id: "td", engine: Engine.TERADATA, dialect: SqlDialect.TERADATA, readOnly: true });
    const test = await data.testSource!({ target: { case: "id", value: "td" } });
    expect(test).toMatchObject({ ok: true });
    expect(test.engineVersion).toMatch(/^Teradata \d+\./);
    expect((await data.listSchemas({ sourceId: "td" })).schemas.map((d) => d.name.toLowerCase())).toContain("dbc");

    const first = await data.listTables({ sourceId: "td", schema: "DBC", search: "info", pageSize: 2 });
    expect(first.tables).toHaveLength(2);
    expect(first.nextPageToken).toBe("2");
    const second = await data.listTables({ sourceId: "td", schema: "DBC", search: "info", pageSize: 2, pageToken: first.nextPageToken });
    const all = [...first.tables, ...second.tables].map((t) => t.ref?.table ?? "");
    expect(new Set(all).size).toBe(all.length);
    expect(all.every((name) => /info/i.test(name))).toBe(true);
    expect([...all].sort((a, b) => a.localeCompare(b, "en", { sensitivity: "base" }))).toEqual(all);
  });

  it("describes a view from its own columns and a table from the dictionary", async () => {
    const view = (await data.describeTable({ sourceId: "td", ref: { schema: "dbc", table: "dbcinfov" } })).table!;
    expect(view.summary).toMatchObject({ kind: TableKind.VIEW, ref: { schema: "DBC", table: "DBCInfoV" } });
    expect(view.columns.map((c) => c.name)).toEqual(["InfoKey", "InfoData"]);
    // A caller that holds only a name, written as SQL writes it, still reaches the table.
    const named = (await data.describeTable({ sourceId: "td", ref: { table: "dbc.dbcinfov" } })).table!;
    expect(named.columns.map((c) => c.name)).toEqual(["InfoKey", "InfoData"]);
    expect(view.columns.every((c) => c.arrowType === "Utf8" && c.nativeType !== "")).toBe(true);
    const table = (await data.describeTable({ sourceId: "td", ref: { schema: "DBC", table: "DBCInfoTbl" }, includeStats: true })).table!;
    expect(table.summary?.kind).toBe(TableKind.TABLE);
    expect(table.columns.some((c) => c.primaryKey)).toBe(true);
    expect(table.properties.primaryIndex).toBeTruthy();
    expect(table.rowCount).toBeGreaterThan(0n);
  });

  it("sorts, filters and pages with TOP and ROW_NUMBER, binding values", async () => {
    const page = await collect(
      data.execute({
        sourceId: "td",
        query: { baseSql: info, filters: [{ column: "InfoKey", operator: FilterOperator.EQ, values: [s("VERSION")] }], sorts: [{ column: "InfoKey" }], page: { limit: 5 } },
      }),
    );
    expect(page.header.executedSql).toBe('SELECT TOP 5 * FROM (SELECT InfoKey, InfoData FROM DBC.DBCInfoV) AS "_sf" WHERE "InfoKey" = ? ORDER BY "InfoKey" ASC');
    expect(toRows(page.table)).toHaveLength(1);
    expect(String(toRows(page.table)[0]!.InfoData)).toMatch(/^\d+\./);

    const total = (await data.count({ sourceId: "td", query: { baseSql: info } })).rowCount;
    expect(total).toBeGreaterThanOrEqual(2n);
    const later = await collect(data.execute({ sourceId: "td", query: { baseSql: info, sorts: [{ column: "InfoKey" }], page: { limit: 1, offset: 1n } } }));
    expect(later.header.executedSql).toMatch(/QUALIFY ROW_NUMBER\(\) OVER \(ORDER BY "InfoKey" ASC\) BETWEEN 2 AND 2/);
    expect(later.table.numRows).toBe(1);
    const contains = { baseSql: info, filters: [{ column: "InfoKey", operator: FilterOperator.CONTAINS, values: [s("vers")] }] };
    expect((await data.count({ sourceId: "td", query: contains })).rowCount).toBe(1n);
  });

  it("returns each type family as the right Arrow type, in UTC", async () => {
    const typed = await collect(
      data.execute({
        sourceId: "td",
        query: {
          baseSql:
            "SELECT CAST(1 AS BYTEINT) AS tiny, CAST(2 AS SMALLINT) AS small, CAST(3 AS INTEGER) AS whole, CAST(9007199254740993 AS BIGINT) AS big, CAST(12345678901234.56 AS DECIMAL(18,2)) AS amount, CAST(0.25 AS FLOAT) AS ratio, DATE '2026-03-01' AS day_, TIMESTAMP '2026-03-01 12:30:00' AS at_, CAST('Zoë' AS VARCHAR(10) CHARACTER SET UNICODE) AS name_, CAST(NULL AS INTEGER) AS nothing",
        },
      }),
    );
    const types = Object.fromEntries(typed.table.schema.fields.map((f) => [f.name, String(f.type)]));
    expect(types).toMatchObject({ tiny: "Int8", small: "Int16", whole: "Int32", big: "Int64", ratio: "Float64", name_: "Utf8", nothing: "Int32" });
    expect(types.day_).toMatch(/Date/);
    expect(types.at_).toMatch(/Timestamp/);
    const [row] = toRows(typed.table);
    expect(row).toMatchObject({ tiny: 1, small: 2, whole: 3, big: 9007199254740993n, ratio: 0.25, name_: "Zoë", nothing: null });
    expect(Number(row!.amount)).toBeCloseTo(12345678901234.56, 1);
    expect(new Date(Number(row!.day_)).toISOString()).toBe("2026-03-01T00:00:00.000Z");
    expect(new Date(Number(row!.at_)).toISOString()).toBe("2026-03-01T12:30:00.000Z");
  });

  it("groups and aggregates in Teradata", async () => {
    const kinds = await collect(
      data.execute({
        sourceId: "td",
        query: {
          baseSql: "SELECT TableKind, TableName FROM DBC.TablesV WHERE DatabaseName = 'DBC'",
          groupBy: ["TableKind"],
          aggregates: [{ function: AggregateFunction.COUNT, alias: "n" }],
          sorts: [{ column: "n", direction: SortDirection.DESC }],
        },
      }),
    );
    const rows = toRows(kinds.table);
    expect(rows.length).toBeGreaterThan(1);
    const counts = rows.map((r) => Number(r.n));
    expect(counts).toEqual([...counts].sort((a, b) => b - a));
  });

  it("treats hostile filter values as data", async () => {
    for (const hostile of ["' OR 1=1 --", "VERSION'; DROP TABLE x; --", "?", "\\"]) {
      const query = { baseSql: info, filters: [{ column: "InfoKey", operator: FilterOperator.EQ, values: [s(hostile)] }] };
      expect((await data.count({ sourceId: "td", query })).rowCount).toBe(0n);
    }
  });

  it("reports errors with a code, explains a query, and refuses to write", async () => {
    expect(await fail("SELECT * FROM DBC.no_such_table_here")).toMatchObject({ code: "UNKNOWN_TABLE", engineCode: "3807" });
    expect(await fail("SELECT nope FROM DBC.DBCInfoV")).toMatchObject({ code: "UNKNOWN_COLUMN" });
    expect(await fail("SELECT InfoKey FROM DBC.DBCInfoV WHERE")).toMatchObject({ code: "SYNTAX" });
    expect(await fail("DROP TABLE DBC.DBCInfoTbl")).toMatchObject({ code: "NOT_READ_ONLY" });
    expect(await fail("SELECT 1; SELECT 2")).toMatchObject({ code: "MULTIPLE_STATEMENTS" });
    const plan = await data.explain({ sourceId: "td", query: { baseSql: info, filters: [{ column: "InfoKey", operator: FilterOperator.EQ, values: [s("VERSION")] }] } });
    expect(plan.planText).toMatch(/RETRIEVE|lock/i);
    await expect(collect(data.execute({ sourceId: "td", query: { baseSql: info, page: { limit: 1 } }, timeTravel: { at: { case: "version", value: 1n } } }))).rejects.toThrow(/earlier time/);
  });
});
