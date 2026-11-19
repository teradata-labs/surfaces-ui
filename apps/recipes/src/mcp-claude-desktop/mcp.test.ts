import { Client } from "@modelcontextprotocol/client";
import { InMemoryTransport } from "@modelcontextprotocol/server";
import { memoryDataSource } from "@surfaces-ui/data";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildServer } from "./server.js";

const orders = Array.from({ length: 12 }, (_, i) => ({ order_id: i + 1, region: ["EU", "NA", "APAC"][i % 3]!, amount: 10 + i }));
let client: Client;

beforeAll(async () => {
  // The same registration server.ts runs, over the in-memory data source and a stub page.
  const server = buildServer(memoryDataSource({ sourceId: "shop", tables: { orders } }), "<!doctype html><title>stub</title>");
  const [a, b] = InMemoryTransport.createLinkedPair();
  client = new Client({ name: "host", version: "0" });
  await Promise.all([server.connect(a), client.connect(b)]);
});
afterAll(() => client?.close());

describe("Surfaces as an MCP App", () => {
  it("offers the view tools to the model", async () => {
    const names = (await client.listTools()).tools.map((t) => t.name);
    expect(names).toEqual(expect.arrayContaining(["show_data_grid", "show_chart", "show_pivot_table", "show_query_result", "open_sql_editor", "render_surface", "show_dashboard", "list_tables", "get_component_docs"]));
  });

  it("describes the tables, and shows a grid only after its query has run", async () => {
    const tables = await client.callTool({ name: "list_tables", arguments: {} });
    expect((tables.content as { text: string }[])[0]!.text).toContain("orders(order_id");

    const grid = await client.callTool({ name: "show_data_grid", arguments: { sql: "SELECT * FROM orders", title: "Orders" } });
    expect(grid.structuredContent).toEqual({ view: "grid", sourceId: "shop", sql: "SELECT * FROM orders", title: "Orders" });
    expect((grid.content as { text: string }[])[0]!.text).toBe("Showing a table of 12 rows.");

    const bad = await client.callTool({ name: "show_data_grid", arguments: { sql: "SELECT * FROM missing" } });
    expect(bad.isError).toBe(true);
  });
});
