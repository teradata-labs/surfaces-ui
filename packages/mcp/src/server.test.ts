import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { Client } from "@modelcontextprotocol/client";
import { RESOURCE_MIME_TYPE } from "@modelcontextprotocol/ext-apps/server";
import { InMemoryTransport, McpServer } from "@modelcontextprotocol/server";
import { collect, memoryDataSource, toRows } from "@surfaces-ui/data";
import { FilterOperator, SortDirection } from "@surfaces-ui/proto";
import { A2UI_VERSION, analyticsCatalog } from "@surfaces-ui/spec";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { APP_RESOURCE_URI, type AppView, PIPELINE_RPC_TOOL, RPC_TOOL, mcpDataSource, mcpPipelines, registerSurfacesApps } from "./index.js";
import { installMcpServer } from "./node.js";

let client: Client;
const rows = Array.from({ length: 30 }, (_, i) => ({ order_id: i + 1, region: ["EU", "NA", "APAC"][i % 3]!, amount: i * 2 }));

beforeAll(async () => {
  const server = new McpServer({ name: "test", version: "0" });
  registerSurfacesApps(server, {
    dataSource: memoryDataSource({ sourceId: "shop", tables: { orders: rows } }),
    // A stand-in catalog search: one hit in a database, as a warehouse reports it.
    discovery: {
      search: async (request: { query?: string }) => ({
        hits: request.query === "nothing" ? [] : [{ object: { ref: { sourceId: "shop", schema: "sales", table: "orders", column: "amount" }, nativeType: "DECIMAL(12,2)", description: "What was paid" }, score: 1, reasons: [] }],
        total: request.query === "nothing" ? 0n : 1n,
      }),
    } as never,
    appHtml: "<!doctype html><title>stub</title>", maxRowsPerRequest: 10 });
  const [a, b] = InMemoryTransport.createLinkedPair();
  client = new Client({ name: "host", version: "0" });
  await Promise.all([server.connect(a), client.connect(b)]);
});
afterAll(() => client?.close());

const call = async (name: string, args: Record<string, unknown>) => {
  const result = await client.callTool({ name, arguments: args });
  const text = (result.content as { text?: string }[] | undefined)?.[0]?.text ?? "";
  return { text, view: result.structuredContent as AppView | undefined, isError: result.isError === true, raw: result };
};

describe("MCP tools", () => {
  it("lists tools, linking the visible ones to the app page and hiding the data channel", async () => {
    const { tools } = await client.listTools();
    const byName = new Map(tools.map((t) => [t.name, t]));
    expect([...byName.keys()].sort()).toEqual(
      ["describe_table", "get_component_docs", "list_tables", "open_sql_editor", "render_surface", "show_chart", "show_dashboard", "show_data_grid", "show_pivot_table", "search_data", "show_query_result", "show_schema_explorer", RPC_TOOL].sort(),
    );
    const meta = (name: string) => (byName.get(name)!._meta as { ui?: { resourceUri?: string; visibility?: string[] } } | undefined)?.ui;
    expect(meta("show_data_grid")?.resourceUri).toBe(APP_RESOURCE_URI);
    expect(meta(RPC_TOOL)?.visibility).toEqual(["app"]);
    expect(meta("list_tables")).toBeUndefined();
    expect(tools.every((t) => t.annotations?.readOnlyHint === true)).toBe(true);
  });

  it("serves the app page as an MCP App resource", async () => {
    const { contents } = await client.readResource({ uri: APP_RESOURCE_URI });
    expect(contents[0]).toMatchObject({ uri: APP_RESOURCE_URI, mimeType: RESOURCE_MIME_TYPE });
    expect((contents[0] as { text: string }).text).toContain("<title>stub</title>");
  });

  it("shows a table or chart only after the query has run", async () => {
    const grid = await call("show_data_grid", { sql: "SELECT * FROM orders", title: "Orders" });
    expect(grid.view).toEqual({ view: "grid", sourceId: "shop", sql: "SELECT * FROM orders", title: "Orders" });
    expect(grid.text).toBe("Showing a table of 30 rows.");
    const chart = await call("show_chart", { sql: "SELECT * FROM orders", type: "bar", x: "region", y: [{ column: "amount", aggregate: "sum" }] });
    expect(chart.view).toMatchObject({ view: "chart", type: "bar", x: "region" });
    const bad = await call("show_data_grid", { sql: "SELECT * FROM missing" });
    expect(bad.isError).toBe(true);
    expect(bad.text).toMatch(/The query did not run: Table not found: missing/);
    expect(bad.view).toBeUndefined();
  });

  it("describes the data and the components for the model", async () => {
    expect((await call("list_tables", {})).text).toBe("Sources: shop\nTables in shop:\n- orders(order_id Float64, region Dictionary<Int32, Utf8>, amount Float64)");
    expect((await call("list_tables", { search: "zzz" })).text).toBe("Sources: shop\nTables in shop:");
    expect((await call("describe_table", { table: "orders" })).text).toBe("orders\n- order_id Float64\n- region Dictionary<Int32, Utf8>\n- amount Float64");
    expect((await call("describe_table", { table: "missing" })).isError).toBe(true);
    // A table in a database is named with it, so SQL written from the answer runs.
    expect((await call("search_data", { query: "paid" })).text).toBe('1 matches for "paid"; the best 1:\n- shop: sales.orders.amount DECIMAL(12,2) — What was paid');
    expect((await call("search_data", { query: "nothing" })).text).toBe('Nothing in the catalog matches "nothing".');
    const docs = await call("get_component_docs", {});
    expect(docs.text).toContain(`catalogId: "${analyticsCatalog.id}"`);
    expect((await call("get_component_docs", { component: "Chart" })).text).toMatch(/^# Chart/);
    expect((await call("get_component_docs", { component: "Nope" })).isError).toBe(true);
  });

  it("validates custom views and tells the model what to fix", async () => {
    const good = [
      { version: A2UI_VERSION, createSurface: { surfaceId: "main", catalogId: analyticsCatalog.id } },
      { version: A2UI_VERSION, updateComponents: { surfaceId: "main", components: [{ id: "root", component: "Text", text: "Hi" }] } },
    ];
    expect((await call("render_surface", { messages: good })).view).toEqual({ view: "surface", messages: good });
    const bad = await call("render_surface", { messages: [good[0], { version: A2UI_VERSION, updateComponents: { surfaceId: "main", components: [{ id: "root", component: "Html", html: "<script>" }] } }] });
    expect(bad.isError).toBe(true);
    expect(bad.text).toMatch(/message 1\/updateComponents\/components\/0\/component: Unknown component "Html"/);
    const pivot = await call("show_pivot_table", { sql: "SELECT * FROM orders", rows: ["region"], measures: [{ column: "amount", aggregate: "sum" }] });
    expect(pivot.view).toMatchObject({ view: "pivot", rows: ["region"] });
    const dashboard = await call("show_dashboard", { spec: { root: "page", elements: { page: { type: "Box", children: ["h"] }, h: { type: "Heading", props: { text: "Sales" } } } } });
    expect((dashboard.view as { messages: unknown[] }).messages).toHaveLength(2);
  });
});

describe("app data channel", () => {
  const data = () => mcpDataSource((name, args) => client.callTool({ name, arguments: args }) as never);

  it("carries DataSource calls as tool calls, with rows as Arrow", async () => {
    const result = await collect(
      data().execute({
        sourceId: "shop",
        query: {
          baseSql: "SELECT * FROM orders",
          filters: [{ column: "region", operator: FilterOperator.EQ, values: [{ kind: { case: "stringValue", value: "EU" } }] }],
          sorts: [{ column: "amount", direction: SortDirection.DESC }],
          page: { limit: 3, offset: 1n },
        },
      }),
    );
    expect(toRows(result.table)).toEqual([
      { order_id: 25, region: "EU", amount: 48 },
      { order_id: 22, region: "EU", amount: 42 },
      { order_id: 19, region: "EU", amount: 36 },
    ]);
    expect(result.footer.totalRowsReturned).toBe(3n);
    expect((await data().count({ sourceId: "shop", query: { baseSql: "SELECT * FROM orders" } })).rowCount).toBe(30n);
    expect((await data().describeTable({ sourceId: "shop", ref: { table: "orders" } })).table?.columns).toHaveLength(3);
  });

  it("caps rows per request and reports errors", async () => {
    const unpaged = await collect(data().execute({ sourceId: "shop", query: { baseSql: "SELECT * FROM orders" } }));
    expect(unpaged.table.numRows).toBe(10);
    const huge = await collect(data().execute({ sourceId: "shop", query: { baseSql: "SELECT * FROM orders", page: { limit: 5000 } } }));
    expect(huge.table.numRows).toBe(10);
    await expect(collect(data().execute({ sourceId: "shop", query: { baseSql: "SELECT * FROM nope" } }))).rejects.toThrow(/Table not found/);
    expect((await call(RPC_TOOL, { method: "dropEverything", request: {} })).isError).toBe(true);
    expect((await call(RPC_TOOL, { method: "constructor", request: {} })).isError).toBe(true);
  });
});

describe("install", () => {
  it("adds the server to .mcp.json and keeps what is there", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "surfaces-install-"));
    try {
      const file = path.join(dir, ".mcp.json");
      fs.writeFileSync(file, JSON.stringify({ mcpServers: { other: { command: "x" } }, keep: true }));
      expect(installMcpServer({ dir, config: "surfaces.config.ts" })).toEqual({ file, replaced: false });
      const written = JSON.parse(fs.readFileSync(file, "utf8"));
      expect(written).toEqual({
        mcpServers: { other: { command: "x" }, surfaces: { command: "npx", args: ["-y", "@surfaces-ui/mcp", "--config", "surfaces.config.ts"] } },
        keep: true,
      });
      expect(installMcpServer({ dir }).replaced).toBe(true);
      fs.writeFileSync(file, "{ not json");
      expect(() => installMcpServer({ dir })).toThrow(/not valid JSON/);
      expect(fs.readFileSync(file, "utf8")).toBe("{ not json");
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("MCP pipeline tools", () => {
  it("lists, describes, checks and runs pipelines, marking only the run as changing data", async () => {
    const { memoryPipelines } = await import("@surfaces-ui/data");
    const server = new McpServer({ name: "test", version: "0" });
    const pipelines = memoryPipelines([{ summary: { id: "sales", name: "Sales", sourceId: "shop" }, datasets: [{ name: "clean", sql: "SELECT * FROM orders", primaryKey: ["order_id"] }] }]);
    registerSurfacesApps(server, { dataSource: memoryDataSource({ sourceId: "shop", tables: { orders: rows } }), pipelines, appHtml: "<!doctype html>" });
    const [a, b] = InMemoryTransport.createLinkedPair();
    const host = new Client({ name: "host", version: "0" });
    await Promise.all([server.connect(a), host.connect(b)]);
    try {
      const { tools } = await host.listTools();
      const pipelineNames = ["list_pipelines", "describe_pipeline", "check_pipeline", "get_run", "show_pipeline", "propose_dataset", "run_pipeline"];
      expect(tools.map((t) => t.name)).toEqual(expect.arrayContaining(pipelineNames));
      // The page's channel changes things too, but only the model's run is destructive; the channel is hidden from the model.
      expect(tools.filter((t) => t.annotations?.readOnlyHint !== true).map((t) => [t.name, t.annotations?.destructiveHint])).toEqual([
        ["run_pipeline", true],
        [PIPELINE_RPC_TOOL, false],
      ]);
      expect(tools.find((t) => t.name === PIPELINE_RPC_TOOL)!._meta).toMatchObject({ ui: { visibility: ["app"] } });
      expect(tools.find((t) => t.name === "run_pipeline")!.inputSchema.properties).not.toHaveProperty("fullRefresh");
      const text = async (name: string, args: Record<string, unknown>) => ((await host.callTool({ name, arguments: args })).content as { text: string }[])[0]!.text;
      expect(JSON.parse(await text("describe_pipeline", { pipelineId: "sales" })).datasets[0]).toMatchObject({ name: "clean", primaryKey: ["order_id"] });
      expect(JSON.parse(await text("run_pipeline", { pipelineId: "sales" }))).toMatchObject({ state: "completed", trigger: "agent", startedBy: "agent over MCP" });
      expect(JSON.parse(await text("list_pipelines", {})).pipelines[0].lastRun.state).toBe("completed");
    } finally {
      await host.close();
    }
  });

  it("shows a pipeline and a proposal filled in by the server, and lets the page save what a person approved but never fully refresh", async () => {
    const { memoryPipelines, pipelineDigest } = await import("@surfaces-ui/data");
    const { fromJson } = await import("@bufbuild/protobuf");
    const { PipelineDraftSchema, RefreshKind } = await import("@surfaces-ui/proto");
    const server = new McpServer({ name: "test", version: "0" });
    const pipelines = memoryPipelines([{ summary: { id: "sales", name: "Sales", sourceId: "shop" }, version: 1, datasets: [{ name: "clean", sql: "SELECT * FROM orders", primaryKey: ["order_id"] }] }]);
    registerSurfacesApps(server, { dataSource: memoryDataSource({ sourceId: "shop", tables: { orders: rows } }), pipelines, appHtml: "<!doctype html>" });
    const [a, b] = InMemoryTransport.createLinkedPair();
    const host = new Client({ name: "host", version: "0" });
    await Promise.all([server.connect(a), host.connect(b)]);
    try {
      const shown = await host.callTool({ name: "show_pipeline", arguments: { pipelineId: "sales" } });
      expect(shown.structuredContent).toEqual({ view: "pipeline", pipelineId: "sales", sourceId: "shop" });
      expect((await host.callTool({ name: "show_pipeline", arguments: { pipelineId: "nope" } })).isError).toBe(true);

      // The model gives the dataset; the server fills in the whole pipeline, the version and the digest.
      const proposed = await host.callTool({ name: "propose_dataset", arguments: { pipelineId: "sales", name: "by_region", sql: "SELECT region, COUNT(*) AS n FROM clean GROUP BY region", grain: "one row per region", primaryKey: ["region"], depends: ["clean"] } });
      const view = proposed.structuredContent as Extract<AppView, { view: "datasetReview" }>;
      expect(view).toMatchObject({ view: "datasetReview", dataset: "by_region", expectedVersion: 1, sourceId: "shop", proposedBy: "the agent" });
      const draft = fromJson(PipelineDraftSchema, view.pipeline as never);
      expect(draft.datasets.map((d) => d.name)).toEqual(["clean", "by_region"]);
      expect(view.digest).toBe(await pipelineDigest(draft));
      expect((await pipelines.getPipeline({ id: "sales" })).pipeline!.version).toBe(1);

      // The page saves through its channel; the backend still checks the approver and digest.
      const page = mcpPipelines((name, args) => host.callTool({ name, arguments: args }) as never);
      await expect(page.savePipeline!({ pipeline: draft, expectedVersion: 1, approvedBy: "", approvalDigest: view.digest })).rejects.toThrow(/approv/i);
      expect((await page.savePipeline!({ pipeline: draft, expectedVersion: 1, approvedBy: "Ada", approvalDigest: view.digest })).pipeline!.version).toBe(2);
      expect((await page.getPipeline({ id: "sales" })).pipeline!.datasets.map((d) => d.name)).toContain("by_region");

      // A run pressed in the page is the person's; a full refresh is refused here.
      await expect(page.startRun({ pipelineId: "sales", refreshKind: RefreshKind.FULL_REFRESH, confirmFullRefresh: true })).rejects.toThrow(/full refresh is not offered/);
      const { run } = await page.startRun({ pipelineId: "sales", trigger: "agent", startedBy: "someone else" });
      expect(run).toMatchObject({ trigger: "manual", startedBy: "a person, in the MCP app" });
      expect((await page.listRuns({ pipelineId: "sales" })).runs).toHaveLength(1);
      await expect(page.inspectFiles({})).rejects.toThrow(/not offered/);
    } finally {
      await host.close();
    }
  });
});
