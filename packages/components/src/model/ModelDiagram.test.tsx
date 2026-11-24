// @vitest-environment jsdom
import { memoryDataSource } from "@surfaces-ui/data";
import { createDiscovery } from "@surfaces-ui/discovery";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SCHEMA_REF_MIME } from "../schema/SchemaExplorer.js";
import type { Column } from "@surfaces-ui/proto";
import { type DataModel, ModelDiagram, type ModelJoin, checkJoin, connected, flipJoin, joinDepths, joinId, joinShape, kindText, modelSql, outputColumns, typeFamily } from "./ModelDiagram.js";

afterEach(cleanup);

const dataSource = memoryDataSource({
  sourceId: "shop",
  tables: {
    orders: [{ order_id: 1, customer_id: 1, amount: 9.5 }],
    customers: [{ customer_id: 1, region_id: 1, name: "Ada" }],
    regions: [{ region_id: 1, label: "EU" }],
    wide: [Object.fromEntries(Array.from({ length: 40 }, (_, i) => [`c${i}`, i]))],
  },
});
const joinsList = () => within(screen.getByRole("region", { name: "Joins" }));

describe("ModelDiagram", () => {
  it("draws tables with their columns and the joins the backend suggests, labelled as inferred", async () => {
    const onChange = vi.fn();
    render(<ModelDiagram dataSource={dataSource} discovery={createDiscovery({ dataSource })} sourceId="shop" tables={["orders", "customers"]} onChange={onChange} />);
    expect(await screen.findByText("amount")).toBeTruthy();
    await waitFor(() => expect(joinsList().getByText("orders.customer_id = customers.customer_id")).toBeTruthy());
    expect(joinsList().getByText("Inferred")).toBeTruthy();
    expect(document.querySelectorAll(".sf-model-lines path[data-inferred]")).toHaveLength(1);

    // Confirming keeps the join and drops the label.
    fireEvent.click(joinsList().getByRole("button", { name: "Confirm" }));
    expect(joinsList().queryByText("Inferred")).toBeNull();
    expect(onChange).toHaveBeenLastCalledWith({ tables: ["orders", "customers"], joins: [expect.objectContaining({ left: "orders", right: "customers", inferred: false })] }, expect.anything());
  });

  it("adds a join from the form and gives SQL for the model", async () => {
    const onUseSql = vi.fn();
    render(<ModelDiagram dataSource={dataSource} sourceId="shop" tables={["orders", "customers"]} onUseSql={onUseSql} />);
    await screen.findByText("amount");
    await screen.findByText("name");
    fireEvent.change(screen.getByLabelText("Table"), { target: { value: "orders" } });
    fireEvent.change(screen.getByLabelText("Column"), { target: { value: "customer_id" } });
    fireEvent.change(screen.getByLabelText("Joins table"), { target: { value: "customers" } });
    fireEvent.change(screen.getByLabelText("On column"), { target: { value: "customer_id" } });
    fireEvent.click(screen.getByRole("button", { name: "Add join" }));
    expect(joinsList().getByText("orders.customer_id = customers.customer_id")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Use as query" }));
    // Every column is named, and one a later table repeats gets its own name, so the query runs on any engine.
    expect(onUseSql).toHaveBeenCalledWith(
      [
        'SELECT orders."order_id",',
        '  orders."customer_id",',
        '  orders."amount",',
        '  customers."customer_id" AS "customer_id_1",',
        '  customers."region_id",',
        '  customers."name"',
        "FROM orders",
        "JOIN customers ON orders.customer_id = customers.customer_id",
      ].join("\n"),
      expect.anything(),
    );

    fireEvent.click(screen.getByRole("button", { name: /Remove join/ }));
    expect(joinsList().getByText(/None yet/)).toBeTruthy();
  });

  it("joins two columns by dragging one onto the other", async () => {
    render(<ModelDiagram dataSource={dataSource} sourceId="shop" tables={["customers", "regions"]} />);
    const target = (await screen.findByText("label")).closest("li")!.previousElementSibling as HTMLElement;
    const source = screen.getAllByText("region_id")[0]!.closest("li")!;
    document.elementFromPoint = () => target;
    fireEvent.pointerDown(source, { clientX: 10, clientY: 10 });
    fireEvent.pointerMove(screen.getByRole("group", { name: "Data model" }), { clientX: 300, clientY: 40 });
    expect(document.querySelector(".sf-model-lines path[data-drawing]")).toBeTruthy();
    fireEvent.pointerUp(screen.getByRole("group", { name: "Data model" }), { clientX: 300, clientY: 40 });
    expect(joinsList().getByText("customers.region_id = regions.region_id")).toBeTruthy();
    expect(document.querySelector(".sf-model-lines path[data-drawing]")).toBeNull();
  });

  it("accepts a table dropped from the browser, finds tables by search, and removes them", async () => {
    render(<ModelDiagram dataSource={dataSource} sourceId="shop" />);
    const canvas = screen.getByRole("group", { name: "Data model" });
    fireEvent.drop(canvas, { dataTransfer: { getData: (type: string) => (type === SCHEMA_REF_MIME ? JSON.stringify({ sourceId: "shop", table: "orders" }) : ""), types: [SCHEMA_REF_MIME] } });
    expect(await screen.findByRole("region", { name: "Table orders" })).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Add a table"), { target: { value: "cust" } });
    fireEvent.click(await screen.findByRole("button", { name: "Add customers" }));
    expect(screen.getByRole("region", { name: "Table customers" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Remove orders from the diagram" }));
    expect(screen.queryByRole("region", { name: "Table orders" })).toBeNull();
  });

  it("keeps wide tables short until asked", async () => {
    render(<ModelDiagram dataSource={dataSource} sourceId="shop" tables={["wide"]} />);
    fireEvent.click(await screen.findByRole("button", { name: "30 more columns" }));
    expect(screen.getByText("c39")).toBeTruthy();
  });
});

describe("modelSql", () => {
  const model: DataModel = {
    tables: ["orders", "customers", "regions", "Web Sessions"],
    joins: [
      { left: "regions", right: "customers", keys: [{ leftColumn: "region_id", rightColumn: "region_id" }] },
      { left: "orders", right: "customers", keys: [{ leftColumn: "customer_id", rightColumn: "customer_id" }, { leftColumn: "tenant", rightColumn: "tenant" }] },
    ],
  };

  it("follows joins outwards from the first table and leaves out what is not joined", () => {
    expect(modelSql(model)).toEqual({
      sql: [
        "SELECT *",
        "FROM orders",
        "JOIN customers ON orders.customer_id = customers.customer_id AND orders.tenant = customers.tenant",
        "JOIN regions ON regions.region_id = customers.region_id",
      ].join("\n"),
      unjoined: ["Web Sessions"],
      order: ["orders", "customers", "regions"],
    });
  });

  it("writes each join's kind as read from the table already reached, whichever way it was drawn", () => {
    const kinds: DataModel = {
      tables: ["lines", "orders", "stores"],
      joins: [
        { left: "lines", right: "orders", keys: [{ leftColumn: "order_id", rightColumn: "order_id" }], type: "left" },
        // Drawn from stores, keeping every orders row: read from orders it is a left join.
        { left: "stores", right: "orders", keys: [{ leftColumn: "store_id", rightColumn: "store_id" }], type: "right" },
      ],
    };
    expect(modelSql(kinds).sql).toBe(
      ["SELECT *", "FROM lines", "LEFT OUTER JOIN orders ON lines.order_id = orders.order_id", "LEFT OUTER JOIN stores ON stores.store_id = orders.store_id"].join("\n"),
    );
    expect(modelSql({ ...kinds, joins: [{ ...kinds.joins[0]!, type: "full" }] }).sql).toContain("FULL OUTER JOIN orders");
    expect(flipJoin(kinds.joins[1]!)).toEqual({ left: "orders", right: "stores", keys: [{ leftColumn: "store_id", rightColumn: "store_id" }], type: "left" });
    expect(kindText(kinds.joins[0]!, "left")).toBe("Every lines row");
  });

  it("names repeated columns the same way on every engine, without taking a real column's name", () => {
    const columns: Record<string, string[]> = { a: ["id", "id_1", "x"], b: ["id", "y"], c: ["ID", "x"] };
    expect(outputColumns(["a", "b", "c"], (t) => columns[t]!).map((c) => c.name)).toEqual(["id", "id_1", "x", "id_2", "y", "ID_3", "x_1"]);
    // Until every table's columns are known the query reads all of them.
    expect(modelSql({ tables: ["a", "b"], joins: [{ left: "a", right: "b", keys: [{ leftColumn: "id", rightColumn: "id" }] }] }, (t) => (t === "a" ? columns.a : undefined)).sql).toMatch(/^SELECT \*/);
  });

  it("tells a join that adds one row of detail from one that can repeat rows, from the keys the tables declare", () => {
    const col = (name: string, primaryKey = false) => ({ name, primaryKey }) as Column;
    const tables: Record<string, Column[]> = { lines: [col("line_id", true), col("order_id")], orders: [col("order_id", true)], notes: [col("note_id", true), col("order_id")], files: [col("order_id")] };
    const columnsOf = (t: string) => tables[t];
    const toOrders: ModelJoin = { left: "lines", right: "orders", keys: [{ leftColumn: "order_id", rightColumn: "order_id" }] };
    expect(joinShape(toOrders, "lines", columnsOf)).toBe("one");
    // From the other side, one order has many lines.
    expect(joinShape(toOrders, "orders", columnsOf)).toBe("many");
    expect(joinShape({ left: "orders", right: "notes", keys: [{ leftColumn: "order_id", rightColumn: "order_id" }] }, "orders", columnsOf)).toBe("many");
    // A file declares no key: the engine has to be asked.
    expect(joinShape({ left: "orders", right: "files", keys: [{ leftColumn: "order_id", rightColumn: "order_id" }] }, "orders", columnsOf)).toBe("unknown");
    expect([...joinDepths(["lines", "orders", "stores", "loose"], [toOrders, { left: "orders", right: "stores", keys: [] }])]).toEqual([["lines", 0], ["orders", 1], ["stores", 2], ["loose", 3]]);
  });

  it("keeps a table named with its database as SQL, and quotes only a name that needs it", () => {
    const named: DataModel = {
      tables: ["sales.orders", "sales.customers", "Web Sessions"],
      joins: [{ left: "sales.orders", right: "sales.customers", keys: [{ leftColumn: "customer_id", rightColumn: "customer_id" }] }],
    };
    expect(modelSql(named).sql).toBe("SELECT *\nFROM sales.orders\nJOIN sales.customers ON sales.orders.customer_id = sales.customers.customer_id");
    expect(modelSql({ tables: ["Web Sessions"], joins: [] }).sql).toBe('SELECT *\nFROM "Web Sessions"');
  });

  it("treats a join the same whichever way it was drawn", () => {
    expect(joinId({ left: "a", right: "b", keys: [{ leftColumn: "x", rightColumn: "y" }] })).toBe(joinId({ left: "B", right: "A", keys: [{ leftColumn: "y", rightColumn: "x" }] }));
  });

  it("refuses joins that cannot work and says why", async () => {
    render(<ModelDiagram dataSource={dataSource} sourceId="shop" tables={["orders", "customers"]} suggestJoins={false} />);
    await screen.findByText("amount");
    await screen.findByText("name");
    fireEvent.change(screen.getByLabelText("Table"), { target: { value: "orders" } });
    fireEvent.change(screen.getByLabelText("Column"), { target: { value: "amount" } });
    fireEvent.change(screen.getByLabelText("Joins table"), { target: { value: "customers" } });
    // Only columns that could match a number are offered.
    const offered = [...(screen.getByLabelText("On column") as HTMLSelectElement).options].map((o) => o.value).filter(Boolean);
    expect(offered).toEqual(["customer_id", "region_id"]);

    // Dragging a number onto text is refused with the reason.
    const canvas = screen.getByRole("group", { name: "Data model" });
    const from = canvas.querySelector('[data-model-table="orders"][data-model-column="amount"]')!;
    const to = canvas.querySelector('[data-model-table="customers"][data-model-column="name"]')!;
    document.elementFromPoint = () => to;
    fireEvent.pointerDown(from, { clientX: 1, clientY: 1 });
    fireEvent.pointerUp(canvas, { clientX: 5, clientY: 5 });
    expect(screen.getByRole("alert").textContent).toContain("orders.amount is a number and customers.name is text, so they can never match.");
    expect(joinsList().getByText(/None yet/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Dismiss" }));
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("removes a single line from the canvas and flags a join that cannot work", async () => {
    const changes: DataModel[] = [];
    render(
      <ModelDiagram
        dataSource={dataSource}
        sourceId="shop"
        tables={["orders", "customers"]}
        suggestJoins={false}
        joins={[
          { left: "orders", right: "customers", keys: [{ leftColumn: "customer_id", rightColumn: "customer_id" }, { leftColumn: "order_id", rightColumn: "region_id" }] },
          { left: "orders", right: "customers", keys: [{ leftColumn: "amount", rightColumn: "missing" }] },
        ]}
        onChange={(m) => changes.push(m)}
      />,
    );
    await screen.findByText("amount");
    await screen.findByText("name");
    // The join on a column that does not exist is kept visible, explained and left out of the SQL.
    expect(joinsList().getByText(/Will not work, left out of the SQL\. customers has no column missing\./)).toBeTruthy();
    // The SQL is highlighted, so it is read whole from its block rather than matched as one text node.
    const sql = screen.getByLabelText("SQL for this model").textContent ?? "";
    expect(sql).toContain("JOIN customers ON");
    expect(sql).not.toContain("missing");

    fireEvent.click(screen.getByRole("button", { name: "Remove the line orders.order_id = customers.region_id" }));
    expect(changes.at(-1)!.joins[0]!.keys).toEqual([{ leftColumn: "customer_id", rightColumn: "customer_id" }]);
    fireEvent.click(screen.getByRole("button", { name: "Remove the line orders.customer_id = customers.customer_id" }));
    expect(changes.at(-1)!.joins.map((j) => j.keys[0]!.rightColumn)).toEqual(["missing"]);
  });

  it("reports a table that cannot be read and lets a person try again", async () => {
    let fail = true;
    const flaky = { ...dataSource, describeTable: (request: Parameters<typeof dataSource.describeTable>[0]) => (fail ? Promise.reject(new Error("timed out")) : dataSource.describeTable(request)) };
    render(<ModelDiagram dataSource={flaky} sourceId="shop" tables={["orders"]} suggestJoins={false} />);
    expect((await screen.findByRole("alert")).textContent).toContain("Could not read this table: timed out");
    fail = false;
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByText("amount")).toBeTruthy();
  });

  it("knows which column types can match and when tables are already connected", () => {
    expect(typeFamily({ nativeType: "DECIMAL(18,2)", arrowType: "decimal128(18,2)" })).toBe("number");
    expect(typeFamily({ nativeType: "TIMESTAMP", arrowType: "timestamp[us]" })).toBe("time");
    expect(typeFamily({ nativeType: "VARCHAR", arrowType: "utf8" })).toBe("text");
    expect(typeFamily({ nativeType: "STRUCT(a INT)", arrowType: "struct" })).toBe("nested");
    expect(typeFamily({ nativeType: "", arrowType: "Dictionary<Int32, Utf8>" })).toBe("text");
    expect(checkJoin({ left: "a", right: "A", keys: [{ leftColumn: "x", rightColumn: "x" }] }, () => undefined)).toEqual({ ok: false, reason: "A join needs two different tables." });
    // Columns not loaded yet are given the benefit of the doubt.
    expect(checkJoin({ left: "a", right: "b", keys: [{ leftColumn: "x", rightColumn: "y" }] }, () => undefined)).toEqual({ ok: true });
    const joins = [{ left: "a", right: "b", keys: [] }, { left: "b", right: "c", keys: [] }];
    expect(connected(joins, "a", "c")).toBe(true);
    expect(connected(joins, "a", "d")).toBe(false);
  });
});

describe("ModelDiagram loading", () => {
  it("keeps a table's columns that arrive after the diagram re-renders with a new discovery backend", async () => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const slow = { ...dataSource, describeTable: async (...args: Parameters<typeof dataSource.describeTable>) => (await gate, dataSource.describeTable(...args)) };
    const view = render(<ModelDiagram dataSource={slow} discovery={createDiscovery({ dataSource })} sourceId="shop" tables={["orders"]} />);
    // The loading effect runs again (a new discovery object) while the first describe is still out.
    view.rerender(<ModelDiagram dataSource={slow} discovery={createDiscovery({ dataSource })} sourceId="shop" tables={["orders"]} />);
    release();
    expect(await screen.findByText("amount")).toBeTruthy();
    expect(screen.queryByText("Loading…")).toBeNull();
  });
});

describe("ModelDiagram keys", () => {
  it("marks primary and foreign keys, describes columns, and draws declared foreign keys as joins", async () => {
    const declared = {
      ...dataSource,
      describeTable: async (request: Parameters<typeof dataSource.describeTable>[0]) => {
        const response = await dataSource.describeTable(request);
        const table = response.table!;
        if (request.ref?.table === "orders") {
          table.summary!.comment = "One row per order.";
          for (const c of table.columns) if (c.name === "order_id") c.primaryKey = true;
          for (const c of table.columns) if (c.name === "amount") c.comment = "What the customer paid.";
          table.foreignKeys = [{ $typeName: "surfaces.v1.ForeignKey", columns: ["customer_id"], references: { $typeName: "surfaces.v1.TableRef", catalog: "", schema: "", table: "customers" }, referencedColumns: ["customer_id"] }];
        }
        if (request.ref?.table === "customers") for (const c of table.columns) if (c.name === "customer_id") c.primaryKey = true;
        return response;
      },
    };
    const onChange = vi.fn();
    render(<ModelDiagram dataSource={declared} sourceId="shop" tables={["orders", "customers"]} suggestJoins={false} onChange={onChange} />);
    const orders = within(await screen.findByRole("region", { name: "Table orders" }));
    await waitFor(() => expect(orders.getByText("primary key")).toBeTruthy());
    expect(orders.getByText("refers to customers.customer_id")).toBeTruthy();
    expect(orders.getByText("What the customer paid.")).toBeTruthy();
    expect(orders.getByText(/One row per order/)).toBeTruthy();
    expect(screen.getByText("amount").closest("li")!.title).toContain("What the customer paid.");

    await waitFor(() => expect(joinsList().getByText("orders.customer_id = customers.customer_id")).toBeTruthy());
    expect(joinsList().getByText("Declared")).toBeTruthy();
    expect(joinsList().queryByText("Inferred")).toBeNull();
    // onChange is called from an effect once the declared join is drawn, so it can trail the list by a moment.
    await waitFor(() =>
      expect(onChange).toHaveBeenLastCalledWith({ tables: ["orders", "customers"], joins: [expect.objectContaining({ declared: true })] }, expect.anything()),
    );
  });
});

describe("ModelDiagram rows", () => {
  const lines = memoryDataSource({
    sourceId: "shop",
    tables: {
      lines: [
        { line_id: 1, order_id: 1, amount: 5 },
        { line_id: 2, order_id: 1, amount: 7 },
      ],
      orders: [{ order_id: 1, region: "EU" }],
      notes: [
        { order_id: 1, text: "a" },
        { order_id: 1, text: "b" },
      ],
    },
  });

  it("marks where the rows come from, keeps every row of it by default, and says when a join can repeat rows", async () => {
    const changes: [DataModel, string][] = [];
    render(<ModelDiagram dataSource={lines} sourceId="shop" tables={["lines", "orders", "notes"]} suggestJoins={false} rowsFrom usedColumns={["amount", "region"]} onChange={(m, q) => changes.push([m, q.sql])} />);
    expect(await screen.findByRole("region", { name: "Table lines, where the rows come from" })).toBeTruthy();
    await screen.findByText("text");
    const add = (left: string, leftColumn: string, right: string, rightColumn: string) => {
      fireEvent.change(screen.getByLabelText("Table"), { target: { value: left } });
      fireEvent.change(screen.getByLabelText("Column"), { target: { value: leftColumn } });
      fireEvent.change(screen.getByLabelText("Joins table"), { target: { value: right } });
      fireEvent.change(screen.getByLabelText("On column"), { target: { value: rightColumn } });
      fireEvent.click(screen.getByRole("button", { name: "Add join" }));
    };
    // Drawn from orders towards lines, it is turned round to read from lines, and keeps every lines row.
    add("orders", "order_id", "lines", "order_id");
    expect(joinsList().getByText("lines.order_id = orders.order_id")).toBeTruthy();
    expect(changes.at(-1)![1]).toContain("LEFT OUTER JOIN orders ON lines.order_id = orders.order_id");
    expect(changes.at(-1)![1]).toContain('orders."order_id" AS "order_id_1"');

    // No keys are declared here, so the engine is asked; two notes share an order.
    add("orders", "order_id", "notes", "order_id");
    expect(joinsList().getAllByText(/Not known whether/)).toHaveLength(2);
    fireEvent.click(joinsList().getAllByRole("button", { name: "Check with the engine" })[1]!);
    expect(await joinsList().findByText(/Can repeat orders rows: up to 2 notes rows share one order_id/)).toBeTruthy();
    expect(document.querySelector(".sf-model-lines path[data-fanout]")).toBeTruthy();

    // An inner join says what it drops.
    fireEvent.change(joinsList().getByRole("combobox", { name: "Rows kept by lines.order_id = orders.order_id" }), { target: { value: "inner" } });
    expect(joinsList().getByText(/lines rows with no orders row are dropped/)).toBeTruthy();
    expect(changes.at(-1)![1]).toContain("\nJOIN orders ON");

    // Unused columns are dimmed; a renamed one shows its name in the result.
    expect(screen.getByText("text").closest("li")!.dataset.unused).toBe("true");
    expect(screen.getByText("amount").closest("li")!.dataset.unused).toBeUndefined();
    expect(screen.getAllByText("as order_id_1").length).toBeGreaterThan(0);

    // Another table can be where the rows come from.
    fireEvent.change(screen.getByLabelText("Rows come from"), { target: { value: "orders" } });
    expect(changes.at(-1)![0].tables[0]).toBe("orders");
    expect(changes.at(-1)![1]).toMatch(/FROM orders\n/);
  });
});
