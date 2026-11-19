// @vitest-environment jsdom
import { type DataSource, memoryDataSource } from "@surfaces-ui/data";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { PivotTable, buildPivotQuery } from "./PivotTable.js";

const orders = [
  { region: "EU", status: "open", amount: 10, at: new Date(Date.UTC(2026, 0, 5)) },
  { region: "EU", status: "open", amount: 30, at: new Date(Date.UTC(2026, 1, 5)) },
  { region: "EU", status: "shipped", amount: 5, at: new Date(Date.UTC(2026, 1, 9)) },
  { region: "NA", status: "shipped", amount: 100, at: new Date(Date.UTC(2026, 0, 20)) },
];
const dataSource: DataSource = memoryDataSource({ tables: { orders } });
const sql = "SELECT * FROM orders";

afterEach(cleanup);

const cells = (row: HTMLElement) => within(row).getAllByRole("cell").map((c) => c.textContent);

describe("PivotTable", () => {
  it("crosses rows and columns with totals worked out by the backend", async () => {
    render(
      <PivotTable dataSource={dataSource} sourceId="memory" sql={sql} rows={["region"]} columns={["status"]} measures={[{ column: "amount", aggregate: "avg" }]} />,
    );
    await waitFor(() => expect(screen.getByRole("rowheader", { name: "EU" })).toBeTruthy());
    expect(screen.getAllByRole("columnheader").map((h) => h.textContent)).toEqual(["region", "open", "shipped", "Total"]);
    // The total of an average is the average of all rows, not the sum of the cells.
    expect(cells(screen.getByRole("rowheader", { name: "EU" }).closest("tr")!)).toEqual(["20", "5", "15"]);
    expect(cells(screen.getByRole("rowheader", { name: "NA" }).closest("tr")!)).toEqual(["", "100", "100"]);
    expect(cells(screen.getByRole("rowheader", { name: "Total" }).closest("tr")!)).toEqual(["20", "52.5", "36.25"]);
  });

  it("groups dates by a grain and works without columns", async () => {
    render(
      <PivotTable
        dataSource={dataSource}
        sourceId="memory"
        sql={sql}
        rows={[{ column: "at", grain: "month", label: "Month" }]}
        measures={[{ aggregate: "count", label: "Orders" }, { column: "amount", aggregate: "sum", label: "Revenue" }]}
      />,
    );
    await waitFor(() => expect(screen.getByRole("rowheader", { name: "2026-01" })).toBeTruthy());
    expect(screen.getAllByRole("columnheader").map((h) => h.textContent)).toEqual(["Month", "Orders", "Revenue"]);
    expect(cells(screen.getByRole("rowheader", { name: "2026-02" }).closest("tr")!)).toEqual(["2", "35"]);
    expect(cells(screen.getByRole("rowheader", { name: "Total" }).closest("tr")!)).toEqual(["4", "145"]);
  });

  it("says when column values are left out", async () => {
    render(
      <PivotTable dataSource={dataSource} sourceId="memory" sql={sql} rows={["region"]} columns={["amount"]} measures={[{ aggregate: "count" }]} maxColumns={2} />,
    );
    await waitFor(() => expect(screen.getByText(/first 2 of 4 column values/)).toBeTruthy());
  });

  it("asks the backend to group and sort", () => {
    const query = buildPivotQuery(["region", { column: "at", grain: "month" }], [{ column: "amount", aggregate: "sum" }], { sql, limit: 100 });
    expect(query.groupBy).toEqual(["region"]);
    expect(query.buckets).toHaveLength(1);
    expect(query.sorts).toHaveLength(2);
    expect(query.page).toEqual({ limit: 100 });
  });
});
