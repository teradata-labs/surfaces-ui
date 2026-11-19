// @vitest-environment jsdom
import { memoryDataSource } from "@surfaces-ui/data";
import { createDiscovery } from "@surfaces-ui/discovery";
import { CertificationStatus, ObjectKind } from "@surfaces-ui/proto";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ObjectBrowser, joinClause } from "./ObjectBrowser.js";
import { readDataRefs } from "./refs.js";
import { SCHEMA_REF_MIME } from "./SchemaExplorer.js";

afterEach(cleanup);

const dataSource = memoryDataSource({
  sourceId: "shop",
  tables: {
    orders: [{ order_id: 1, customer_id: 1, amount: 9.5 }],
    customers: [{ customer_id: 1, region_id: 1, name: "Ada" }],
    regions: [{ region_id: 1, label: "EU" }],
  },
});
const row = (name: string, index = 0) => screen.getAllByText(name)[index]!.closest("[role=treeitem]") as HTMLElement;

describe("ObjectBrowser", () => {
  it("shows the catalog alone when there is no discovery backend", async () => {
    render(<ObjectBrowser dataSource={dataSource} sourceId="shop" height={400} />);
    fireEvent.click(await screen.findByText("orders"));
    expect(await screen.findByText("order_id")).toBeTruthy();
    expect(screen.queryByText("Joins")).toBeNull();
    // One catalog and one schema: both levels are skipped, so tables are at the top.
    expect(row("orders").getAttribute("aria-level")).toBe("1");
  });

  it("walks joins from table to table and marks certified data", async () => {
    const discovery = createDiscovery({ dataSource });
    await discovery.setCertification({ ref: { sourceId: "shop", kind: ObjectKind.TABLE, table: "customers" }, status: CertificationStatus.CERTIFIED, setBy: "Data team" });
    const onInsert = vi.fn();
    render(<ObjectBrowser dataSource={dataSource} discovery={discovery} sourceId="shop" height={600} onInsert={onInsert} />);

    await waitFor(() => expect(row("customers").textContent).toContain("Certified"));
    fireEvent.click(await screen.findByText("orders"));
    fireEvent.click(await screen.findByText("Joins"));
    await waitFor(() => expect(screen.getAllByText("customers")).toHaveLength(2));
    const join = row("customers", 0);
    expect(join.textContent).toContain("on customer_id");
    expect(join.textContent).toContain("Inferred");
    expect(join.textContent).toContain("Certified");
    expect(join.getAttribute("aria-level")).toBe("3");

    fireEvent.doubleClick(join);
    expect(onInsert).toHaveBeenCalledWith("JOIN customers ON orders.customer_id = customers.customer_id", expect.objectContaining({ kind: "join", table: "customers" }));

    // Onward from customers: regions, but not back to orders.
    fireEvent.click(join);
    await waitFor(() => expect(screen.getAllByText("Joins")).toHaveLength(2));
    fireEvent.click(screen.getAllByText("Joins")[1]!);
    await waitFor(() => expect(screen.getAllByText("regions")).toHaveLength(2));
    expect(screen.getAllByText("orders")).toHaveLength(1);
  });

  it("writes join clauses over several keys", () => {
    expect(joinClause("a", "b", [{ leftColumn: "x", rightColumn: "x" }, { leftColumn: "y", rightColumn: "z" }])).toBe("JOIN b ON a.x = b.x AND a.y = b.z");
  });
});

describe("ObjectBrowser: selecting several and handing them on", () => {
  const dragOf = () => {
    const data: Record<string, string> = {};
    return { data, dataTransfer: { setData: (type: string, value: string) => void (data[type] = value), effectAllowed: "" } };
  };

  it("selects with Ctrl click and Shift click, and a plain click starts again", async () => {
    render(<ObjectBrowser dataSource={dataSource} sourceId="shop" height={400} />);
    await screen.findByText("orders");
    fireEvent.click(row("customers"), { ctrlKey: true });
    fireEvent.click(row("regions"), { metaKey: true });
    expect(row("customers").getAttribute("aria-selected")).toBe("true");
    expect(row("regions").hasAttribute("data-picked")).toBe(true);
    expect(row("orders").getAttribute("aria-selected")).toBe("false");
    // A Ctrl click does not open the table: selecting is not navigating.
    expect(row("customers").getAttribute("aria-expanded")).toBe("false");
    expect(screen.getByRole("status").textContent).toMatch(/^2 selected/);
    expect(screen.getByRole("tree").getAttribute("aria-multiselectable")).toBe("true");
    fireEvent.click(row("customers"), { ctrlKey: true });
    expect(row("customers").hasAttribute("data-picked")).toBe(false);
    fireEvent.click(row("orders"));
    expect(screen.getByRole("tree").querySelectorAll("[data-picked]").length).toBe(0);
  });

  it("drags every selected item together, and one item alone when it is not part of the selection", async () => {
    render(<ObjectBrowser dataSource={dataSource} sourceId="shop" height={400} />);
    await screen.findByText("orders");
    fireEvent.click(row("customers"), { ctrlKey: true });
    fireEvent.click(row("orders"), { ctrlKey: true });
    const both = dragOf();
    fireEvent.dragStart(row("orders"), both);
    expect(readDataRefs({ getData: (type) => both.data[type] ?? "" }).map((r) => `${r.kind} ${r.table}`).sort()).toEqual(["table customers", "table orders"]);
    // Anything that only reads text gets the names.
    expect(both.data["text/plain"]!.split(", ").sort()).toEqual(["customers", "orders"]);
    const one = dragOf();
    fireEvent.dragStart(row("regions"), one);
    // One catalog and one schema: the reference names the table alone, as the tree does.
    expect(readDataRefs({ getData: (type) => one.data[type] ?? "" })).toEqual([{ sourceId: "shop", kind: "table", table: "regions" }]);
    // The older single form is still written, for targets that read it.
    expect(JSON.parse(one.data[SCHEMA_REF_MIME]!)).toEqual({ sourceId: "shop", table: "regions" });
  });

  it("hands the selection on from the keyboard and from the menu", async () => {
    const onAttach = vi.fn();
    render(<ObjectBrowser dataSource={dataSource} sourceId="shop" height={400} onAttach={onAttach} />);
    await screen.findByText("orders");
    const tree = screen.getByRole("tree");
    // Space selects the row the keyboard is on; Shift+Enter hands the selection on.
    fireEvent.keyDown(tree, { key: "Home" });
    fireEvent.keyDown(tree, { key: " " });
    fireEvent.keyDown(tree, { key: "ArrowDown" });
    fireEvent.keyDown(tree, { key: " " });
    fireEvent.keyDown(tree, { key: "Enter", shiftKey: true });
    expect(onAttach).toHaveBeenCalledTimes(1);
    expect(onAttach.mock.calls[0]![0]).toHaveLength(2);
    expect(screen.getByRole("status").textContent).toBe("Added 2 items.");
    // The menu says how many it will add; Escape clears the selection.
    fireEvent.contextMenu(row("customers"));
    expect(screen.getByRole("menuitem", { name: /Add to chat: 2 items/ })).toBeTruthy();
    fireEvent.keyDown(screen.getByRole("menu"), { key: "Escape" });
    fireEvent.keyDown(tree, { key: "Escape" });
    fireEvent.contextMenu(row("regions"));
    fireEvent.click(screen.getByRole("menuitem", { name: /^Add to chat/ }));
    expect(onAttach.mock.lastCall![0]).toEqual([expect.objectContaining({ sourceId: "shop", kind: "table", table: "regions" })]);
  });

  it("offers nothing to hand on when the host takes nothing", async () => {
    render(<ObjectBrowser dataSource={dataSource} sourceId="shop" height={400} />);
    fireEvent.contextMenu(await screen.findByText("orders"));
    expect(screen.queryByRole("menuitem", { name: /Add to chat/ })).toBeNull();
  });
});

describe("ObjectBrowser at scale", () => {
  const TABLES = 20_000;
  const big = memoryDataSource({
    tables: Object.fromEntries(Array.from({ length: TABLES }, (_, i) => [`t_${String(i).padStart(5, "0")}`, [{ a: i }]])),
  });
  const calls: { pageSize: number; pageToken: string; search: string }[] = [];
  const spy = {
    ...big,
    listTables: (request: Parameters<typeof big.listTables>[0], options?: Parameters<typeof big.listTables>[1]) => {
      calls.push({ pageSize: request.pageSize ?? 0, pageToken: request.pageToken ?? "", search: request.search ?? "" });
      return big.listTables(request, options);
    },
  };
  const scrollTo = (top: number) => {
    const tree = screen.getByRole("tree");
    tree.scrollTop = top;
    fireEvent.scroll(tree);
  };

  it("fetches tables a page at a time and keeps only visible rows in the DOM", async () => {
    calls.length = 0;
    render(<ObjectBrowser dataSource={spy} sourceId="memory" height={400} />);
    await screen.findByText("t_00000");
    expect(calls).toEqual([{ pageSize: 200, pageToken: "", search: "" }]);
    expect(document.querySelectorAll(".sf-schema-row").length).toBeLessThan(40);

    // Scrolling to the end of what is loaded brings in the next page, and so on.
    scrollTo(200 * 32);
    await waitFor(() => expect(calls).toHaveLength(2));
    expect(calls[1]).toEqual({ pageSize: 200, pageToken: "200", search: "" });
    await screen.findByText("t_00200");
    expect(document.querySelectorAll(".sf-schema-row").length).toBeLessThan(40);
    scrollTo(400 * 32);
    await screen.findByText("t_00400");
    expect(calls).toHaveLength(3);
  });

  it("searches in the backend instead of loading every table", async () => {
    calls.length = 0;
    render(<ObjectBrowser dataSource={spy} sourceId="memory" height={400} />);
    await screen.findByText("t_00000");
    fireEvent.change(screen.getByLabelText("Search tables"), { target: { value: "t_19999" } });
    await screen.findByText("t_19999");
    expect(calls.at(-1)).toEqual({ pageSize: 200, pageToken: "", search: "t_19999" });
    expect(screen.getAllByRole("treeitem")).toHaveLength(1);
  });

  it("offers SQL and details from a right click or the keyboard", async () => {
    const onUseSql = vi.fn();
    render(<ObjectBrowser dataSource={dataSource} sourceId="shop" height={400} onUseSql={onUseSql} />);
    await screen.findByText("orders");
    fireEvent.contextMenu(row("orders"), { clientX: 20, clientY: 20 });
    fireEvent.click(screen.getByRole("menuitem", { name: "SQL: count rows" }));
    expect(onUseSql).toHaveBeenCalledWith("SELECT COUNT(*) AS row_count\nFROM memory.main.orders", expect.objectContaining({ kind: "table", table: "orders" }));

    fireEvent.contextMenu(row("orders"), { clientX: 20, clientY: 20 });
    fireEvent.click(screen.getByRole("menuitem", { name: "SQL: every column by name" }));
    await waitFor(() => expect(onUseSql).toHaveBeenLastCalledWith("SELECT\n  order_id,\n  customer_id,\n  amount\nFROM memory.main.orders", expect.anything()));

    // The Menu key on the tree opens the menu for the row the keyboard is on; details show every column.
    fireEvent.contextMenu(screen.getByRole("tree"), { clientX: 0, clientY: 0 });
    fireEvent.click(screen.getByRole("menuitem", { name: "Show table details" }));
    const details = await screen.findByRole("region", { name: /Details of/ });
    await waitFor(() => expect(details.textContent).toContain("Columns"));
    fireEvent.keyDown(details, { key: "Escape" });
    expect(screen.queryByRole("region", { name: /Details of/ })).toBeNull();
  });
});
