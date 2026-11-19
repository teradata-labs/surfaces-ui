// @vitest-environment jsdom
import { DataSourceProvider } from "@surfaces-ui/components";
import { memoryDataSource } from "@surfaces-ui/data";
import { type Recorder, createRecorder, replay } from "@surfaces-ui/trace";
import { TraceProvider } from "@surfaces-ui/trace/react";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { analyticsCatalog } from "../analytics.js";
import { A2UI_VERSION, setPath } from "../dynamic.js";
import { type Surface, type SurfaceMessage, applyMessage } from "../surface.js";
import { type ComponentRenderer, SurfaceView, type UseSurfaces, analyticsRenderers, useSurfaces } from "./index.js";

afterEach(cleanup);
const v = A2UI_VERSION;
const create: SurfaceMessage = { version: v, createSurface: { surfaceId: "main", catalogId: analyticsCatalog.id } };
const components = (list: Record<string, unknown>[]): SurfaceMessage => ({ version: v, updateComponents: { surfaceId: "main", components: list as never } });
const SECRET = "Quetzalcoatl-9920";
const source = () => memoryDataSource({ tables: { orders: [{ region: SECRET, amount: 5 }, { region: "NA", amount: 7 }] } });
const options = { apply: (surfaces: Record<string, Surface>, message: unknown) => applyMessage(surfaces, message as SurfaceMessage), setPath };

function Host({ recorder, initial, expose, renderers = analyticsRenderers, onAction }: { recorder?: Recorder; initial: SurfaceMessage[]; expose?: (s: UseSurfaces) => void; renderers?: Record<string, ComponentRenderer>; onAction?: () => void }) {
  const state = useSurfaces(analyticsCatalog, initial);
  expose?.(state);
  const surface = state.surfaces.main;
  return <DataSourceProvider dataSource={source()}>{surface && <SurfaceView surface={surface} catalog={analyticsCatalog} renderers={renderers} onAction={onAction} />}</DataSourceProvider>;
}
const traced = (recorder: Recorder, host: React.ReactNode) => <TraceProvider recorder={recorder}>{host}</TraceProvider>;
const names = (recorder: Recorder, kind: string) => recorder.get().events.filter((e) => e.kind === kind).map((e) => e.name);

describe("tracing a surface", () => {
  it("records each message, with its upgrade and what the catalog said, and replays to the same surface", () => {
    const recorder = createRecorder();
    let api!: UseSurfaces;
    render(traced(recorder, <Host recorder={recorder} expose={(s) => (api = s)} initial={[create, components([{ id: "root", component: "Text", text: "One" }])]} />));
    act(() => api.apply(components([{ id: "root", component: "Text", text: "Two" }])));
    // An older message is recorded as it came and as it was read.
    act(() => api.apply({ version: "v0.9", updateComponents: { surfaceId: "main", components: [{ id: "root", component: "Text", text: { path: "/title" } }] as never } }));
    // A message for a surface that does not exist is refused, and recorded as a problem.
    act(() => api.apply({ version: v, updateComponents: { surfaceId: "nowhere", components: [{ id: "root", component: "Text", text: "Lost" }] as never } }));
    const messages = recorder.get().events.filter((e) => e.kind === "message");
    expect(messages.map((e) => [e.name, e.status])).toEqual([["createSurface", "ok"], ["updateComponents", "ok"], ["updateComponents", "ok"], ["updateComponents", "ok"], ["updateComponents", "error"]]);
    const key = messages[0]!.surfaceId!;
    expect(key).toMatch(/^s\d+:main$/);
    expect((messages[3]!.detail.message as any).updateComponents.components[0].text).toEqual({ "@path": "/title" });
    expect((messages[3]!.detail.raw as any).updateComponents.components[0].text).toEqual({ path: "/title" });
    expect(messages[4]!.detail).toMatchObject({ applied: false, error: { code: "UNKNOWN_SURFACE" } });
    expect(names(recorder, "problem")).toContain("UNKNOWN_SURFACE");

    // Time travel: the log replays to what the page holds, and to what it held a step ago.
    const { events } = recorder.get();
    expect(replay(events, undefined, options).surfaces[key]).toEqual(api.surfaces.main);
    expect((replay(events, messages[1]!.seq, options).surfaces[key]!.components.root as any).text).toBe("One");
    expect((replay(events, messages[2]!.seq, options).surfaces[key]!.components.root as any).text).toBe("Two");
  });

  it("records a drawn component, and its queries as its children, with no row values", async () => {
    const recorder = createRecorder();
    render(traced(recorder, <Host recorder={recorder} initial={[create, components([{ id: "root", component: "DataGrid", sourceId: "memory", sql: "SELECT * FROM orders", height: 200 }])]} />));
    await waitFor(() => expect(recorder.get().events.some((e) => e.name === "DataSource.execute" && e.status === "ok")).toBe(true));
    const { events } = recorder.get();
    const message = events.find((e) => e.kind === "message" && e.name === "updateComponents")!;
    const drawn = events.find((e) => e.kind === "component")!;
    const call = events.find((e) => e.name === "DataSource.execute")!;
    expect(drawn).toMatchObject({ name: 'DataGrid "root"', componentId: "root", surfaceId: message.surfaceId, parentId: message.spanId, traceId: message.traceId });
    expect(call).toMatchObject({ parentId: drawn.spanId, traceId: drawn.traceId, componentId: "root", surfaceId: message.surfaceId });
    expect((call.detail.request as any).query.baseSql).toBe("SELECT * FROM orders");
    expect((call.detail.response as any).rows).toBe(2);
    expect(JSON.stringify(events)).not.toContain(SECRET);
  });

  it("records a catalog violation, an action with its contract result, and a write", () => {
    const recorder = createRecorder();
    const onAction = vi.fn();
    render(
      traced(
        recorder,
        <Host
          recorder={recorder}
          onAction={onAction}
          initial={[
            { version: v, createSurface: { surfaceId: "main", catalogId: analyticsCatalog.id, metadata: { extensions: { surfaces_expects: { strict: { type: "object", properties: { n: { type: "number" } }, required: ["n"] } } } } } },
            components([
              { id: "root", component: "Column", children: ["bad", "go", "strict", "name"] },
              { id: "bad", component: "Stat", label: 4 },
              { id: "go", component: "Button", child: "go-text", action: { event: { name: "go", context: { region: "EU" } } } },
              { id: "go-text", component: "Text", text: "Go" },
              { id: "strict", component: "Button", child: "strict-text", action: { event: { name: "strict", context: { n: "three" } } } },
              { id: "strict-text", component: "Text", text: "Strict" },
              { id: "name", component: "TextField", label: "Name", value: { "@path": "/name" } },
            ]),
          ]}
        />,
      ),
    );
    expect(recorder.get().events.find((e) => e.kind === "problem")).toMatchObject({ name: "VALIDATION_FAILED", componentId: "bad", status: "error" });
    fireEvent.click(screen.getByRole("button", { name: "Go" }));
    fireEvent.click(screen.getByRole("button", { name: "Strict" }));
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Ada" } });
    const out = recorder.get().events.filter((e) => e.kind === "event");
    expect(out[0]).toMatchObject({ name: "go", status: "ok", componentId: "go", detail: { type: "action", context: { region: "EU" }, contract: "none", sent: true } });
    expect(out[1]).toMatchObject({ name: "strict", status: "error", detail: { contract: "failed", sent: false } });
    expect(onAction).toHaveBeenCalledTimes(1);
    expect(names(recorder, "problem")).toContain("CONTRACT_FAILED");
    const write = recorder.get().events.find((e) => e.name === "data.write")!;
    expect(write).toMatchObject({ kind: "state", componentId: "name", detail: { path: "/name", value: "Ada" } });
    expect(replay(recorder.get().events, undefined, options).surfaces[write.surfaceId!]!.data).toEqual({ name: "Ada" });
  });

  it("records a surface handed over whole, once for each form it takes", () => {
    const recorder = createRecorder();
    const surface: Surface = { surfaceId: "page", catalogId: analyticsCatalog.id, a2ui: v, components: { root: { id: "root", component: "Text", text: "Saved page" } }, data: {} };
    const view = (s: Surface) => traced(recorder, <SurfaceView surface={s} catalog={analyticsCatalog} renderers={analyticsRenderers} />);
    const { rerender } = render(view(surface));
    rerender(view({ ...surface }));
    rerender(view({ ...surface, components: { root: { id: "root", component: "Text", text: "Edited page" } } }));
    const messages = recorder.get().events.filter((e) => e.kind === "message");
    expect(messages.map((e) => e.detail.snapshot)).toEqual([true, true]);
    expect((replay(recorder.get().events, messages[0]!.seq, options).surfaces[messages[0]!.surfaceId!]!.components.root as any).text).toBe("Saved page");
    expect((replay(recorder.get().events, undefined, options).surfaces[messages[0]!.surfaceId!]!.components.root as any).text).toBe("Edited page");
  });
});

describe("a component that throws", () => {
  const renderers: Record<string, ComponentRenderer> = {
    ...analyticsRenderers,
    Badge: ({ props }) => {
      if (props.text === "boom") throw new Error("Badge broke");
      return <span>{String(props.text)}</span>;
    },
  };
  const initial = [create, components([{ id: "root", component: "Column", children: ["ok", "bad"] }, { id: "ok", component: "Text", text: "Still here" }, { id: "bad", component: "Badge", text: "boom" }])];

  it("shows the usual notice in its place, with or without a recorder, and is tried again when sent again", () => {
    const quiet = vi.spyOn(console, "error").mockImplementation(() => {});
    let api!: UseSurfaces;
    render(<Host initial={initial} renderers={renderers} expose={(s) => (api = s)} />);
    expect(screen.getByText("Still here")).toBeTruthy();
    expect(screen.getByRole("note").textContent).toBe('Badge "bad" could not be drawn: Badge broke');
    act(() => api.apply(components([{ id: "bad", component: "Badge", text: "Fixed" }])));
    expect(screen.getByText("Fixed")).toBeTruthy();
    expect(screen.queryByRole("note")).toBeNull();
    quiet.mockRestore();
  });

  it("is recorded as a problem against the component", () => {
    const quiet = vi.spyOn(console, "error").mockImplementation(() => {});
    const recorder = createRecorder();
    render(traced(recorder, <Host recorder={recorder} initial={initial} renderers={renderers} />));
    expect(recorder.get().events.find((e) => e.kind === "problem")).toMatchObject({ name: "RENDER_FAILED", componentId: "bad", detail: { message: 'Badge "bad" could not be drawn: Badge broke' } });
    quiet.mockRestore();
  });
});

describe("pointing at a component", () => {
  it("marks the one component a tool points at, and nothing once it stops", () => {
    const recorder = createRecorder();
    const initial = [create, components([{ id: "root", component: "Column", children: ["t", "s"] }, { id: "t", component: "Text", text: "Sales", variant: "h1" }, { id: "s", component: "Stat", label: "Revenue", value: 10 }])];
    const view = render(traced(recorder, <Host initial={initial} />));
    const html = view.container.innerHTML;
    const surfaceKey = recorder.get().events.find((e) => e.kind === "component")!.surfaceId!;
    const marks = () => view.container.querySelectorAll("template[data-sf-inspect]");
    expect(marks().length).toBe(0);

    act(() => recorder.inspect({ surfaceKey, componentId: "s" }));
    expect(marks().length).toBe(1);
    // The component's own element is the next one: nothing wraps it.
    expect(marks()[0]!.nextElementSibling!.textContent).toContain("Revenue");

    act(() => recorder.inspect({ surfaceKey: "another", componentId: "s" }));
    expect(marks().length).toBe(0);
    act(() => recorder.inspect(undefined));
    expect(view.container.innerHTML).toBe(html);
    expect(recorder.get().events.some((e) => /inspect/i.test(e.name))).toBe(false);
  });
});

describe("with no recorder", () => {
  it("draws the same markup as with one", async () => {
    const initial = [create, components([{ id: "root", component: "Column", children: ["t", "s"] }, { id: "t", component: "Text", text: "Sales", variant: "h1" }, { id: "s", component: "Stat", label: "Revenue", value: 10 }])];
    const plainView = render(<Host initial={initial} />);
    const html = plainView.container.innerHTML;
    plainView.unmount();
    const tracedView = render(traced(createRecorder(), <Host initial={initial} />));
    expect(tracedView.container.innerHTML).toBe(html);
  });
});
