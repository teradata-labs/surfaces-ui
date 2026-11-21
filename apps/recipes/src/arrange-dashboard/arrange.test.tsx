// @vitest-environment jsdom
import { DataSourceProvider } from "@surfaces-ui/components";
import { memoryDataSource } from "@surfaces-ui/data";
import { type PageDocument, analyticsCatalog } from "@surfaces-ui/spec";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { ArrangeableDashboard } from "./ArrangeableDashboard.js";

afterEach(cleanup);

const sql = "SELECT * FROM orders";
const page: PageDocument = {
  id: "sales",
  title: "Sales",
  catalogId: analyticsCatalog.id,
  components: [
    { id: "root", component: "Column", children: ["title", "numbers"] },
    { id: "title", component: "Text", text: "Sales", variant: "h1" },
    { id: "numbers", component: "Grid", columns: 2, children: ["revenue", "orders"] },
    { id: "revenue", component: "Metric", sourceId: "shop", sql, column: "amount", aggregate: "sum", label: "Revenue" },
    { id: "orders", component: "Metric", sourceId: "shop", sql, aggregate: "count", label: "Orders" },
  ],
};
const data = memoryDataSource({ sourceId: "shop", tables: { orders: [{ id: 1, amount: 10 }, { id: 2, amount: 32 }] } });
const children = (p: PageDocument, id: string) => p.components.find((c) => c.id === id)?.children;

describe("a dashboard a person can arrange", () => {
  it("moves and removes components by their controls, keeps each change as a page edit, and undoes it", async () => {
    const pages: PageDocument[] = [];
    render(
      <DataSourceProvider dataSource={data}>
        <ArrangeableDashboard initial={page} onChange={(next) => pages.push(next)} />
      </DataSourceProvider>,
    );
    // Off by default: the page is drawn as saved, with no frames.
    expect(document.querySelector(".sf-arrange-frame")).toBeNull();

    // While viewing, the line between the two numbers still sizes them: one key press is one step.
    const line = screen.getByRole("separator", { name: "Resize Metric revenue and what is to its right: wider or narrower" });
    expect(line.getAttribute("aria-valuenow")).toBe("50");
    fireEvent.keyDown(line, { key: "ArrowRight" });
    await waitFor(() => expect(pages.at(-1)!.components.find((c) => c.id === "numbers")?.widths).toEqual([0.54, 0.46]));
    fireEvent.keyDown(screen.getByRole("separator", { name: /Resize Metric revenue/ }), { key: "Enter" });
    await waitFor(() => expect(pages.at(-1)!.components.find((c) => c.id === "numbers")?.widths).toEqual([0.5, 0.5]));
    fireEvent.click(screen.getByRole("button", { name: "Arrange" }));
    expect(screen.getByRole("button", { name: "Done arranging" })).toHaveProperty("ariaPressed", "true");

    // The same controls a report's tiles have: move "orders" earlier in its grid.
    fireEvent.click(screen.getByRole("button", { name: "Move Metric orders earlier" }));
    await waitFor(() => expect(children(pages.at(-1)!, "numbers")).toEqual(["orders", "revenue"]));
    expect(screen.getByRole("status").textContent).toContain('Moved "orders" earlier');

    // Removing takes it off the page, not just out of its container.
    fireEvent.click(screen.getByRole("button", { name: "Remove Text title" }));
    await waitFor(() => expect(pages.at(-1)!.components.some((c) => c.id === "title")).toBe(false));
    expect(children(pages.at(-1)!, "root")).toEqual(["numbers"]);

    // Each change was one step.
    fireEvent.click(screen.getByRole("button", { name: "Undo" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Remove Text title" })).toBeTruthy());
  });
});
