import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createConnectTransport } from "@connectrpc/connect-node";
import { connectDataSource, connectDiscovery } from "@surfaces-ui/client-connect";
import { type DataSource, type Discovery, QueryError, collect, queryErrorInfo, toRows } from "@surfaces-ui/data";
import { AggregateFunction, FilterOperator, ObjectKind, RelationKind, RewriteMode, SearchMode, SortDirection, SqlDialect, TimeGrain } from "@surfaces-ui/proto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { loadConfig, openSources, serverOptions } from "./config.js";
import { type SurfacesServer, createSurfacesServer } from "./server.js";

let server: SurfacesServer;
let data: DataSource;
let url: string;
let store: string;
let discovery: Discovery;
const s = (value: string) => ({ kind: { case: "stringValue" as const, value } });

beforeAll(async () => {
  const { config, dir } = await loadConfig(path.resolve(import.meta.dirname, "../../../surfaces.config.ts"));
  store = fs.mkdtempSync(path.join(os.tmpdir(), "surfaces-store-"));
  const options = await serverOptions({ ...config, discovery: { storeDir: store } }, await openSources(config, dir), dir);
  server = await createSurfacesServer({ ...options, maxResultRows: 3000 });
  ({ url } = await server.listen(0));
  const transport = createConnectTransport({ baseUrl: url, httpVersion: "1.1" });
  data = connectDataSource({ transport });
  discovery = connectDiscovery({ transport });
}, 120_000);
afterAll(async () => {
  await server?.close();
  if (store) fs.rmSync(store, { recursive: true, force: true });
});

describe("dev server, end to end", () => {
  it("sorts, filters and pages in SQL and returns typed Arrow", async () => {
    const result = await collect(
      data.execute({
        sourceId: "lake",
        batchRows: 10,
        query: {
          baseSql: "SELECT * FROM orders ORDER BY order_id",
          filters: [{ column: "region", operator: FilterOperator.EQ, values: [s("Europe")] }],
          sorts: [{ column: "amount", direction: SortDirection.DESC }, { column: "order_id" }],
          columns: ["order_id", "region", "amount"],
          page: { limit: 25, offset: 50n },
        },
      }),
    );
    expect(result.header.executedSql).toBe(
      'SELECT "order_id", "region", "amount" FROM (SELECT * FROM orders) AS "_sf" WHERE "region" = ? ORDER BY "amount" DESC, "order_id" ASC LIMIT 25 OFFSET 50',
    );
    expect(result.header.rewriteMode).toBe(RewriteMode.PARSED);
    expect(result.header.columns.map((c) => c.name)).toEqual(["order_id", "region", "amount"]);
    const rows = toRows(result.table);
    expect(rows).toHaveLength(25);
    expect(rows.every((r) => r.region === "Europe")).toBe(true);
    const amounts = rows.map((r) => r.amount as number);
    expect(amounts).toEqual([...amounts].sort((a, b) => b - a));
    expect(String(result.table.schema.fields[0]!.type)).toBe("Int64");
    expect(result.footer.totalRowsReturned).toBe(25n);
  });

  it("re-chunks batches and caps very large results", async () => {
    let batches = 0;
    let rows = 0n;
    let truncated = false;
    for await (const message of data.execute({ sourceId: "lake", batchRows: 1000, query: { baseSql: "SELECT * FROM orders" } })) {
      if (message.part.case === "batch") {
        batches++;
        rows += message.part.value.rowCount;
        expect(message.part.value.rowCount <= 1000n).toBe(true);
      }
      if (message.part.case === "footer") truncated = message.part.value.truncated;
    }
    expect(rows).toBe(3000n);
    expect(truncated).toBe(true);
    expect(batches).toBeGreaterThanOrEqual(3);
  });

  it("counts, explains and time-travels", async () => {
    const query = {
      baseSql: "SELECT * FROM delta_orders",
      filters: [{ column: "status", operator: FilterOperator.IS_NULL }],
    };
    expect((await data.count({ sourceId: "lake", query })).rowCount).toBe(437n);
    expect(
      (await data.count({ sourceId: "lake", query, timeTravel: { at: { case: "version", value: 0n }, table: "delta_orders" } }))
        .rowCount,
    ).toBe(250n);
    const snapshots = (await data.listSnapshots({ sourceId: "lake", ref: { table: "iceberg_orders" } })).snapshots;
    const old = await collect(
      data.execute({
        sourceId: "lake",
        query: { baseSql: "SELECT COUNT(*) AS n FROM iceberg_orders" },
        timeTravel: { at: { case: "snapshotId", value: snapshots.at(-1)!.id }, table: "iceberg_orders" },
      }),
    );
    expect(Number(toRows(old.table)[0]!.n)).toBe(1000);
    const plan = await data.explain({ sourceId: "lake", query: { baseSql: "SELECT * FROM orders", page: { limit: 5 } } });
    expect(plan.executedSql).toContain("LIMIT 5");
    expect(plan.planText.length).toBeGreaterThan(0);
  });

  it("describes sources and their catalog", async () => {
    const [source] = (await data.listSources({})).sources;
    expect(source).toMatchObject({ id: "lake", displayName: "Sample lake", dialect: SqlDialect.DUCKDB, readOnly: true });
    expect(source!.capabilities).toMatchObject({ timeTravel: true, exactCount: true, maxResultRows: 3000n });
    const test = await data.testSource!({ target: { case: "id", value: "lake" } });
    expect(test).toMatchObject({ ok: true, message: "Connected" });
    expect(test.checks.map((c) => [c.name, c.ok])).toEqual([["delta_orders", true], ["iceberg_orders", true], ["orders", true]]);
    const tables = (await data.listTables({ sourceId: "lake" })).tables;
    expect(tables.map((t) => t.ref?.table)).toEqual(["delta_orders", "iceberg_orders", "orders"]);
    const detail = (await data.describeTable({ sourceId: "lake", ref: { table: "orders" }, includeStats: true })).table;
    expect(detail?.columns).toHaveLength(7);
    expect(detail?.rowCount).toBe(5000n);
    // A name written as SQL writes it (schema.table) reaches the same table; a name that matches nothing still says so.
    expect((await data.describeTable({ sourceId: "lake", ref: { table: "main.orders" } })).table?.columns).toHaveLength(7);
    await expect(data.describeTable({ sourceId: "lake", ref: { table: "main.nope" } })).rejects.toThrow(/not found/i);
  });

  it("rejects writes and reports errors with a code", async () => {
    const fail = async (baseSql: string) => {
      try {
        await collect(data.execute({ sourceId: "lake", query: { baseSql } }));
      } catch (error) {
        // The client turns the server's error detail into a QueryError.
        expect(error).toBeInstanceOf(QueryError);
        const info = queryErrorInfo(error);
        return { detail: info.code, message: info.message };
      }
      throw new Error("expected a failure");
    };
    expect(await fail("DROP VIEW orders")).toMatchObject({ detail: "NOT_READ_ONLY" });
    expect(await fail("SELECT 1; SELECT 2")).toMatchObject({ detail: "MULTIPLE_STATEMENTS" });
    expect(await fail("SELECT * FROM nope")).toMatchObject({ detail: "UNKNOWN_TABLE" });
    expect(await fail("SELECT * FROM read_csv('/etc/passwd')")).toMatchObject({ detail: "ENGINE" });
    expect((await data.count({ sourceId: "lake", query: { baseSql: "SELECT * FROM orders" } })).rowCount).toBe(5000n);
    await expect(collect(data.execute({ sourceId: "other", query: { baseSql: "SELECT 1" } }))).rejects.toThrow(/Unknown source/);
  });

  it("runs a query once and serves its views from the stored result", async () => {
    const baseSql = "SELECT region, amount, order_id FROM orders WHERE amount > 100 ORDER BY amount DESC";
    const page = (offset: bigint, notBefore = "") =>
      collect(data.execute({ sourceId: "lake", notBefore, query: { baseSql, page: { limit: 20, offset } } }));
    const [first, second] = await Promise.all([page(0n), page(20n)]);
    expect(first.header.stored?.createdAt).toBeTruthy();
    expect(second.header.stored?.createdAt).toBe(first.header.stored?.createdAt);
    // The person's ORDER BY survives, and unsorted paging over stored rows is stable.
    expect(first.header.notices).toEqual([]);
    const amounts = [...toRows(first.table), ...toRows(second.table)].map((r) => r.amount as number);
    expect(amounts).toEqual([...amounts].sort((a, b) => b - a));
    // "Show SQL" stays the standalone form, not the internal table.
    expect(first.header.executedSql).not.toContain("_sf_results");
    expect((await data.count({ sourceId: "lake", query: { baseSql } })).rowCount).toBe(first.header.stored!.rowCount);
    const sorted = await collect(
      data.execute({ sourceId: "lake", query: { baseSql, sorts: [{ column: "order_id" }], page: { limit: 5 } } }),
    );
    expect(sorted.header.stored?.createdAt).toBe(first.header.stored?.createdAt);

    // A later not_before runs the query again, once for every view that sends it.
    const later = new Date(Date.now() + 5).toISOString();
    await new Promise((resolve) => setTimeout(resolve, 10));
    const [third, fourth] = await Promise.all([page(0n, later), page(20n, later)]);
    expect(third.header.stored!.createdAt > first.header.stored!.createdAt).toBe(true);
    expect(fourth.header.stored?.createdAt).toBe(third.header.stored?.createdAt);

    // Plain table scans are paged by the engine directly.
    const plain = await collect(data.execute({ sourceId: "lake", query: { baseSql: "SELECT * FROM orders", page: { limit: 5 } } }));
    expect(plain.header.stored).toBeUndefined();
    expect((await data.listSources({})).sources[0]!.capabilities?.storedResults).toBe(true);
  });

  it("buckets time, bins numbers, samples and computes statistics in the engine", async () => {
    const monthly = await collect(
      data.execute({
        sourceId: "lake",
        query: {
          baseSql: "SELECT * FROM orders",
          buckets: [{ column: "ordered_at", by: { case: "grain", value: TimeGrain.MONTH } }],
          aggregates: [{ function: AggregateFunction.COUNT, alias: "n" }],
          sorts: [{ column: "ordered_at" }],
        },
      }),
    );
    const months = toRows(monthly.table);
    expect(months.length).toBeGreaterThan(1);
    expect(months.length).toBeLessThan(12);
    expect(months.reduce((sum, r) => sum + Number(r.n), 0)).toBe(5000);

    const histogram = await collect(
      data.execute({
        sourceId: "lake",
        query: {
          baseSql: "SELECT * FROM orders",
          buckets: [{ column: "amount", alias: "bin", by: { case: "binWidth", value: 250 } }],
          aggregates: [{ function: AggregateFunction.COUNT, alias: "n" }, { function: AggregateFunction.MEDIAN, column: "amount", alias: "mid" }],
          sorts: [{ column: "bin" }],
        },
      }),
    );
    expect(toRows(histogram.table).map((r) => r.bin)).toEqual([0, 250, 500, 750]);

    const sample = await collect(
      data.execute({ sourceId: "lake", query: { baseSql: "SELECT * FROM orders", columns: ["amount"], sample: { rows: 300 } } }),
    );
    expect(sample.table.numRows).toBe(300);
    const ids = toRows(
      (await collect(data.execute({ sourceId: "lake", query: { baseSql: "SELECT * FROM orders", columns: ["order_id"], sample: { rows: 300 } } }))).table,
    ).map((r) => Number(r.order_id));
    // A sample is spread over the table, not its first rows.
    expect(Math.max(...ids)).toBeGreaterThan(2500);
  });

  it("says where in the SQL an error is", async () => {
    const where = async (baseSql: string, paged = true) => {
      try {
        await collect(data.execute({ sourceId: "lake", query: { baseSql, page: paged ? { limit: 10 } : undefined } }));
      } catch (error) {
        const { code, line, column } = queryErrorInfo(error);
        return { code, line, column };
      }
      throw new Error("expected a failure");
    };
    expect(await where("SELECT *\nFROM orders\nWHERE nope > 1")).toEqual({ code: "UNKNOWN_COLUMN", line: 3, column: 7 });
    expect(await where("\n  SELECT order_id\n  FROMM orders", false)).toMatchObject({ code: "SYNTAX", line: 3 });
    expect(await where("SELECT * FROM orders o JOIN missing m ON m.id = o.order_id")).toEqual({ code: "UNKNOWN_TABLE", line: 1, column: 29 });
  });

  it("answers browser preflight for localhost only", async () => {
    const preflight = (origin: string) =>
      fetch(`${url}/surfaces.v1.QueryService/Count`, { method: "OPTIONS", headers: { Origin: origin } });
    const ok = await preflight("http://localhost:5210");
    expect(ok.status).toBe(204);
    expect(ok.headers.get("access-control-allow-origin")).toBe("http://localhost:5210");
    expect((await preflight("https://example.com")).status).toBe(403);
  });

  it("searches, profiles and relates objects over DuckDB", async () => {
    const result = await discovery.search({ query: "iceberg", kinds: [ObjectKind.TABLE] });
    expect(result.modeUsed).toBe(SearchMode.KEYWORD);
    expect(result.hits[0]?.object?.name).toBe("iceberg_orders");
    const ref = { sourceId: "lake", kind: ObjectKind.TABLE, table: "orders" };
    const { profile } = await discovery.getObject({ ref, includeProfile: true });
    expect(profile?.rowCount).toBe(5000n);
    expect(profile?.sampleValuesAllowed).toBe(false);
    expect(profile?.columns.find((c) => c.name === "status")).toMatchObject({ nullCount: 1250n, distinctCount: 3n, topValues: [] });
    const { relations } = await discovery.getRelated({ ref, kinds: [RelationKind.JOIN] });
    expect(relations.map((r) => r.object?.name).sort()).toEqual(["delta_orders", "iceberg_orders"]);
    await expect(discovery.getObject({ ref: { ...ref, table: "nope" } })).rejects.toThrow(/Object not found/);
  });

  it("saves context packs as files and renders them", async () => {
    const pack = { name: "Lake orders", items: [{ ref: { sourceId: "lake", kind: ObjectKind.TABLE, table: "orders" }, columns: ["order_id", "amount"], includeSampleRows: true }] };
    const saved = (await discovery.saveContextPack({ pack })).pack!;
    const file = path.join(store, "context", `${saved.id}.json`);
    expect(JSON.parse(fs.readFileSync(file, "utf8")).name).toBe("Lake orders");
    const rendered = await discovery.renderContextPack({ target: { case: "id", value: saved.id } });
    expect(rendered.text).toContain("| amount | DOUBLE |");
    expect(rendered.containsSampleValues).toBe(false);
    expect(rendered.text).toContain("Sample rows withheld");
    await discovery.saveDescription({ ref: pack.items[0]!.ref, description: "Every order placed." });
    expect((await discovery.search({ query: "placed" })).hits[0]?.object?.name).toBe("orders");
    await expect(discovery.getContextPack({ id: "../../etc/passwd" })).rejects.toThrow(/Invalid context pack ID/);
    await discovery.deleteContextPack({ id: saved.id });
    expect(fs.existsSync(file)).toBe(false);
  });
});

describe("secrets", () => {
  it("reads named secrets from the environment and nowhere else", async () => {
    const { envSecrets } = await import("./config.js");
    const resolve = envSecrets({ LAKE_KEY_ID: "AKIA", LAKE_SECRET: "s3cr3t", OTHER_TOKEN: "t" });
    expect(resolve("LAKE")).toMatchObject({ keyId: "AKIA", secret: "s3cr3t" });
    expect(resolve("OTHER")).toMatchObject({ token: "t" });
    expect(resolve("MISSING")).toBeUndefined();
  });
});

describe("pipelines over the wire", () => {
  it("runs the configured pipeline, after which its tables can be queried and found", async () => {
    const { connectPipelines } = await import("@surfaces-ui/client-connect");
    const { RunState } = await import("@surfaces-ui/proto");
    const pipelines = connectPipelines({ transport: createConnectTransport({ baseUrl: url, httpVersion: "1.1" }) });
    expect((await pipelines.listPipelines({})).pipelines.map((p) => p.id)).toContain("sales");
    const before = await collect(data.execute({ sourceId: "lake", query: { baseSql: "SELECT region, COUNT(*) AS n FROM orders GROUP BY region", page: { limit: 10 } } }));
    expect(before.header.stored).toBeDefined();

    let run = (await pipelines.startRun({ pipelineId: "sales" })).run!;
    for (let i = 0; i < 300 && run.state === RunState.RUNNING; i++) {
      await new Promise((resolve) => setTimeout(resolve, 10));
      run = (await pipelines.getRun({ pipelineId: "sales", runId: run.id })).run!;
    }
    expect(run.state).toBe(RunState.COMPLETED);
    expect(run.datasetRuns.map((d) => d.name)).toEqual(["orders_raw", "orders_clean", "daily_revenue", "revenue_by_region"]);

    const result = await collect(data.execute({ sourceId: "lake", query: { baseSql: "SELECT * FROM daily_revenue", sorts: [{ column: "day" }], page: { limit: 3 } } }));
    expect(result.table.numRows).toBe(3);
    expect((await data.listTables({ sourceId: "lake", search: "revenue" })).tables.map((t) => t.ref?.table)).toEqual(["daily_revenue", "revenue_by_region"]);
    // The search index was rebuilt, so the new tables can be found by name.
    const found = await discovery.search({ query: "daily revenue", kinds: [ObjectKind.TABLE] });
    expect(found.hits[0]?.object?.name).toBe("daily_revenue");
    // A client cannot run SQL through the pipeline service, and writes are still refused elsewhere.
    await expect(collect(data.execute({ sourceId: "lake", query: { baseSql: "DROP TABLE daily_revenue" } }))).rejects.toThrow(/Only queries/);
  }, 60_000);
});

describe("saved pipelines and history", () => {
  it("keeps an approved pipeline and the runs across a restart, and refuses a stale or altered save", async () => {
    const { connectPipelines } = await import("@surfaces-ui/client-connect");
    const { pipelineDigest } = await import("@surfaces-ui/data");
    const { RunState } = await import("@surfaces-ui/proto");
    const { config, dir } = await loadConfig(path.resolve(import.meta.dirname, "../../../surfaces.config.ts"));
    const own = fs.mkdtempSync(path.join(os.tmpdir(), "surfaces-pipelines-"));
    const open = async () => {
      const options = await serverOptions({ ...config, seeds: false, savedPipelines: true, discovery: { storeDir: own } }, await openSources({ ...config, seeds: false }, dir), dir);
      const started = await createSurfacesServer({ ...options, discovery: false });
      const { url: at } = await started.listen(0);
      return { started, pipelines: connectPipelines({ transport: createConnectTransport({ baseUrl: at, httpVersion: "1.1" }) }) };
    };
    try {
      const first = await open();
      const draft = { id: "by-region", name: "By region", sourceId: "lake", datasets: [{ name: "region_totals", sql: "SELECT region, SUM(amount) AS revenue FROM orders GROUP BY region", inputs: ["orders"], primaryKey: ["region"] }] };
      const digest = await pipelineDigest(draft);
      await expect(first.pipelines.savePipeline!({ pipeline: { ...draft, name: "Other" }, expectedVersion: 0, approvedBy: "Ana", approvalDigest: digest })).rejects.toThrow(/approved/);
      await expect(first.pipelines.savePipeline!({ pipeline: { ...draft, id: "sales" }, expectedVersion: 0, approvedBy: "Ana", approvalDigest: await pipelineDigest({ ...draft, id: "sales" }) })).rejects.toThrow(/config/);
      expect((await first.pipelines.savePipeline!({ pipeline: draft, expectedVersion: 0, approvedBy: "Ana", approvalDigest: digest })).pipeline?.version).toBe(1);
      await expect(first.pipelines.savePipeline!({ pipeline: draft, expectedVersion: 0, approvedBy: "Ana", approvalDigest: digest })).rejects.toMatchObject({ code: 10 });
      expect(fs.existsSync(path.join(own, "pipelines", "by-region.json"))).toBe(true);

      let run = (await first.pipelines.startRun({ pipelineId: "by-region", trigger: "agent" })).run!;
      for (let i = 0; i < 300 && run.state === RunState.RUNNING; i++) {
        await new Promise((resolve) => setTimeout(resolve, 10));
        run = (await first.pipelines.getRun({ pipelineId: "by-region", runId: run.id })).run!;
      }
      expect(run.state).toBe(RunState.COMPLETED);
      expect(run.datasetRuns[0]!.checks.map((c) => c.name)).toEqual(["unique_region", "not_null_region"]);
      await first.started.close();

      const second = await open();
      expect((await second.pipelines.listPipelines({})).pipelines.map((p) => p.id)).toContain("by-region");
      expect((await second.pipelines.listRuns({ pipelineId: "by-region" })).runs.map((r) => [r.id, r.trigger])).toEqual([[run.id, "agent"]]);
      expect((await second.pipelines.listPipelineVersions!({ pipelineId: "by-region" })).versions.map((v) => v.approvedBy)).toEqual(["Ana"]);
      await second.started.close();
    } finally {
      fs.rmSync(own, { recursive: true, force: true });
    }
  }, 60_000);
});

