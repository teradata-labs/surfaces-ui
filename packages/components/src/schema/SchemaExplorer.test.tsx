// @vitest-environment jsdom
import { memoryDataSource } from "@surfaces-ui/data";
import { FilterOperator } from "@surfaces-ui/proto";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { Field, Float64, Int32, TimestampMillisecond, Utf8 } from "apache-arrow";
import { afterEach, describe, expect, it, vi } from "vitest";
import { FilterBar, toValue } from "../filter/FilterBar.js";
import { SCHEMA_REF_MIME, SchemaExplorer } from "./SchemaExplorer.js";

afterEach(cleanup);

const source = memoryDataSource({
  tables: {
    orders: [{ order_id: 1, region: "EU", amount: 9.5 }],
    customers: [{ customer_id: 1, name: "Ada" }],
    ...Object.fromEntries(Array.from({ length: 500 }, (_, i) => [`t_${i}`, [{ a: i }]])),
  },
});

describe("SchemaExplorer", () => {
  it("lists tables, renders only what is visible, and opens columns on demand", async () => {
    const onSelect = vi.fn();
    render(<SchemaExplorer dataSource={source} sourceId="memory" height={300} onSelect={onSelect} />);
    const orders = await screen.findByText("orders");
    expect(document.querySelectorAll(".sf-schema-row").length).toBeLessThan(30);
    fireEvent.click(orders);
    expect(await screen.findByText("order_id")).toBeTruthy();
    expect(screen.getByText("1 rows")).toBeTruthy();
    expect(onSelect).toHaveBeenCalledWith({ sourceId: "memory", table: "orders" }, expect.anything());
    expect(orders.closest("[role=treeitem]")!.getAttribute("aria-expanded")).toBe("true");
  });

  it("searches on the backend and reports no matches", async () => {
    render(<SchemaExplorer dataSource={source} sourceId="memory" />);
    await screen.findByText("orders");
    fireEvent.change(screen.getByLabelText("Search tables"), { target: { value: "cust" } });
    await waitFor(() => expect(screen.queryByText("orders")).toBeNull());
    expect(screen.getByText("customers")).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Search tables"), { target: { value: "zzz" } });
    expect(await screen.findByText("No tables match “zzz”.")).toBeTruthy();
  });

  it("supports the keyboard, insert and drag", async () => {
    const onInsert = vi.fn();
    render(<SchemaExplorer dataSource={source} sourceId="memory" onInsert={onInsert} />);
    await screen.findByText("orders");
    const tree = screen.getByRole("tree");
    fireEvent.keyDown(tree, { key: "ArrowRight" });
    expect(await screen.findByText("order_id")).toBeTruthy();
    fireEvent.keyDown(tree, { key: "ArrowDown" });
    fireEvent.keyDown(tree, { key: "Insert" });
    expect(onInsert).toHaveBeenCalledWith("order_id", { sourceId: "memory", table: "orders", column: "order_id" });
    const data: Record<string, string> = {};
    fireEvent.dragStart(screen.getByText("region").closest("[draggable]")!, {
      dataTransfer: { setData: (type: string, value: string) => (data[type] = value), effectAllowed: "" },
    });
    expect(data["text/plain"]).toBe("region");
    expect(JSON.parse(data[SCHEMA_REF_MIME]!)).toEqual({ sourceId: "memory", table: "orders", column: "region" });
  });
});

describe("FilterBar", () => {
  const fields = [new Field("region", new Utf8()), new Field("amount", new Float64()), new Field("qty", new Int32()), new Field("at", new TimestampMillisecond())];

  it("adds a typed filter and removes it", () => {
    const onChange = vi.fn();
    const { rerender } = render(<FilterBar fields={fields} filters={[]} onChange={onChange} />);
    fireEvent.change(screen.getByLabelText("Column"), { target: { value: "qty" } });
    fireEvent.change(screen.getByLabelText("Comparison"), { target: { value: String(FilterOperator.GTE) } });
    fireEvent.change(screen.getByLabelText("Value"), { target: { value: "x" } });
    fireEvent.click(screen.getByRole("button", { name: "Add filter" }));
    expect(screen.getByRole("alert").textContent).toBe("Enter a whole number.");
    expect(onChange).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText("Value"), { target: { value: "5" } });
    fireEvent.click(screen.getByRole("button", { name: "Add filter" }));
    const added = [{ column: "qty", operator: FilterOperator.GTE, values: [{ kind: { case: "intValue" as const, value: 5n } }] }];
    expect(onChange).toHaveBeenCalledWith(added);
    rerender(<FilterBar fields={fields} filters={added} onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: "Remove filter qty ≥ 5" }));
    expect(onChange).toHaveBeenLastCalledWith([]);
  });

  it("hides the value for emptiness checks and converts values by type", () => {
    render(<FilterBar fields={fields} filters={[]} onChange={() => {}} />);
    fireEvent.change(screen.getByLabelText("Comparison"), { target: { value: String(FilterOperator.IS_NULL) } });
    expect(screen.queryByLabelText("Value")).toBeNull();
    expect(toValue("1.5", new Float64())).toEqual({ kind: { case: "doubleValue", value: 1.5 } });
    expect(toValue("2026-01-31", new TimestampMillisecond())).toEqual({ kind: { case: "temporalValue", value: "2026-01-31" } });
    expect(() => toValue("soon", new TimestampMillisecond())).toThrow(/date/);
  });
});
