// @vitest-environment jsdom
import { type DataSource, memoryDataSource } from "@surfaces-ui/data";
import { FilterOperator } from "@surfaces-ui/proto";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import type { ReactElement } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { BulletGraph } from "../chart/BulletGraph.js";
import { Chart } from "../chart/Chart.js";
import { Sparkline } from "../chart/Sparkline.js";
import { DataGrid } from "../grid/DataGrid.js";
import { Metric } from "../metric/Metric.js";
import { PivotTable } from "../pivot/PivotTable.js";
import { QueryResult } from "../result/QueryResult.js";
import { RowList } from "../rows/RowList.js";
import type { FilterInit } from "./useRowWindow.js";
import type { DataMessages } from "./messages.js";

const orders = [
  { region: "EU", amount: 10, at: new Date(Date.UTC(2026, 0, 5)) },
  { region: "NA", amount: 30, at: new Date(Date.UTC(2026, 1, 5)) },
];
const dataSource: DataSource = memoryDataSource({ tables: { orders } });
const sql = "SELECT * FROM orders";
const failing = "SELECT * FROM missing";
/** Leaves no rows: no order is from Mars. */
const nothing: FilterInit[] = [{ column: "region", operator: FilterOperator.EQ, values: [{ kind: { case: "stringValue", value: "Mars" } }] }];
const empty = "No orders from this region yet.";
const failed = "We could not load the orders. Try again in a minute.";

afterEach(cleanup);

/** Each data component, drawn over `sql` with `filters` and the messages given. */
const components: Record<string, (query: { sql: string; filters?: FilterInit[] } & DataMessages) => ReactElement> = {
  Chart: (q) => <Chart dataSource={dataSource} sourceId="memory" {...q} type="bar" x="region" y={[{ column: "amount", aggregate: "sum" }]} />,
  DataGrid: (q) => <DataGrid dataSource={dataSource} sourceId="memory" {...q} />,
  PivotTable: (q) => <PivotTable dataSource={dataSource} sourceId="memory" {...q} rows={["region"]} measures={[{ column: "amount", aggregate: "sum" }]} />,
  Metric: (q) => <Metric dataSource={dataSource} sourceId="memory" {...q} column="amount" aggregate="sum" label="Revenue" />,
  Sparkline: (q) => <Sparkline dataSource={dataSource} sourceId="memory" {...q} x="at" grain="month" column="amount" aggregate="sum" label="Revenue" />,
  BulletGraph: (q) => (
    <BulletGraph dataSource={dataSource} sourceId="memory" {...q} column="amount" aggregate="sum" label="Revenue" ranges={[{ to: 50, label: "Poor" }, { to: 100, label: "Good" }]} />
  ),
  RowList: (q) => <RowList dataSource={dataSource} sourceId="memory" {...q} label="Orders" renderRow={(row) => <span>{String(row.region)}</span>} />,
  QueryResult: (q) => <QueryResult dataSource={dataSource} sourceId="memory" {...q} />,
};

describe.each(Object.entries(components))("%s", (_, draw) => {
  it("says the page's own words when the query answers with no rows", async () => {
    render(draw({ sql, filters: nothing, emptyMessage: empty }));
    expect(await screen.findByText(empty)).toBeTruthy();
  });

  it("says the page's own words when the query fails, keeping the engine's text on the alert", async () => {
    render(draw({ sql: failing, errorMessage: failed }));
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toBe(failed);
    expect(alert.getAttribute("data-error")).toMatch(/Table not found/);
  });
});

describe("without messages", () => {
  it("keeps the component's own empty text and the engine's error", async () => {
    render(<DataGrid dataSource={dataSource} sourceId="memory" sql={failing} />);
    expect((await screen.findByRole("alert")).textContent).toMatch(/Table not found/);
    cleanup();
    render(<PivotTable dataSource={dataSource} sourceId="memory" sql={sql} filters={nothing} rows={["region"]} measures={[{ column: "amount", aggregate: "sum" }]} />);
    expect(await screen.findByText("No rows match.")).toBeTruthy();
  });

  it("says the empty message in the words read out for a sparkline and a bullet graph", async () => {
    render(components.Sparkline!({ sql, filters: nothing, emptyMessage: empty }));
    await waitFor(() => screen.getByRole("img", { name: `Revenue: ${empty}` }));
    cleanup();
    render(components.BulletGraph!({ sql, filters: nothing, emptyMessage: empty }));
    await waitFor(() => screen.getByRole("img", { name: `Revenue: ${empty}` }));
  });
});
