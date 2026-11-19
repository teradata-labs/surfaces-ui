// @vitest-environment jsdom
import { type DescMessage, fromJson, toJson } from "@bufbuild/protobuf";
import { DataGrid } from "@surfaces-ui/components";
import { type DataSource, QueryError, collect, memoryDataSource, queryErrorInfo, toRows } from "@surfaces-ui/data";
import {
  CountRequestSchema,
  CountResponseSchema,
  DescribeTableRequestSchema,
  DescribeTableResponseSchema,
  ExecuteRequestSchema,
  FilterOperator,
  ListSourcesRequestSchema,
  ListSourcesResponseSchema,
  ListTablesRequestSchema,
  ListTablesResponseSchema,
  SortDirection,
} from "@surfaces-ui/proto";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { tableToIPC } from "apache-arrow";
import { afterEach, describe, expect, it } from "vitest";
import { withSourceAllowList } from "./allowList.js";
import { httpDataSource } from "./httpDataSource.js";

afterEach(cleanup);

const orders = Array.from({ length: 30 }, (_, i) => ({ order_id: i + 1, region: i % 2 ? "Europe" : "Americas", amount: (i * 37) % 100 }));

/**
 * Plays your server: it reads the request, runs it on an in-memory backend
 * and answers in the wire format the adapter expects. Every body it receives
 * is kept, so the test can see what the browser sent.
 */
function fakeServer() {
  const backend = memoryDataSource({ sourceId: "shop", tables: { orders } });
  const bodies: { path: string; body: any; auth: string | null }[] = [];
  const unary: Record<string, [DescMessage, DescMessage, (request: any) => Promise<any>]> = {
    "/count": [CountRequestSchema, CountResponseSchema, (r) => backend.count(r)],
    "/sources": [ListSourcesRequestSchema, ListSourcesResponseSchema, (r) => backend.listSources(r)],
    "/tables": [ListTablesRequestSchema, ListTablesResponseSchema, (r) => backend.listTables(r)],
    "/describe": [DescribeTableRequestSchema, DescribeTableResponseSchema, (r) => backend.describeTable(r)],
  };
  const fetch: typeof globalThis.fetch = async (input, init) => {
    const path = new URL(String(input)).pathname.replace(/^\/api/, "");
    const body = JSON.parse(String(init?.body));
    bodies.push({ path, body, auth: new Headers(init?.headers).get("authorization") });
    try {
      if (path === "/query") {
        const request = fromJson(ExecuteRequestSchema, body);
        if (/\bFORM\b/.test(request.query?.baseSql ?? "")) {
          return Response.json({ message: 'Syntax error near "FORM"', code: "SYNTAX", line: 1, column: 10 }, { status: 400 });
        }
        const result = await collect(backend.execute(request));
        return new Response(new Uint8Array(tableToIPC(result.table, "stream")), {
          headers: { "content-type": "application/vnd.apache.arrow.stream", "x-truncated": String(result.footer.truncated), "x-executed-sql": encodeURIComponent(result.header.executedSql) },
        });
      }
      const [requestSchema, responseSchema, handle] = unary[path]!;
      return Response.json(toJson(responseSchema, await handle(fromJson(requestSchema, body))));
    } catch (error) {
      return Response.json({ message: (error as Error).message }, { status: 400 });
    }
  };
  return { fetch, bodies };
}

describe("a DataSource over your own HTTP API", () => {
  it("sends the whole ViewQuery to the server and reads back only that window", async () => {
    const server = fakeServer();
    const data = httpDataSource({ baseUrl: "https://example.test/api", fetch: server.fetch, headers: () => ({ authorization: "Bearer test-session" }) });
    const result = await collect(
      data.execute({
        sourceId: "shop",
        query: {
          baseSql: "SELECT * FROM orders",
          filters: [{ column: "region", operator: FilterOperator.EQ, values: [{ kind: { case: "stringValue", value: "Europe" } }] }],
          sorts: [{ column: "amount", direction: SortDirection.DESC }],
          page: { limit: 3, offset: 2n },
        },
      }),
    );

    // The server did the work: the browser got three rows, already filtered, sorted and paged.
    const europe = orders.filter((o) => o.region === "Europe").sort((a, b) => b.amount - a.amount);
    expect(toRows(result.table).map((r) => r.order_id)).toEqual(europe.slice(2, 5).map((o) => o.order_id));
    expect(result.footer.truncated).toBe(true);
    expect(result.header.executedSql).toBe("SELECT * FROM orders");

    const sent = server.bodies[0]!;
    expect(sent.path).toBe("/query");
    expect(sent.auth).toBe("Bearer test-session");
    expect(sent.body.query.filters).toEqual([{ column: "region", operator: "FILTER_OPERATOR_EQ", values: [{ stringValue: "Europe" }] }]);
    expect(sent.body.query.sorts).toEqual([{ column: "amount", direction: "SORT_DIRECTION_DESC" }]);
    expect(sent.body.query.page).toEqual({ limit: 3, offset: "2" });
  });

  it("drives a real DataGrid, which asks the server for a sorted page", async () => {
    const server = fakeServer();
    const data = httpDataSource({ baseUrl: "https://example.test/api", fetch: server.fetch });
    render(<DataGrid dataSource={data} sourceId="shop" sql="SELECT * FROM orders" sorts={[{ column: "amount", desc: true }]} height={300} rowHeight={20} />);
    await waitFor(() => expect(document.querySelectorAll(".sf-grid-row").length).toBeGreaterThan(0));
    const top = Math.max(...orders.map((o) => o.amount));
    expect(document.querySelector(".sf-grid-row")!.textContent).toContain(String(top));
    const query = server.bodies.find((b) => b.path === "/query")!.body.query;
    expect(query.sorts).toEqual([{ column: "amount", direction: "SORT_DIRECTION_DESC" }]);
    expect(query.page.limit).toBeGreaterThan(0);
  });

  it("answers catalog calls from JSON endpoints", async () => {
    const server = fakeServer();
    const data = httpDataSource({ baseUrl: "https://example.test/api", fetch: server.fetch });
    expect((await data.listSources({})).sources.map((s) => s.id)).toEqual(["shop"]);
    expect((await data.listTables({ sourceId: "shop" })).tables.map((t) => t.ref?.table)).toEqual(["orders"]);
    const detail = await data.describeTable({ sourceId: "shop", ref: { table: "orders" } });
    expect(detail.table?.columns.map((c) => c.name)).toEqual(["order_id", "region", "amount"]);
    expect((await data.count({ sourceId: "shop", query: { baseSql: "SELECT * FROM orders" } })).rowCount).toBe(30n);
  });

  it("turns failures into messages a person can read", async () => {
    const server = fakeServer();
    const data = httpDataSource({ baseUrl: "https://example.test/api", fetch: server.fetch });

    const syntax = await collect(data.execute({ sourceId: "shop", query: { baseSql: "SELECT * FORM orders" } })).catch((e: unknown) => e);
    expect(syntax).toBeInstanceOf(QueryError);
    expect(queryErrorInfo(syntax)).toEqual({ message: 'Syntax error near "FORM"', code: "SYNTAX", line: 1, column: 10 });

    const missing = await collect(data.execute({ sourceId: "shop", query: { baseSql: "SELECT * FROM nope" } })).catch((e: unknown) => e);
    expect(queryErrorInfo(missing).message).toBe("Table not found: nope");

    const down = httpDataSource({ baseUrl: "https://example.test/api", fetch: async () => new Response("<html>Bad gateway</html>", { status: 502, statusText: "Bad Gateway" }) });
    await expect(down.listSources({})).rejects.toThrow("The data service answered 502 Bad Gateway.");

    const unreachable = httpDataSource({ baseUrl: "https://example.test/api", fetch: async () => Promise.reject(new TypeError("fetch failed")) });
    await expect(unreachable.listSources({})).rejects.toThrow("Could not reach the data service: fetch failed");

    await expect(data.explain({ sourceId: "shop", query: { baseSql: "SELECT * FROM orders" } })).rejects.toThrow("does not explain queries");
  });
});

describe("withSourceAllowList", () => {
  it("refuses other sources and hides them from the list", async () => {
    const backend: DataSource = memoryDataSource({ sourceId: "shop", tables: { orders } });
    const onlyShop = withSourceAllowList(backend, ["shop"]);
    expect((await collect(onlyShop.execute({ sourceId: "shop", query: { baseSql: "SELECT * FROM orders" } }))).table.numRows).toBe(30);
    await expect(collect(onlyShop.execute({ sourceId: "hr", query: { baseSql: "SELECT * FROM people" } }))).rejects.toThrow('The source "hr" is not available here.');
    await expect(onlyShop.listTables({ sourceId: "hr" })).rejects.toThrow("not available here");
    expect((await withSourceAllowList(backend, ["hr"]).listSources({})).sources).toEqual([]);
  });
});
