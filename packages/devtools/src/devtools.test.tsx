// @vitest-environment jsdom
import { agentEvent, scriptedAgent } from "@surfaces-ui/agent";
import { Chat } from "@surfaces-ui/chat";
import { DataSourceProvider } from "@surfaces-ui/components";
import { memoryDataSource, memoryStorage } from "@surfaces-ui/data";
import { A2UI_VERSION, type SurfaceMessage, analyticsCatalog } from "@surfaces-ui/spec";
import { SurfaceView, type UseSurfaces, analyticsRenderers, useSurfaces } from "@surfaces-ui/spec/react";
import { type Recorder, createRecorder, recordMessage } from "@surfaces-ui/trace";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import DevToolsPanel from "./Panel.js";
import { SurfacesDevTools, surfaceStepDiff, surfacesAt } from "./index.js";
import { PANEL_CSS, SHELL_CSS } from "./styles.js";

afterEach(cleanup);
beforeEach(() => localStorage.clear());
const v = A2UI_VERSION;
const SECRET = "Ouagadougou-4418";
const source = memoryDataSource({ tables: { orders: [{ region: SECRET, amount: 5 }, { region: "NA", amount: 7 }] } });
const create: SurfaceMessage = { version: v, createSurface: { surfaceId: "main", catalogId: analyticsCatalog.id } };
const components = (list: Record<string, unknown>[]): SurfaceMessage => ({ version: v, updateComponents: { surfaceId: "main", components: list as never } });

function App({ expose }: { expose?: (s: UseSurfaces) => void }) {
  const state = useSurfaces(analyticsCatalog, [create, components([{ id: "root", component: "Column", children: ["title", "grid", "bad"] }, { id: "title", component: "Text", text: "First title" }, { id: "grid", component: "DataGrid", sourceId: "memory", sql: "SELECT * FROM orders", height: 200 }, { id: "bad", component: "Stat", label: 4 }])]);
  expose?.(state);
  return <DataSourceProvider dataSource={source}>{state.surfaces.main && <SurfaceView surface={state.surfaces.main} catalog={analyticsCatalog} renderers={analyticsRenderers} />}</DataSourceProvider>;
}
const panel = () => screen.findByRole("region", { name: "Surfaces dev tools" });

describe("SurfacesDevTools", () => {
  it("renders the app alone, and records nothing, when it is off", () => {
    const recorder = createRecorder();
    const { container } = render(
      <SurfacesDevTools enabled={false} recorder={recorder}>
        <App />
      </SurfacesDevTools>,
    );
    expect(screen.getByText("First title")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /dev tools/i })).toBeNull();
    expect(container.querySelector("[class*=sf-devtools]")).toBeNull();
    expect(recorder.get().events).toEqual([]);
  });

  it("keeps where the panel was left in the storage it is given, and reads only what makes sense", async () => {
    const storage = memoryStorage();
    const first = render(<SurfacesDevTools storage={storage}>app</SurfacesDevTools>);
    fireEvent.click(screen.getByRole("button", { name: "Open dev tools" }));
    await panel();
    await waitFor(() => expect(JSON.parse(storage.data["surfaces.devtools"] ?? "{}").open).toBe(true));
    expect(localStorage.getItem("surfaces.devtools")).toBeNull();
    first.unmount();

    // A storage that answers later opens the panel when it answers.
    const later = { load: () => Promise.resolve(storage.data["surfaces.devtools"]), save: vi.fn() };
    render(<SurfacesDevTools storage={later}>app</SurfacesDevTools>);
    expect(await panel()).toBeTruthy();
    cleanup();

    // Saved text that is not what the tools wrote is ignored.
    render(<SurfacesDevTools storage={memoryStorage({ "surfaces.devtools": '{"open":"yes","dock":"left","size":"big"}' })}>app</SurfacesDevTools>);
    expect(screen.getByRole("button", { name: "Open dev tools" })).toBeTruthy();
    expect(screen.queryByRole("region", { name: "Surfaces dev tools" })).toBeNull();
  });

  it("is on by default in a development build", () => {
    render(<SurfacesDevTools>app</SurfacesDevTools>);
    expect(screen.getByRole("button", { name: "Open dev tools" })).toBeTruthy();
  });

  it("opens from its button and from Ctrl+Shift+D, and shows a message, a service call and a problem", async () => {
    const recorder = createRecorder();
    render(
      <SurfacesDevTools enabled recorder={recorder}>
        <App />
      </SurfacesDevTools>,
    );
    await waitFor(() => expect(recorder.get().events.some((e) => e.name === "DataSource.execute" && e.status === "ok")).toBe(true));
    fireEvent.click(await screen.findByRole("button", { name: /Open dev tools, \d+ failed/ }));
    const tools = await panel();
    const timeline = await within(tools).findByRole("listbox", { name: "Timeline" });
    expect(within(timeline).getAllByRole("option").map((o) => o.getAttribute("data-kind"))).toEqual(expect.arrayContaining(["message", "service", "problem", "component"]));
    expect(within(timeline).getAllByText("VALIDATION_FAILED").length).toBeGreaterThan(0);
    expect(within(timeline).getByText("DataSource.execute")).toBeTruthy();
    // Nothing the tools show or hold carries a row's value.
    expect(tools.textContent).not.toContain(SECRET);
    expect(JSON.stringify(recorder.get().events)).not.toContain(SECRET);
    // The tools do not trace themselves: looking adds nothing.
    const before = recorder.get().events.length;
    fireEvent.click(within(timeline).getByText("DataSource.execute"));
    expect(within(tools).getByRole("region", { name: "Timeline: Service DataSource.execute, in full" })).toBeTruthy();
    expect(recorder.get().events.length).toBe(before);

    fireEvent.keyDown(window, { key: "D", ctrlKey: true, shiftKey: true });
    expect(screen.queryByRole("region", { name: "Surfaces dev tools" })).toBeNull();
    fireEvent.keyDown(window, { key: "d", metaKey: true, shiftKey: true });
    expect(await panel()).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Close dev tools" }));
    expect(screen.queryByRole("region", { name: "Surfaces dev tools" })).toBeNull();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: /Open dev tools/ }));
  });

  it("travels back a step: the surface is drawn as it stood, and says its data is live", async () => {
    const recorder = createRecorder();
    let api!: UseSurfaces;
    render(
      <SurfacesDevTools enabled recorder={recorder} defaultOpen>
        <App expose={(s) => (api = s)} />
      </SurfacesDevTools>,
    );
    act(() => api.apply(components([{ id: "title", component: "Text", text: "Second title" }])));
    const tools = await panel();
    const preview = () => tools.querySelector(".sf-devtools-preview")!;
    await waitFor(() => expect(preview().textContent).toContain("Second title"));
    const page = document.querySelector(".sf-surface:not(.sf-devtools-preview .sf-surface)")!;
    expect(page.textContent).toContain("Second title");

    fireEvent.click(within(tools).getByRole("button", { name: "Step back" }));
    await waitFor(() => expect(preview().textContent).toContain("First title"));
    expect(preview().textContent).not.toContain("Second title");
    expect(tools.querySelector(".sf-devtools-note")!.textContent).toMatch(/Showing step 2 of 3 \(updateComponents\).*queried live/);
    // The page itself is untouched by looking back.
    expect(page.textContent).toContain("Second title");
    // The state pane says what the step shown changed.
    expect(surfaceStepDiff(recorder.get().events, recorder.get().events.filter((e) => e.kind === "message").at(-1)!.seq).map((c) => c.path)).toEqual([expect.stringMatching(/components\/title\/text$/)]);

    fireEvent.click(within(tools).getByRole("button", { name: "Live" }));
    await waitFor(() => expect(preview().textContent).toContain("Second title"));
    fireEvent.change(within(tools).getByRole("slider", { name: "Step" }), { target: { value: "1" } });
    await waitFor(() => expect(tools.querySelector(".sf-devtools-note")!.textContent).toMatch(/Showing step 1 of 3 \(createSurface\)/));
  });

  it("outlines on the page the component picked in Components, and stops when the tools close", async () => {
    const recorder = createRecorder();
    render(
      <SurfacesDevTools enabled recorder={recorder} defaultOpen>
        <App />
      </SurfacesDevTools>,
    );
    const tools = await panel();
    // Nothing is pointed at until a person picks a component.
    expect(recorder.inspected()).toBeUndefined();
    expect(document.querySelector(".sf-devtools-inspect")).toBeNull();
    const row = await waitFor(() => {
      const found = [...tools.querySelectorAll(".sf-devtools-node")].find((node) => /Text\s*title/.test(node.textContent ?? ""));
      expect(found).toBeTruthy();
      return found!;
    });
    fireEvent.click(row);
    await waitFor(() => expect(recorder.inspected()).toEqual({ surfaceKey: expect.stringMatching(/:main$/), componentId: "title" }));
    // The other lists keep only what that component did and the messages that sent it: the grid's query is gone.
    const timeline = within(tools).getByRole("listbox", { name: "Timeline" });
    await waitFor(() => expect(timeline.textContent).not.toMatch(/DataSource/));
    expect(timeline.textContent).toMatch(/Text "title"/);
    expect(timeline.textContent).toMatch(/updateComponents/);
    expect(tools.textContent).toContain('Nothing here for Text "title".');
    const all = within(tools).getAllByRole("button", { name: /Show every component again/ });
    expect(all.length).toBeGreaterThan(0);
    const mark = document.querySelector("template[data-sf-inspect]")!;
    expect(mark.nextElementSibling!.textContent).toBe("First title");
    const outline = document.querySelector(".sf-devtools-inspect")!;
    expect(outline.getAttribute("aria-hidden")).toBe("true");
    // The outline belongs to the page, not to the panel.
    expect(tools.contains(outline)).toBe(false);

    // Clearing the filter shows everything again and takes the outline off.
    fireEvent.click(all[0]!);
    await waitFor(() => expect(recorder.inspected()).toBeUndefined());
    expect(within(tools).getByRole("listbox", { name: "Timeline" }).textContent).toMatch(/DataSource/);
    fireEvent.click(row);
    await waitFor(() => expect(recorder.inspected()).toBeDefined());

    fireEvent.click(within(tools).getByRole("button", { name: "Close dev tools" }));
    await waitFor(() => expect(recorder.inspected()).toBeUndefined());
    expect(document.querySelector("template[data-sf-inspect]")).toBeNull();
    expect(document.querySelector(".sf-devtools-inspect")).toBeNull();
  });

  it("picks a component by a press on the page, which the page itself does not get", async () => {
    const recorder = createRecorder();
    const pressed = vi.fn();
    render(
      <SurfacesDevTools enabled recorder={recorder} defaultOpen>
        <div onClick={pressed}>
          <App />
        </div>
      </SurfacesDevTools>,
    );
    const tools = await panel();
    const pick = within(tools).getByRole("button", { name: "Pick a component on the page" });
    expect(document.querySelector("template[data-sf-inspect]")).toBeNull();
    fireEvent.click(pick);
    expect(pick.getAttribute("aria-pressed")).toBe("true");
    // Every drawn component is marked while picking, and only then.
    await waitFor(() => expect(document.querySelectorAll("template[data-sf-inspect]").length).toBeGreaterThan(1));

    fireEvent.click(screen.getAllByText("First title").find((el) => !tools.contains(el))!);
    await waitFor(() => expect(recorder.inspected()).toEqual({ surfaceKey: expect.stringMatching(/:main$/), componentId: "title" }));
    expect(pressed).not.toHaveBeenCalled();
    expect(recorder.picking()).toBe(false);
    expect(pick.getAttribute("aria-pressed")).toBe("false");
    expect(document.querySelectorAll("template[data-sf-inspect]").length).toBe(1);
    // The panel follows: the component is the one shown, and the lists are narrowed to it.
    await waitFor(() => expect(within(tools).getAllByRole("button", { name: /Show every component again, not only Text title/ }).length).toBeGreaterThan(0));

    // Escape gives up, and nothing stays marked or caught.
    fireEvent.click(pick);
    fireEvent.keyDown(document.body, { key: "Escape" });
    expect(recorder.picking()).toBe(false);
  });

  it("resizes and changes side from the keyboard, and keeps where it was left", async () => {
    render(<SurfacesDevTools enabled defaultOpen>app</SurfacesDevTools>);
    await panel();
    const grip = screen.getByRole("separator", { name: "Resize dev tools" });
    const before = Number(grip.getAttribute("aria-valuenow"));
    fireEvent.keyDown(grip, { key: "ArrowUp" });
    expect(Number(grip.getAttribute("aria-valuenow"))).toBe(before + 32);
    fireEvent.click(screen.getByRole("button", { name: "Dock to the side" }));
    expect(screen.getByRole("separator", { name: "Resize dev tools" }).getAttribute("aria-orientation")).toBe("vertical");
    expect(JSON.parse(localStorage.getItem("surfaces.devtools")!)).toMatchObject({ open: true, dock: "right" });
  });

  it("says so when the browser will not open a window", async () => {
    render(<SurfacesDevTools enabled defaultOpen>app</SurfacesDevTools>);
    await panel();
    window.open = () => null;
    fireEvent.click(screen.getByRole("button", { name: "Open in a window of its own" }));
    expect(screen.getByRole("alert").textContent).toMatch(/did not allow a new window/);
  });

  it("records a chat turn end to end with no wiring", async () => {
    const recorder = createRecorder();
    const agent = scriptedAgent(() => [agentEvent.text("Here."), agentEvent.surface(create as never), agentEvent.surface(components([{ id: "root", component: "Stat", label: "Revenue", value: 10 }]) as never), agentEvent.done("s1", "scripted demo")]);
    render(
      <SurfacesDevTools enabled recorder={recorder} defaultOpen>
        <Chat agent={agent} />
      </SurfacesDevTools>,
    );
    const box = screen.getAllByRole("textbox")[0]!;
    fireEvent.change(box, { target: { value: "Show revenue" } });
    fireEvent.keyDown(box, { key: "Enter" });
    const timeline = await within(await panel()).findByRole("listbox", { name: "Timeline" });
    await waitFor(() => expect(within(timeline).getByText("turn: text")).toBeTruthy());
    await waitFor(() => expect(recorder.get().events.find((e) => e.kind === "agent")?.status).toBe("ok"));
    expect(recorder.get().events.map((e) => e.kind)).toEqual(expect.arrayContaining(["agent", "message", "component"]));

    // The turn is one row; opened, it is laid out as it went: what was asked, the reply, what it sent, who answered.
    const tools = await panel();
    fireEvent.click(within(timeline).getByText("turn: text"));
    const turn = await within(tools).findByRole("region", { name: /^Timeline: Agent turn: text, in full/ });
    expect(turn.textContent).toMatch(/Asked\s*Show revenue/);
    expect(turn.textContent).toMatch(/Reply\s*Here\./);
    expect(turn.textContent).toMatch(/Surface messages\s*2/);
    expect(turn.textContent).toMatch(/Answered by\s*scripted demo/);
  });
});

describe("DevToolsPanel", () => {
  const feedOf = (fill: (recorder: Recorder) => void) => {
    const recorder = createRecorder();
    fill(recorder);
    return recorder;
  };

  it("shows any feed of events, with no page behind it", () => {
    const feed = feedOf((recorder) => {
      recordMessage(recorder, { format: "a2ui", key: "s1:main", raw: { version: "v0.9", createSurface: { surfaceId: "main" } }, message: create, issues: [{ path: "/createSurface", message: "No catalog named" }] });
      recordMessage(recorder, { format: "a2ui", key: "s1:main", raw: components([{ id: "root", component: "Text", text: { "@path": "/title" } }]) });
      recorder.record({ kind: "state", name: "data.write", surfaceId: "s1:main", componentId: "root", detail: { path: "/title", value: "Typed" } });
      recorder.record({ kind: "event", name: "go", surfaceId: "s1:main", componentId: "root", detail: { type: "action", context: { n: 1 }, contract: "passed", sent: true } });
    });
    render(<DevToolsPanel feed={feed} narrow={false} />);
    const messages = screen.getByRole("listbox", { name: "Messages" });
    fireEvent.click(within(messages).getByText("createSurface"));
    const detail = screen.getByRole("region", { name: "Messages: Message createSurface, in full" });
    expect(detail.textContent).toContain("As it arrived (version v0.9)");
    expect(detail.textContent).toContain("As it was read (A2UI 1.0)");
    expect(detail.textContent).toContain("No catalog named");
    // The surface is replayed from the feed alone: the binding resolves to what the person typed.
    expect(surfacesAt(feed.get().events).surfaces["s1:main"]!.data).toEqual({ title: "Typed" });
    // The State pane starts folded to its heading; its content is there for when it is opened.
    expect(document.querySelector('[aria-label="State of the surface"]')!.textContent).toContain("/title");
    expect(document.querySelector(".sf-devtools-preview")!.textContent).toContain("Typed");
  });

  it("windows a long list and moves through it by keyboard", () => {
    const feed = feedOf((recorder) => {
      for (let i = 0; i < 1500; i++) recorder.record({ kind: "event", name: `event-${i}` });
    });
    render(<DevToolsPanel feed={feed} narrow={false} />);
    const timeline = screen.getByRole("listbox", { name: "Timeline" });
    expect(within(timeline).getAllByRole("option").length).toBeLessThan(40);
    expect(within(timeline).getByText("event-1499")).toBeTruthy();
    fireEvent.keyDown(timeline, { key: "ArrowDown" });
    fireEvent.keyDown(timeline, { key: "ArrowDown" });
    expect(within(timeline).getByRole("option", { selected: true }).textContent).toContain("event-1498");
    fireEvent.keyDown(timeline, { key: "Home" });
    expect(within(timeline).getByRole("option", { selected: true }).textContent).toContain("event-1499");
    // Filters: by kind and by status.
    fireEvent.click(screen.getByRole("button", { name: "Event", pressed: true }));
    expect(screen.getByText("Nothing matches these filters.")).toBeTruthy();
  });
});

describe("styles", () => {
  it("use theme tokens for every colour and time", () => {
    for (const css of [SHELL_CSS, PANEL_CSS]) {
      expect(css).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
      expect(css).not.toMatch(/rgba?\(|hsla?\(/);
      for (const rule of css.match(/(transition|animation):[^;]+;/g) ?? []) expect(rule).toMatch(/var\(--sf-(duration|press-time)/);
    }
  });
});
