// @vitest-environment jsdom
import { DataSourceProvider } from "@surfaces-ui/components";
import { memoryDataSource } from "@surfaces-ui/data";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { analyticsCatalog } from "../analytics.js";
import { catalogPrompt } from "../generate.js";
import { A2UI_VERSION } from "../dynamic.js";
import { type SurfaceMessage, applyMessages } from "../surface.js";
import { SurfaceView, analyticsRenderers } from "./index.js";

afterEach(cleanup);

const v = A2UI_VERSION;
const dataSource = memoryDataSource({ tables: { orders: [{ region: "EU", amount: 5, at: new Date(Date.UTC(2026, 0, 5)) }, { region: "NA", amount: 7, at: new Date(Date.UTC(2026, 1, 5)) }] } });
const sql = "SELECT * FROM orders";
const failing = "SELECT * FROM missing";
const nothing = [{ column: "region", op: "eq", values: ["Mars"] }];
const empty = "No orders from this region yet.";
const failed = "We could not load the orders. Try again in a minute.";

/** Each data component in the catalog, with what it needs besides the query. */
const components: Record<string, Record<string, unknown>> = {
  Chart: { type: "bar", x: "region", y: [{ column: "amount", aggregate: "sum" }] },
  DataGrid: {},
  PivotTable: { rows: ["region"], measures: [{ column: "amount", aggregate: "sum" }] },
  Metric: { column: "amount", aggregate: "sum", label: "Revenue" },
  Sparkline: { x: "at", grain: "month", column: "amount", aggregate: "sum", label: "Revenue" },
  BulletGraph: { column: "amount", aggregate: "sum", label: "Revenue", ranges: [{ to: 10, label: "Poor" }, { to: 20, label: "Good" }] },
  QueryResult: {},
  RowList: { label: "Orders", child: "order" },
};

const draw = (component: Record<string, unknown>, data?: unknown) => {
  const messages: SurfaceMessage[] = [
    { version: v, createSurface: { surfaceId: "main", catalogId: analyticsCatalog.id } },
    {
      version: v,
      updateComponents: {
        surfaceId: "main",
        components: [
          { id: "root", component: "Column", children: ["data"] },
          { id: "data", ...component } as never,
          { id: "order", component: "Text", text: { "@path": "region" } } as never,
        ],
      },
    },
  ];
  if (data !== undefined) messages.push({ version: v, updateDataModel: { surfaceId: "main", path: "/", value: data } });
  return render(
    <DataSourceProvider dataSource={dataSource}>
      <SurfaceView surface={applyMessages({}, messages).main!} catalog={analyticsCatalog} renderers={analyticsRenderers} />
    </DataSourceProvider>,
  );
};

describe.each(Object.entries(components))("%s in the catalog", (name, rest) => {
  const base = { component: name, sourceId: "memory", sql, ...rest };

  it("takes an empty message and an error message, and nothing else under those names", () => {
    expect(analyticsCatalog.validateComponent({ id: "data", ...base, emptyMessage: empty, errorMessage: failed })).toEqual([]);
    expect(analyticsCatalog.validateComponent({ id: "data", ...base, emptyMessage: { "@path": "/copy/empty" } })).toEqual([]);
    expect(analyticsCatalog.validateComponent({ id: "data", ...base, errorMessage: 42 })).not.toEqual([]);
  });

  it("draws the empty message when the query answers with no rows", async () => {
    draw({ ...base, filters: nothing, emptyMessage: empty });
    expect(await screen.findByText(empty)).toBeTruthy();
  });

  it("draws the error message when the query fails, keeping the engine's text on the alert", async () => {
    draw({ ...base, sql: failing, errorMessage: failed });
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toBe(failed);
    expect(alert.getAttribute("data-error")).toMatch(/Table not found/);
  });
});

describe("messages from the data model", () => {
  it("reads a bound message, so the words can be kept apart from the page", async () => {
    draw({ component: "DataGrid", sourceId: "memory", sql: failing, errorMessage: { "@path": "/copy/failed" } }, { copy: { failed } });
    expect((await screen.findByRole("alert")).textContent).toBe(failed);
  });

  it("describes both props in the agent prompt", () => {
    const prompt = catalogPrompt(analyticsCatalog);
    expect(prompt).toContain("emptyMessage");
    expect(prompt).toContain("errorMessage");
  });
});
