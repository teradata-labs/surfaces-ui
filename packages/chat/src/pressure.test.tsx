// @vitest-environment jsdom
/**
 * Pressure test of the agent loop: an agent lays out a page of its own
 * design, declares the reply it expects, and the person's work (typed
 * values, sorted columns, the event) comes back on the next turn in the
 * contract's shape, with anything that went wrong reported to the agent.
 */
import { type SendInit, agentEvent, scriptedAgent } from "@surfaces-ui/agent";
import { DataSourceProvider } from "@surfaces-ui/components";
import { memoryDataSource } from "@surfaces-ui/data";
import { A2UI_VERSION, analyticsCatalog } from "@surfaces-ui/spec";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { Chat } from "./index.js";

afterEach(cleanup);

const v = A2UI_VERSION;
const catalogId = analyticsCatalog.id;
const dataSource = memoryDataSource({ tables: { orders: [{ id: 1, region: "Europe", amount: 120 }, { id: 2, region: "Americas", amount: 80 }] } });

/** A page no example has: a two-column grid, a form built from inputs, a list repeated over data, and a live table. */
const page = [
  {
    version: v,
    createSurface: {
      surfaceId: "budget",
      catalogId,
      sendDataModel: true,
      metadata: {
        extensions: {
          surfaces_expects: {
            approve: {
              type: "object",
              properties: { region: { type: "string", enum: ["Europe", "Americas"] }, budget: { type: "number", minimum: 1 } },
              required: ["region", "budget"],
          },
        },
      },
      },
    },
  },
  { version: v, updateDataModel: { surfaceId: "budget", value: { regions: ["Europe", "Americas"], region: "", budget: 0 } } },
  {
    version: v,
    updateComponents: {
      surfaceId: "budget",
      components: [
        { id: "root", component: "Column", children: ["title", "layout"] },
        { id: "title", component: "Text", variant: "h2", text: "Set a budget" },
        { id: "layout", component: "Grid", columns: 2, children: ["left", "right"] },
        { id: "left", component: "Card", child: "form" },
        { id: "form", component: "Column", children: ["region", "budget-input", "approve"] },
        { id: "region", component: "ChoicePicker", label: "Region", value: { "@path": "/region" }, options: ["Europe", "Americas"] },
        { id: "budget-input", component: "NumberField", label: "Budget", value: { "@path": "/budget" }, min: 0 },
        { id: "approve-label", component: "Text", text: "Approve" },
        { id: "approve", component: "Button", child: "approve-label", variant: "primary", action: { event: { name: "approve", context: { region: { "@path": "/region" }, budget: { "@path": "/budget" } } } } },
        { id: "right", component: "Column", children: ["names", "orders"] },
        { id: "names", component: "Row", children: { componentId: "name", path: "/regions" } },
        { id: "name", component: "Badge", text: { "@path": "." } },
        { id: "orders", component: "DataGrid", sourceId: "memory", sql: "SELECT * FROM orders", height: 200 },
      ],
    },
  },
];

describe("an agent-built page, end to end", () => {
  it("keeps what the person did, holds back replies that break the contract, and sends the rest with the page's state", async () => {
    const requests: SendInit[] = [];
    const agent = scriptedAgent((request, turn) => {
      requests.push(request);
      if (turn === 0) return [...page.map((m) => agentEvent.surface(m as never)), agentEvent.done("s1", "pressure test (scripted)")];
      return [agentEvent.text("Approved."), agentEvent.done("s1", "pressure test (scripted)")];
    });
    render(
      <DataSourceProvider dataSource={dataSource}>
        <Chat agent={agent} />
      </DataSourceProvider>,
    );
    fireEvent.change(screen.getByRole("textbox", { name: /message/i }), { target: { value: "Help me set a budget" } });
    fireEvent.click(screen.getByRole("button", { name: /send/i }));

    // The layout, the repeated list and the live table are all drawn.
    expect(await screen.findByRole("heading", { name: "Set a budget" })).toBeTruthy();
    expect(screen.getByText("Americas", { selector: ".sf-badge, .sf-a2-badge, span" })).toBeTruthy();
    await screen.findByRole("columnheader", { name: /^region/ });

    // Approving with nothing chosen breaks the agent's contract: nothing is sent.
    fireEvent.click(screen.getByRole("button", { name: "Approve" }));
    await new Promise((r) => setTimeout(r, 20));
    expect(requests).toHaveLength(1);

    // The person fills the form and sorts the table.
    fireEvent.click(screen.getByRole("radio", { name: "Europe" }));
    fireEvent.change(screen.getByLabelText("Budget"), { target: { value: "500" } });
    fireEvent.click(screen.getByRole("button", { name: /^amount/ }));
    fireEvent.click(screen.getByRole("button", { name: "Approve" }));
    await waitFor(() => expect(requests).toHaveLength(2));

    const sent = requests[1]!;
    const action = sent.input?.case === "action" ? sent.input.value : undefined;
    expect(action?.name).toBe("approve");
    expect(action?.surfaceId).toBe("budget");
    expect(action?.context).toEqual({ region: "Europe", budget: 500 });
    // sendDataModel: the whole model rides along with the event.
    expect(action?.dataModel).toMatchObject({ region: "Europe", budget: 500, regions: ["Europe", "Americas"] });

    // Every turn carries the page as it stands, and the contract the agent set.
    const state = sent.surfaces?.find((s) => s.surfaceId === "budget");
    expect(state?.dataModel).toMatchObject({ region: "Europe", budget: 500 });
    expect(state?.controls?.orders).toMatchObject({ sorts: [{ column: "amount" }] });
    expect(state?.expects?.[0]?.event).toBe("approve");

    // The refused first press is reported, so the agent learns why it did not hear back.
    expect(sent.surfaceErrors?.map((e) => e.code)).toContain("CONTRACT_FAILED");
    expect(await screen.findByText("Approved.")).toBeTruthy();
  });

  it("tells the agent what the person did between turns, once, and tells a host as it happens", async () => {
    const requests: SendInit[] = [];
    const seen: string[] = [];
    const agent = scriptedAgent((request, turn) => {
      requests.push(request);
      if (turn === 0) {
        return [
          agentEvent.surface({ version: v, createSurface: { surfaceId: "view", catalogId } }),
          agentEvent.surface({ version: v, updateDataModel: { surfaceId: "view", value: { filters: [] } } }),
          agentEvent.surface({
            version: v,
            updateComponents: {
              surfaceId: "view",
              components: [
                { id: "root", component: "Column", children: ["bar", "orders"] },
                { id: "bar", component: "FilterBar", sourceId: "memory", sql: "SELECT * FROM orders", filters: { "@path": "/filters" }, columns: ["region"] },
                { id: "orders", component: "DataGrid", sourceId: "memory", sql: "SELECT * FROM orders", filters: { "@path": "/filters" }, height: 200 },
              ],
            },
          } as never),
          agentEvent.done("s1", "pressure test (scripted)"),
        ];
      }
      return [agentEvent.text(`Turn ${turn}.`), agentEvent.done("s1", "pressure test (scripted)")];
    });
    render(
      <DataSourceProvider dataSource={dataSource}>
        <Chat agent={agent} onContext={(note) => seen.push(`${note.componentId}: ${note.kind}`)} />
      </DataSourceProvider>,
    );
    const say = (text: string) => {
      fireEvent.change(screen.getByRole("textbox", { name: /message/i }), { target: { value: text } });
      fireEvent.click(screen.getByRole("button", { name: /send/i }));
    };
    say("Show me the orders");
    await waitFor(() => expect(screen.getByLabelText("Column")).toBeTruthy());
    await waitFor(() => expect((screen.getByLabelText("Column") as HTMLSelectElement).options.length).toBe(1));

    // The person filters by hand. Nothing is sent: the bar has no action.
    fireEvent.change(screen.getByLabelText("Value"), { target: { value: "Europe" } });
    fireEvent.click(screen.getByRole("button", { name: "Add filter" }));
    expect(requests).toHaveLength(1);
    expect(seen).toEqual(["bar: filter.changed"]);

    // Their next message carries what they did, in words and as data.
    say("What am I looking at?");
    await waitFor(() => expect(requests).toHaveLength(2));
    const activity = requests[1]!.surfaces?.find((s) => s.surfaceId === "view")?.activity ?? [];
    expect(activity.map((a) => [a.componentId, a.kind, a.summary])).toEqual([["bar", "filter.changed", "Filters are now: region contains Europe."]]);
    expect(activity[0]!.subject).toEqual({ filters: [{ column: "region", op: "contains", values: ["Europe"] }] });
    expect(activity[0]!.at).toMatch(/^\d{4}-/);

    // It is told once: the turn after has nothing new to say.
    await screen.findByText("Turn 1.");
    say("And now?");
    await waitFor(() => expect(requests).toHaveLength(3));
    expect(requests[2]!.surfaces?.find((s) => s.surfaceId === "view")?.activity ?? []).toEqual([]);
  });

  it("tells the agent when it draws something the catalog does not allow", async () => {
    const requests: SendInit[] = [];
    const agent = scriptedAgent((request, turn) => {
      requests.push(request);
      if (turn > 0) return [agentEvent.done("s1", "scripted")];
      return [
        agentEvent.surface({ version: v, createSurface: { surfaceId: "main", catalogId } }),
        agentEvent.surface({ version: v, updateComponents: { surfaceId: "main", components: [{ id: "root", component: "Marquee", text: "hi" }] } } as never),
        agentEvent.surface({ version: v, createSurface: { surfaceId: "x", catalogId, metadata: { extensions: { surfaces_expects: { go: "not a schema" } } } } } as never),
        agentEvent.done("s1", "scripted"),
      ];
    });
    render(<Chat agent={agent} />);
    const box = screen.getByRole("textbox", { name: /message/i });
    fireEvent.change(box, { target: { value: "Draw" } });
    fireEvent.click(screen.getByRole("button", { name: /send/i }));
    await screen.findByText(/No renderer for Marquee|Unknown component/);
    fireEvent.change(box, { target: { value: "Again" } });
    fireEvent.click(screen.getByRole("button", { name: /send/i }));
    await waitFor(() => expect(requests).toHaveLength(2));
    const codes = requests[1]!.surfaceErrors?.map((e) => `${e.code}:${e.message}`) ?? [];
    expect(codes.some((c) => c.startsWith("VALIDATION_FAILED") && /Marquee/.test(c))).toBe(true);
    expect(codes.some((c) => c.startsWith("INVALID_MESSAGE") && /expects/.test(c))).toBe(true);
  });
});
