// @vitest-environment jsdom
import { memoryDataSource } from "@surfaces-ui/data";
import { type LanguageModel, createDiscovery } from "@surfaces-ui/discovery";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AskData } from "./AskData.js";
import { ContextBuilder, type ContextDraft, addToContext, emptyContextDraft } from "./ContextBuilder.js";
import { DataSearch } from "./DataSearch.js";
import { ObjectDetail } from "./ObjectDetail.js";
import { RelationshipGraph } from "./RelationshipGraph.js";
import { DiscoveryProvider, tableRef } from "./shared.js";

afterEach(cleanup);

const data = () =>
  memoryDataSource({
    sourceId: "shop",
    tables: {
      orders: Array.from({ length: 20 }, (_, i) => ({ order_id: i + 1, customer_id: (i % 4) + 1, status: i % 4 === 0 ? null : "shipped", amount: i * 1.5 })),
      customers: Array.from({ length: 4 }, (_, i) => ({ customer_id: i + 1, full_name: `Person ${i}` })),
      orders_archive: [{ order_id: 0, customer_id: 1, status: "shipped", amount: 1 }],
    },
  });
const backend = (options: Partial<Parameters<typeof createDiscovery>[0]> = {}) => createDiscovery({ dataSource: data(), ...options });

describe("DataSearch height", () => {
  it("scrolls its results inside a given height, and can be focused to do so by keyboard", async () => {
    const { container } = render(<DataSearch discovery={backend()} height={320} />);
    const search = container.querySelector(".sf-search") as HTMLElement;
    expect(search.style.height).toBe("320px");
    expect(search.hasAttribute("data-fixed")).toBe(true);
    expect(container.querySelector(".sf-search-results")!.getAttribute("tabindex")).toBe("0");
  });

  it("is as long as its results when no height is given", () => {
    const { container } = render(<DataSearch discovery={backend()} />);
    const search = container.querySelector(".sf-search") as HTMLElement;
    expect(search.style.height).toBe("");
    expect(search.hasAttribute("data-fixed")).toBe(false);
    expect(container.querySelector(".sf-search-results")!.hasAttribute("tabindex")).toBe(false);
  });
});

describe("DataSearch", () => {
  it("searches as you type, explains matches and offers actions", async () => {
    const onOpen = vi.fn();
    render(<DataSearch discovery={backend()} onOpen={onOpen} renderActions={(object) => <button type="button">Add {object.name}</button>} />);
    expect(await screen.findByText("3 results")).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Search data"), { target: { value: "customer" } });
    const reason = await screen.findByText("Name matches “customer” · Has column customer_id");
    fireEvent.click(reason.closest("button")!);
    expect(onOpen.mock.calls[0]![0].name).toBe("customers");
    expect(screen.getByRole("button", { name: "Add customers" })).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Match"), { target: { value: "2" } });
    expect(await screen.findByText(/search by meaning is not available here/)).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Search data"), { target: { value: "zzz" } });
    expect(await screen.findByText(/Nothing matches “zzz”/)).toBeTruthy();
  });
});

describe("ObjectDetail", () => {
  it("shows statistics, withholds values, and saves only an accepted description", async () => {
    const onOpen = vi.fn();
    render(<ObjectDetail discovery={backend()} objectRef={tableRef("shop", "orders")} onOpen={onOpen} />);
    expect(await screen.findByRole("heading", { name: "orders" })).toBeTruthy();
    expect(await screen.findByLabelText("75% filled")).toBeTruthy();
    expect(screen.getByText(/Data values are withheld/)).toBeTruthy();
    expect(screen.getAllByText("Withheld")).toHaveLength(4);
    fireEvent.click(await screen.findByRole("button", { name: /Joins with customers/ }));
    expect(onOpen.mock.calls[0]![0].name).toBe("customers");

    fireEvent.click(screen.getByRole("button", { name: "Suggest a description" }));
    const box = (await screen.findByLabelText(/no language model is connected/)) as HTMLTextAreaElement;
    expect(box.value).toMatch(/^Table orders \(20 rows\) with 4 columns/);
    fireEvent.change(box, { target: { value: "One row per order." } });
    fireEvent.click(screen.getByRole("button", { name: "Save description" }));
    expect(await screen.findByText("One row per order.")).toBeTruthy();
    expect(screen.getByText("Written by a person")).toBeTruthy();
  });

  it("shows common values when the source allows them", async () => {
    render(<ObjectDetail discovery={backend({ allowSampleValues: ["shop"] })} objectRef={tableRef("shop", "orders")} />);
    expect(await screen.findByText("shipped")).toBeTruthy();
    expect(screen.queryByText("Withheld")).toBeNull();
  });
});

describe("ContextBuilder", () => {
  function Harness({ discovery }: { discovery: ReturnType<typeof backend> }) {
    const [draft, setDraft] = useState<ContextDraft>(addToContext(addToContext(emptyContextDraft, "shop", "orders"), "shop", "customers"));
    return (
      <DiscoveryProvider discovery={discovery}>
        <ContextBuilder value={draft} onChange={setDraft} tokenBudget={60} />
        <output data-testid="draft">{JSON.stringify(draft)}</output>
      </DiscoveryProvider>
    );
  }

  it("previews what the agent receives, tracks the budget, adds joins and saves", async () => {
    const discovery = backend();
    render(<Harness discovery={discovery} />);
    const preview = () => document.querySelector(".sf-context-preview")!.textContent!;
    await waitFor(() => expect(preview()).toContain("### orders"));
    expect(preview()).toContain("| customer_id | Float64 |");
    expect(await screen.findByText(/over budget/)).toBeTruthy();
    expect((screen.getByRole("button", { name: "Save context" }) as HTMLButtonElement).disabled).toBe(true);

    fireEvent.click(await screen.findByRole("button", { name: "Add join" }));
    await waitFor(() => expect(preview()).toContain("orders ⋈ customers ON orders.customer_id = customers.customer_id"));

    fireEvent.click(screen.getAllByText("Choose columns")[0]!);
    fireEvent.click(await screen.findByLabelText("status"));
    await waitFor(() => expect(preview()).not.toContain("| status |"));
    expect(screen.getByText("3 of 4 columns")).toBeTruthy();

    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Orders" } });
    fireEvent.change(screen.getByLabelText("Note about orders"), { target: { value: "One row per order." } });
    await waitFor(() => expect(preview()).toContain("Note: One row per order."));
    fireEvent.click(screen.getByRole("button", { name: "Save context" }));
    expect(await screen.findByText("Saved version 1.")).toBeTruthy();
    expect((await discovery.listContextPacks({})).packs).toMatchObject([{ name: "Orders", itemCount: 2 }]);

    fireEvent.click(screen.getByRole("button", { name: "Move customers up" }));
    fireEvent.click(screen.getByRole("button", { name: "Remove orders" }));
    const draft = JSON.parse(screen.getByTestId("draft").textContent!) as ContextDraft;
    expect(draft.items.map((i) => i.table)).toEqual(["customers"]);
    expect(draft.joins).toEqual([]);
  });

  it("warns when the context contains data values", async () => {
    function WithValues() {
      const [draft, setDraft] = useState<ContextDraft>({ ...emptyContextDraft, items: [{ sourceId: "shop", table: "customers", columns: [], note: "", includeSampleRows: true }] });
      return <ContextBuilder discovery={backend({ allowSampleValues: ["shop"] })} value={draft} onChange={setDraft} />;
    }
    render(<WithValues />);
    expect(await screen.findByText("This context includes actual data values (sample rows).")).toBeTruthy();
  });
});

describe("RelationshipGraph and AskData", () => {
  it("draws related tables and moves to one when chosen", async () => {
    const onOpen = vi.fn();
    render(<RelationshipGraph discovery={backend()} objectRef={tableRef("shop", "orders")} onOpen={onOpen} />);
    const node = await screen.findByRole("button", { name: /^customers: Both have customer_id/ });
    expect(screen.getByRole("button", { name: /^orders_archive/ })).toBeTruthy();
    fireEvent.keyDown(node, { key: "Enter" });
    expect(onOpen.mock.calls[0]![0].name).toBe("customers");
  });

  it("labels a placeholder answer and cites tables", async () => {
    render(<AskData discovery={backend()} />);
    fireEvent.change(screen.getByLabelText("Ask a question about the data"), { target: { value: "orders by customer" } });
    fireEvent.click(screen.getByRole("button", { name: "Ask" }));
    expect(await screen.findByText("Search results only — no language model is connected.")).toBeTruthy();
    expect(within(screen.getByLabelText("Tables used")).getByRole("button", { name: "orders" })).toBeTruthy();
  });

  it("streams a model's answer and offers its SQL without running it", async () => {
    const model: LanguageModel = {
      id: "test-model",
      async *complete() {
        yield "Use the orders table. ";
        yield "```sql\nSELECT COUNT(*) FROM orders\n```";
      },
    };
    const onUseSql = vi.fn();
    render(<AskData discovery={backend({ languageModel: model })} onUseSql={onUseSql} />);
    fireEvent.change(screen.getByLabelText("Ask a question about the data"), { target: { value: "how many orders" } });
    fireEvent.click(screen.getByRole("button", { name: "Ask" }));
    expect(await screen.findByText("Answered by test-model. Check it against the data.")).toBeTruthy();
    expect(onUseSql).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Use this SQL" }));
    expect(onUseSql).toHaveBeenCalledWith("SELECT COUNT(*) FROM orders");
  });
});

describe("certification", () => {
  it("lets a named person certify a table and shows the mark in search", async () => {
    const discovery = backend();
    render(
      <DiscoveryProvider discovery={discovery}>
        <ObjectDetail objectRef={tableRef("shop", "orders")} certifier="Ada" />
      </DiscoveryProvider>,
    );
    fireEvent.click(await screen.findByRole("button", { name: "Certify…" }));
    fireEvent.change(screen.getByLabelText(/Why is it certified/), { target: { value: "Matches the ledger." } });
    fireEvent.click(screen.getByRole("button", { name: "Certify as Ada" }));
    expect(await screen.findByText(/Certified by Ada on \d{4}-\d{2}-\d{2}\. Matches the ledger\./)).toBeTruthy();
    cleanup();

    render(<DataSearch discovery={discovery} />);
    await waitFor(() => expect(screen.getAllByRole("listitem")[0]!.textContent).toMatch(/^orders✓Certified/));
    fireEvent.click(screen.getByLabelText("Certified only"));
    await waitFor(() => expect(screen.getAllByRole("listitem")).toHaveLength(1));
  });

  it("offers no certify controls unless the host names a certifier", async () => {
    render(<ObjectDetail discovery={backend()} objectRef={tableRef("shop", "orders")} />);
    await screen.findByText("orders");
    expect(screen.queryByRole("button", { name: "Certify…" })).toBeNull();
  });
});
