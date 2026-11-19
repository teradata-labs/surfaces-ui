// @vitest-environment jsdom
import { create } from "@bufbuild/protobuf";
import { DataSourceProvider } from "@surfaces-ui/components";
import { type DataSource, memoryDataSource } from "@surfaces-ui/data";
import { ExecuteRequestSchema, type ViewQuery } from "@surfaces-ui/proto";
import { createViewState } from "@surfaces-ui/state";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { Dashboard } from "./Dashboard.js";

afterEach(cleanup);

// jsdom has no canvas. ECharts only needs a 2D context that accepts calls; nothing here reads pixels.
HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement) {
  const state: Record<string | symbol, unknown> = { canvas: this };
  return new Proxy(state, {
    get: (target, key) => (key in target ? target[key] : key === "measureText" ? (text: string) => ({ width: text.length * 6 }) : () => ({ addColorStop() {} })),
    set: (target, key, value) => ((target[key] = value), true),
  });
} as unknown as typeof HTMLCanvasElement.prototype.getContext;

const regions = ["Europe", "Americas", "Asia Pacific"];
const statuses = ["shipped", "returned", "pending"];
const orders = Array.from({ length: 60 }, (_, i) => ({
  order_id: i + 1,
  region: regions[i % 3]!,
  status: statuses[i % 4 === 0 ? 1 : i % 5 === 0 ? 2 : 0]!,
  amount: 10 + (i % 7) * 5,
  ordered_at: new Date(Date.UTC(2026, i % 6, 1 + (i % 20))),
}));

/** The in-memory backend, with every query the dashboard sends written down. */
function recorded() {
  const inner = memoryDataSource({ sourceId: "shop", tables: { orders } });
  const queries: ViewQuery[] = [];
  const dataSource: DataSource = {
    ...inner,
    execute(request, options) {
      queries.push(create(ExecuteRequestSchema, request).query!);
      return inner.execute(request, options);
    },
  };
  return { dataSource, queries };
}

const filterColumns = (query: ViewQuery) => query.filters.map((f) => f.column).sort();
/** The latest query grouped by a column: the chart for that column. */
const chartQuery = (queries: ViewQuery[], column: string) => queries.filter((q) => q.groupBy.includes(column)).at(-1);
/** The latest query for table rows: the grid. */
const gridQuery = (queries: ViewQuery[]) => queries.filter((q) => q.aggregates.length === 0 && q.groupBy.length === 0).at(-1);

describe("a cross-filtered dashboard", () => {
  it("filters every other view by a selection, but never the chart that made it", async () => {
    const { dataSource, queries } = recorded();
    const view = createViewState();
    render(
      <DataSourceProvider dataSource={dataSource}>
        <Dashboard sourceId="shop" sql="SELECT * FROM orders" view={view} />
      </DataSourceProvider>,
    );
    await waitFor(() => expect(chartQuery(queries, "region") && chartQuery(queries, "status") && gridQuery(queries)).toBeTruthy());
    // The charts ask the engine to summarise; nothing is grouped in the browser.
    expect(chartQuery(queries, "region")!.aggregates[0]!.column).toBe("amount");

    // What a click on the "Europe" bar does.
    const before = queries.length;
    act(() => view.toggle("region", "Europe"));
    await waitFor(() => expect(gridQuery(queries.slice(before))).toBeTruthy());
    const after = queries.slice(before);

    expect(filterColumns(gridQuery(after)!)).toEqual(["region"]);
    expect(gridQuery(after)!.filters[0]!.values[0]!.kind.value).toBe("Europe");
    expect(filterColumns(chartQuery(after, "status")!)).toEqual(["region"]);
    // The region chart is not asked again with a region filter: its bars stay.
    expect(after.filter((q) => q.groupBy.includes("region")).every((q) => !filterColumns(q).includes("region"))).toBe(true);
    expect(filterColumns(chartQuery(queries, "region")!)).toEqual([]);
    // Headline numbers and their comparisons follow the filter too.
    const headline = after.filter((q) => q.groupBy.length === 0 && q.aggregates.length > 0);
    expect(headline.length).toBeGreaterThan(0);
    expect(headline.every((q) => filterColumns(q).includes("region"))).toBe(true);
  });

  it("removes a filter, or all of them, with buttons", async () => {
    const { dataSource, queries } = recorded();
    const view = createViewState();
    render(<Dashboard sourceId="shop" sql="SELECT * FROM orders" view={view} />, {
      wrapper: ({ children }) => <DataSourceProvider dataSource={dataSource}>{children}</DataSourceProvider>,
    });
    act(() => {
      view.toggle("region", "Europe");
      view.toggle("status", "returned");
    });
    await waitFor(() => expect(filterColumns(gridQuery(queries)!)).toEqual(["region", "status"]));
    // The status chart leaves out status but keeps region.
    await waitFor(() => expect(filterColumns(chartQuery(queries, "status")!)).toEqual(["region"]));

    fireEvent.click(screen.getByRole("button", { name: "Remove filter region is Europe" }));
    await waitFor(() => expect(filterColumns(gridQuery(queries)!)).toEqual(["status"]));
    expect(view.get().selections).toEqual({ status: ["returned"] });

    fireEvent.click(screen.getByRole("button", { name: "Clear filters" }));
    await waitFor(() => expect(filterColumns(gridQuery(queries)!)).toEqual([]));
    expect((screen.getByRole("button", { name: "Clear filters" }) as HTMLButtonElement).disabled).toBe(true);
  });
});
