// @vitest-environment jsdom
import { agentEvent, scriptedAgent } from "@surfaces-ui/agent";
import { DataSourceProvider } from "@surfaces-ui/components";
import { memoryDataSource } from "@surfaces-ui/data";
import { ApprovalKind, StepStatus } from "@surfaces-ui/proto";
import { A2UI_VERSION, analyticsCatalog } from "@surfaces-ui/spec";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Chat, type ChatAction, type ChatThread, emptyThread, reduceThread, surfaceKey } from "./index.js";

afterEach(cleanup);

const v = A2UI_VERSION;
const catalogId = analyticsCatalog.id;
const surface = (components: Record<string, unknown>[]) => [
  agentEvent.surface({ version: v, createSurface: { surfaceId: "main", catalogId } }),
  agentEvent.surface({ version: v, updateComponents: { surfaceId: "main", components } as never }),
];
const play = (actions: ChatAction[], from: ChatThread = emptyThread) => actions.reduce((thread, action) => reduceThread(thread, action, analyticsCatalog), from);
const events = (list: ReturnType<typeof agentEvent.text>[]): ChatAction[] => list.map((event) => ({ type: "event", event }));

describe("reduceThread", () => {
  it("builds a reply from text, steps and surfaces in the order they arrive", () => {
    const thread = play([
      { type: "user", text: "Revenue by region?" },
      { type: "begin" },
      ...events([
        agentEvent.text("Looking "),
        agentEvent.text("now."),
        agentEvent.step({ id: "q1", title: "Query orders", status: StepStatus.RUNNING, tool: "run_sql" }),
        agentEvent.step({ id: "q1", status: StepStatus.DONE, detail: "SELECT 1", durationMs: 12n }),
        ...surface([{ id: "root", component: "Stat", label: "Revenue", value: 10 }]),
        agentEvent.text("Done."),
        agentEvent.suggestions(["By month"]),
        agentEvent.done("s1", "demo-model"),
      ]),
      { type: "end" },
    ]);
    const reply = thread.messages[1]!;
    expect(reply.parts.map((p) => p.kind)).toEqual(["text", "steps", "surface", "text"]);
    expect(reply.parts[0]).toEqual({ kind: "text", text: "Looking now." });
    expect(reply.parts[1]).toMatchObject({ steps: [{ id: "q1", title: "Query orders", status: "done", detail: "SELECT 1", durationMs: 12 }] });
    expect(thread.surfaces[surfaceKey(reply.id, "main")]!.components.root).toMatchObject({ component: "Stat" });
    expect(thread).toMatchObject({ status: "idle", sessionId: "s1", suggestions: ["By month"] });
    expect(reply).toMatchObject({ generatedBy: "demo-model", streaming: false });
  });

  it("keeps surfaces from different replies apart even when the agent reuses an ID", () => {
    const turn = (label: string): ChatAction[] => [{ type: "begin" }, ...events(surface([{ id: "root", component: "Text", text: label }])), { type: "end" }];
    const thread = play([...turn("first"), { type: "user", text: "again" }, ...turn("second")]);
    expect(Object.values(thread.surfaces).map((s) => s.components.root!.text)).toEqual(["first", "second"]);
  });

  it("refuses a view from another catalog and waits on an unanswered approval", () => {
    const thread = play([
      { type: "begin" },
      ...events([
        agentEvent.surface({ version: v, createSurface: { surfaceId: "x", catalogId: "urn:other" } }),
        agentEvent.approval({ id: "a1", kind: ApprovalKind.PERMISSION, title: "Run this query?", sql: "SELECT 1" }),
      ]),
      { type: "end" },
    ]);
    expect(thread.messages[0]!.parts[0]).toMatchObject({ kind: "error", code: "INVALID_SURFACE" });
    expect(thread.status).toBe("waiting");
    const answered = play([{ type: "answered", id: "a1", answer: { allow: true, text: "", reason: "", at: "", digest: "" } }, { type: "begin", resume: true }, { type: "end" }], thread);
    expect(answered.status).toBe("idle");
    expect(answered.messages).toHaveLength(1);
  });
});

describe("Chat", () => {
  const dataSource = memoryDataSource({
    sourceId: "shop",
    tables: { orders: [{ order_id: 1, customer_id: 1, amount: 9.5 }], customers: [{ customer_id: 1, name: "Ada" }] },
  });

  it("streams a reply with Markdown, steps and components drawn inline, and sends choices back to the agent", async () => {
    const seen: unknown[] = [];
    const agent = scriptedAgent(function* (request, turn) {
      seen.push(request.input);
      if (turn === 0) {
        yield agentEvent.text("Here is how the tables **relate**.");
        yield agentEvent.step({ id: "s", title: "Read the catalog", status: StepStatus.DONE });
        yield* surface([
          { id: "root", component: "Column", children: ["model", "pick"] },
          { id: "model", component: "ModelDiagram", sourceId: "shop", tables: ["orders", "customers"], joins: [{ left: "orders", right: "customers", keys: [{ leftColumn: "customer_id", rightColumn: "customer_id" }], inferred: true }] },
          {
            id: "pick",
            component: "DecisionCard",
            title: "Use this join?",
            options: [{ id: "yes", label: "Yes", recommended: true }, { id: "no", label: "No" }],
            action: { event: { name: "decide" } },
          },
        ]);
        yield agentEvent.done("s1", "scripted demo");
      } else {
        yield agentEvent.text("Joined.");
        yield agentEvent.done("s1", "scripted demo");
      }
    });
    render(
      <DataSourceProvider dataSource={dataSource}>
        <Chat agent={agent} starters={["Show the model"]} />
      </DataSourceProvider>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Show the model" }));
    const log = screen.getByRole("log");
    expect(await within(log).findByText("relate")).toBeTruthy();
    expect(within(log).getByText("Show the model")).toBeTruthy();
    expect(await within(log).findByRole("region", { name: "Table customers" })).toBeTruthy();
    expect(within(log).getByText("orders.customer_id = customers.customer_id")).toBeTruthy();
    expect(within(log).getByText("Read the catalog")).toBeTruthy();
    expect(await within(log).findByText("Answered by scripted demo")).toBeTruthy();

    fireEvent.click(within(log).getByRole("button", { name: /Yes/ }));
    expect(await within(log).findByText("Joined.")).toBeTruthy();
    expect(seen[1]).toMatchObject({ case: "action", value: { name: "decide", surfaceId: "main", sourceComponentId: "pick", context: { choice: "yes", label: "Yes" } } });
  });

  it("asks before the agent acts, and shows what a person answered", async () => {
    const seen: unknown[] = [];
    const agent = scriptedAgent(function* (request, turn) {
      seen.push(request.input);
      if (turn === 0) yield agentEvent.approval({ id: "a1", kind: ApprovalKind.PERMISSION, title: "Run this query?", sql: "SELECT COUNT(*) FROM orders" });
      else {
        yield agentEvent.text("It returned 1 row.");
        yield agentEvent.done("s1", "scripted demo");
      }
    });
    render(<Chat agent={agent} />);
    fireEvent.change(screen.getByLabelText("Message"), { target: { value: "How many orders?" } });
    fireEvent.click(screen.getByRole("button", { name: "Send" }));
    fireEvent.click(await screen.findByRole("button", { name: "Allow" }));
    expect(await screen.findByText(/Allowed by you/)).toBeTruthy();
    expect(await screen.findByText("It returned 1 row.")).toBeTruthy();
    expect(seen[1]).toMatchObject({ case: "approval", value: { id: "a1", allow: true } });
    // The answer continues the same reply instead of starting another.
    await waitFor(() => expect(screen.getAllByText("The agent replied:")).toHaveLength(1));
  });

  it("shows a failure as an error in the thread", async () => {
    const agent = scriptedAgent(() => {
      throw new Error("fetch failed");
    });
    render(<Chat agent={agent} />);
    fireEvent.change(screen.getByLabelText("Message"), { target: { value: "hi" } });
    fireEvent.keyDown(screen.getByLabelText("Message"), { key: "Enter" });
    expect((await screen.findByRole("alert")).textContent).toBe("fetch failed");
  });
});

describe("PageStudio", () => {
  it("changes a page from an instruction, refuses what the catalog does not allow, and undoes", async () => {
    const { PageStudio, studioPrompt } = await import("./index.js");
    const page = {
      id: "sales",
      title: "Sales",
      catalogId,
      components: [
        { id: "root", component: "Column", children: ["note"] },
        { id: "note", component: "Text", text: "Nothing here yet" },
      ],
    };
    const prompts: string[] = [];
    const agent = scriptedAgent(function* (request) {
      prompts.push(request.input?.case === "text" ? request.input.value : "");
      yield agentEvent.text("Added a headline and replaced the note.");
      yield agentEvent.surface({
        version: v,
        updateComponents: {
          surfaceId: "sales",
          components: [
            { id: "root", component: "Column", children: ["headline"] },
            { id: "headline", component: "Text", text: "Revenue is up", variant: "h2" },
            { id: "bad", component: "Html", html: "<script>" },
          ],
        } as never,
      });
      yield agentEvent.done("s1", "scripted demo");
    });
    render(<PageStudio agent={agent} page={page} />);
    expect(await screen.findByText("Nothing here yet")).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Describe a change"), { target: { value: "Replace the note with a headline" } });
    fireEvent.click(screen.getByRole("button", { name: "Send" }));

    expect(await screen.findByRole("heading", { name: "Revenue is up" })).toBeTruthy();
    expect(screen.queryByText("Nothing here yet")).toBeNull();
    const log = within(screen.getByRole("list", { name: "Changes" }));
    expect(log.getByText("Added a headline and replaced the note.")).toBeTruthy();
    expect(log.getByText(/Not applied: .*Unknown component "Html"/)).toBeTruthy();
    expect(log.getByText("By scripted demo")).toBeTruthy();
    expect(prompts[0]).toBe(studioPrompt(page, "Replace the note with a headline"));

    fireEvent.click(screen.getByRole("button", { name: "Undo" }));
    expect(screen.getByText("Nothing here yet")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Redo" }));
    expect(screen.getByRole("heading", { name: "Revenue is up" })).toBeTruthy();
  });

  it("sends what a person typed on the page with the next instruction", async () => {
    const { PageStudio } = await import("./index.js");
    const page = {
      id: "budget",
      title: "Budget",
      catalogId,
      data: { budget: 0 },
      components: [
        { id: "root", component: "Column", children: ["amount"] },
        { id: "amount", component: "NumberField", label: "Budget", value: { "@path": "/budget" } },
      ],
    };
    const requests: { surfaces?: { surfaceId?: string; dataModel?: unknown }[] }[] = [];
    const agent = scriptedAgent(function* (request) {
      requests.push(request as never);
      yield agentEvent.done("s1", "scripted demo");
    });
    render(<PageStudio agent={agent} page={page} />);
    fireEvent.change(await screen.findByRole("spinbutton", { name: "Budget" }), { target: { value: "750" } });
    fireEvent.change(screen.getByLabelText("Describe a change"), { target: { value: "Add a note" } });
    fireEvent.click(screen.getByRole("button", { name: "Send" }));
    await waitFor(() => expect(requests).toHaveLength(1));
    expect(requests[0]!.surfaces?.[0]).toMatchObject({ surfaceId: "budget", dataModel: { budget: 750 } });
  });

  it("lets a person arrange the page by hand as one undo step, logs it by them, and tells the agent", async () => {
    const { PageStudio } = await import("./index.js");
    const page = {
      id: "notes",
      title: "Notes",
      catalogId,
      components: [
        { id: "root", component: "Column", children: ["first", "second"] },
        { id: "first", component: "Text", text: "First note" },
        { id: "second", component: "Text", text: "Second note" },
      ],
    };
    const requests: { surfaces?: { activity?: { kind: string; subject?: unknown }[] }[] }[] = [];
    const agent = scriptedAgent(function* (request) {
      requests.push(request as never);
      yield agentEvent.done("s1", "scripted demo");
    });
    const order = () => [...document.querySelectorAll(".sf-a2-text, p")].map((e) => e.textContent).filter((t) => /note$/.test(t ?? ""));
    const { unmount } = render(<PageStudio agent={agent} page={page} />);
    // Without `arrange` there is nothing to arrange with.
    expect(screen.queryByRole("button", { name: "Arrange" })).toBeNull();
    unmount();

    render(<PageStudio agent={agent} page={page} arrange user={{ id: "u1", name: "Ada" }} />);
    await screen.findByText("First note");
    fireEvent.click(screen.getByRole("button", { name: "Arrange" }));
    const bar = within(document.querySelector('.sf-arrange-frame[data-component="second"] > .sf-arrange-bar') as HTMLElement);
    fireEvent.click(bar.getByRole("button", { name: /up/i }));
    await waitFor(() => expect(order()).toEqual(["Second note", "First note"]));
    expect(within(screen.getByRole("list", { name: "Changes" })).getByText("Arranged by Ada")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Undo" }));
    await waitFor(() => expect(order()).toEqual(["First note", "Second note"]));
    fireEvent.click(screen.getByRole("button", { name: "Redo" }));

    fireEvent.change(screen.getByLabelText("Describe a change"), { target: { value: "Add a heading" } });
    fireEvent.click(screen.getByRole("button", { name: "Send" }));
    await waitFor(() => expect(requests).toHaveLength(1));
    expect(requests[0]!.surfaces?.[0]?.activity?.[0]).toMatchObject({ kind: "layout.changed", subject: { root: { children: ["second", "first"] } } });
  });
});

describe("Chat attachments", () => {
  const drop = (refs: unknown[]) => ({ dataTransfer: { types: ["application/x-surfaces-refs+json"], getData: (type: string) => (type === "application/x-surfaces-refs+json" ? JSON.stringify(refs) : ""), dropEffect: "" } });

  it("takes tables and columns dropped on the composer, sends them with the message, and shows them on it", async () => {
    const seen: unknown[] = [];
    const agent = scriptedAgent(function* (request) {
      seen.push(request.references);
      yield agentEvent.text("Looking at those.");
    });
    render(<Chat agent={agent} />);
    const box = screen.getByLabelText("Message");
    const form = box.closest("form")!;
    fireEvent.dragOver(form, drop([]));
    fireEvent.drop(form, drop([{ sourceId: "td", kind: "table", schema: "sales", table: "fct_orders" }, { sourceId: "td", kind: "column", schema: "sales", table: "fct_orders", column: "total_amount" }]));
    const attached = screen.getByRole("list", { name: "Attached to this message" });
    expect(within(attached).getAllByRole("listitem").map((li) => li.textContent)).toEqual(["sales.fct_orders", "sales.fct_orders.total_amount"]);
    // The same thing dropped again is not attached twice; one can be taken off.
    fireEvent.drop(form, drop([{ sourceId: "td", kind: "table", schema: "sales", table: "fct_orders" }]));
    expect(within(attached).getAllByRole("listitem")).toHaveLength(2);
    fireEvent.click(screen.getByRole("button", { name: "Remove sales.fct_orders.total_amount" }));
    expect(within(attached).getAllByRole("listitem")).toHaveLength(1);

    fireEvent.change(box, { target: { value: "What is in here?" } });
    fireEvent.keyDown(box, { key: "Enter" });
    expect(await screen.findByText("Looking at those.")).toBeTruthy();
    expect(seen[0]).toEqual([expect.objectContaining({ sourceId: "td", schema: "sales", table: "fct_orders", column: "" })]);
    // The chips go with the message that was sent, and the composer is clear for the next one.
    expect(within(screen.getByRole("list", { name: "Attached" })).getByText("sales.fct_orders")).toBeTruthy();
    expect(screen.queryByRole("list", { name: "Attached to this message" })).toBeNull();
  });

  it("lets a host hold the attachments, as when a browser beside the chat adds to them", () => {
    const agent = scriptedAgent(() => []);
    const onReferencesChange = vi.fn();
    const refs = [{ sourceId: "shop", kind: "table" as const, table: "orders" }];
    render(<Chat agent={agent} references={refs} onReferencesChange={onReferencesChange} />);
    expect(within(screen.getByRole("list", { name: "Attached to this message" })).getByText("orders")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Remove orders" }));
    expect(onReferencesChange).toHaveBeenCalledWith([]);
  });

  it("ignores a drop that carries no table or column", () => {
    render(<Chat agent={scriptedAgent(() => [])} />);
    const form = screen.getByLabelText("Message").closest("form")!;
    fireEvent.drop(form, { dataTransfer: { types: ["text/plain"], getData: () => "hello" } });
    expect(screen.queryByRole("list", { name: "Attached to this message" })).toBeNull();
  });
});
