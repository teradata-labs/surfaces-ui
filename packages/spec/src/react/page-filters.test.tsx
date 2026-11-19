// @vitest-environment jsdom
import { DataSourceProvider } from "@surfaces-ui/components";
import { memoryDataSource } from "@surfaces-ui/data";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { analyticsCatalog } from "../analytics.js";
import { type PageDocument, pageSurface, validatePage } from "../page.js";
import { SurfaceView, analyticsRenderers } from "./index.js";

afterEach(cleanup);

const dataSource = memoryDataSource({
  tables: {
    orders: [
      { region: "EU", status: "open", amount: 5 },
      { region: "NA", status: "open", amount: 7 },
      { region: "EU", status: "closed", amount: 9 },
    ],
  },
});
const shared = { "@path": "/filters" };
const page = (filters: unknown[]): PageDocument => ({
  id: "filtered",
  title: "Filtered",
  catalogId: analyticsCatalog.id,
  components: [
    { id: "root", component: "Column", children: ["bar", "table"] },
    { id: "bar", component: "FilterBar", sourceId: "memory", sql: "SELECT * FROM orders", filters: shared, columns: ["region", "status"], action: { event: { name: "filtered" } } },
    { id: "table", component: "DataGrid", sourceId: "memory", sql: "SELECT * FROM orders", filters: shared, height: 300 },
  ],
  data: { filters },
});
const cells = () => screen.getAllByRole("gridcell").map((c) => c.textContent);

describe("what a person does is told as context", () => {
  it("sends a note per action with the component it happened in, and starts no turn", async () => {
    const onAction = vi.fn();
    const onContext = vi.fn();
    const quiet = { ...page([{ column: "region", op: "eq", values: ["EU"] }]) };
    // No action on the bar: nothing is sent to the agent, and the note is the only word of what happened.
    quiet.components = quiet.components.map((c) => (c.id === "bar" ? { ...c, action: undefined } : c)).map(({ action, ...rest }) => (action === undefined ? rest : { ...rest, action })) as typeof quiet.components;
    render(
      <DataSourceProvider dataSource={dataSource}>
        <SurfaceView surface={pageSurface(quiet)} catalog={analyticsCatalog} renderers={analyticsRenderers} onAction={onAction} onContext={onContext} />
      </DataSourceProvider>,
    );
    await waitFor(() => expect(cells()).toHaveLength(6));
    fireEvent.click(screen.getByRole("button", { name: "Remove filter region is EU" }));
    expect(onContext).toHaveBeenLastCalledWith("bar", { kind: "filter.changed", summary: "Cleared every filter.", subject: { filters: [] } });
    fireEvent.change(screen.getByLabelText("Column"), { target: { value: "status" } });
    fireEvent.change(screen.getByLabelText("Value"), { target: { value: "closed" } });
    fireEvent.click(screen.getByRole("button", { name: "Add filter" }));
    expect(onContext).toHaveBeenLastCalledWith("bar", expect.objectContaining({ kind: "filter.changed", summary: "Filters are now: status contains closed." }));
    expect(onAction).not.toHaveBeenCalled();
  });
});

describe("page-wide filters", () => {
  it("are valid as a list or as a path, with relative ranges, and refused otherwise", () => {
    expect(validatePage(page([]), analyticsCatalog)).toEqual([]);
    const chart = { id: "c", component: "Chart", sourceId: "memory", sql: "SELECT * FROM orders", type: "bar", x: "region", y: [{ column: "amount", aggregate: "sum" }] };
    expect(analyticsCatalog.validateComponent({ ...chart, filters: shared, select: shared })).toEqual([]);
    expect(analyticsCatalog.validateComponent({ ...chart, filters: [{ column: "ordered_at", op: "since", values: ["30d"] }] })).toEqual([]);
    expect(analyticsCatalog.validateComponent({ ...chart, filters: { somewhere: "/filters" } })).not.toEqual([]);
    expect(analyticsCatalog.validateComponent({ ...chart, select: "/filters" })).not.toEqual([]);
    // A filter bar must say where it keeps its list.
    expect(analyticsCatalog.validateComponent({ id: "bar", component: "FilterBar", sourceId: "memory", sql: "SELECT * FROM orders" })).not.toEqual([]);
  });

  it("start from the page's data, and every view bound to the path follows the bar", async () => {
    const onAction = vi.fn();
    render(
      <DataSourceProvider dataSource={dataSource}>
        <SurfaceView surface={pageSurface(page([{ column: "region", op: "eq", values: ["EU"] }]))} catalog={analyticsCatalog} renderers={analyticsRenderers} onAction={onAction} />
      </DataSourceProvider>,
    );
    await waitFor(() => expect(cells()).toEqual(["EU", "open", "5", "EU", "closed", "9"]));
    expect(screen.getByText("region is EU")).toBeTruthy();
    // Only the columns the page offers can be filtered.
    await waitFor(() => expect(Array.from(screen.getByLabelText("Column").querySelectorAll("option")).map((o) => o.textContent)).toEqual(["region", "status"]));

    // Taking the chip off clears the filter for the grid too, and tells the agent the whole list.
    fireEvent.click(screen.getByRole("button", { name: "Remove filter region is EU" }));
    await waitFor(() => expect(cells()).toHaveLength(9));
    expect(onAction).toHaveBeenLastCalledWith(expect.objectContaining({ name: "filtered", context: { filters: [] } }));

    // Adding one in the bar filters the grid.
    fireEvent.change(screen.getByLabelText("Column"), { target: { value: "status" } });
    fireEvent.change(screen.getByLabelText("Value"), { target: { value: "closed" } });
    fireEvent.click(screen.getByRole("button", { name: "Add filter" }));
    await waitFor(() => expect(cells()).toEqual(["EU", "closed", "9"]));
    expect(onAction).toHaveBeenLastCalledWith(expect.objectContaining({ context: { filters: [{ column: "status", op: "contains", values: ["closed"] }] } }));
  });

  it("shows a relative range as words and keeps it relative in the page's data", async () => {
    render(
      <DataSourceProvider dataSource={dataSource}>
        <SurfaceView
          surface={pageSurface({ ...page([{ column: "ordered_at", op: "since", values: ["30d"] }]), components: page([]).components.filter((c) => c.id !== "table").map((c) => (c.id === "root" ? { ...c, children: ["bar"] } : c)) })}
          catalog={analyticsCatalog}
          renderers={analyticsRenderers}
        />
      </DataSourceProvider>,
    );
    expect(screen.getByText("ordered_at: last 30 days")).toBeTruthy();
    expect(screen.queryByText(/2026-/)).toBeNull();
  });
});
