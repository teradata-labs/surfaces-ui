import { type Surface, analyticsCatalog } from "@surfaces-ui/spec";
import { type Recorder, createRecorder, recordMessage } from "@surfaces-ui/trace";
import { describe, expect, it } from "vitest";
import { saidBlocks } from "./Panel.js";
import { componentFindings } from "./cause.js";

const key = "s1:main";
const surface = (components: Record<string, unknown>[], data: unknown = {}): Surface =>
  ({ surfaceId: "main", catalogId: analyticsCatalog.id, components: Object.fromEntries(components.map((c) => [c.id, c])), data }) as unknown as Surface;
const send = (recorder: Recorder, components: Record<string, unknown>[], more: { applied?: boolean; issues?: { path: string; message: string }[]; error?: { message: string } } = {}) =>
  recordMessage(recorder, { format: "a2ui", key, raw: { version: "v1.0", updateComponents: { surfaceId: "main", components } }, ...more });
const at = (componentId: string) => ({ traceId: "a".repeat(32), spanId: "b".repeat(16), surfaceId: key, componentId });
const rules = (recorder: Recorder, s: Surface | undefined, componentId: string) => componentFindings({ events: recorder.get().events, surfaceKey: key, surface: s, componentId }).map((f) => f.rule);

const root = { id: "root", component: "Column", children: ["chart"] };
const chart = { id: "chart", component: "Chart", sourceId: "memory", sql: "SELECT 1", type: "bar", x: "region" };

describe("componentFindings", () => {
  it("finds nothing when nothing recorded points at a problem", () => {
    const recorder = createRecorder();
    send(recorder, [root, chart]);
    recorder.record({ kind: "service", name: "DataSource.execute", status: "ok", durationMs: 20, detail: { response: { rows: 4, columns: [] } } }, at("chart"));
    expect(rules(recorder, surface([root, chart]), "chart")).toEqual([]);
  });

  it("puts a refused message before everything it led to, and names what the catalog said", () => {
    const recorder = createRecorder();
    send(recorder, [root, chart], { applied: false, issues: [{ path: "/components/1/type", message: "Invalid option" }], error: { message: "VALIDATION_FAILED" } });
    recorder.record({ kind: "problem", name: "RENDER_FAILED", status: "error", detail: { code: "RENDER_FAILED", path: "/chart", message: "boom" } }, at("chart"));
    const found = componentFindings({ events: recorder.get().events, surfaceKey: key, surface: surface([root, chart]), componentId: "chart" });
    expect(found.map((f) => f.rule)).toEqual(["refused", "invalid", "render-failed"]);
    expect(found[1]!.detail).toBe("/components/1/type Invalid option");
    // Another component of the same message is not blamed for the chart's issue.
    expect(rules(recorder, surface([root, chart]), "root")).toEqual(["refused"]);
  });

  it("says when nothing draws it, when its container failed, and when a binding points at nothing", () => {
    const recorder = createRecorder();
    const text = { id: "t", component: "Text", text: { "@path": "/title" } };
    const orphan = { id: "orphan", component: "Text", text: "x" };
    const card = { id: "card", component: "Card", child: "t" };
    send(recorder, [{ ...root, children: ["card"] }, card, text, orphan]);
    recorder.record({ kind: "problem", name: "VALIDATION_FAILED", status: "error", detail: { code: "VALIDATION_FAILED", path: "/card", message: "bad card" } }, at("card"));
    const s = surface([{ ...root, children: ["card"] }, card, text, orphan], { other: 1 });
    expect(rules(recorder, s, "orphan")).toEqual(["unreachable"]);
    expect(rules(recorder, s, "t")).toEqual(["container", "binding"]);
    expect(rules(recorder, surface([{ ...root, children: ["card"] }, card, text], { title: "Sales" }), "t")).toEqual(["container"]);
  });

  it("reports a failed query with where it failed, an empty one, and drops both once the same call answered later", () => {
    const recorder = createRecorder({ now: (() => { let t = 0; return () => (t += 1000); })() });
    send(recorder, [root, chart]);
    const s = surface([root, chart]);
    recorder.record({ kind: "service", name: "DataSource.execute", status: "error", durationMs: 10, detail: { error: { code: "INVALID_SQL", message: "no such column", line: 1, column: 8 } } }, at("chart"));
    let found = componentFindings({ events: recorder.get().events, surfaceKey: key, surface: s, componentId: "chart" });
    expect(found.map((f) => f.rule)).toEqual(["query-failed"]);
    expect(found[0]!.detail).toBe("INVALID_SQL no such column (line 1, column 8)");
    expect(found[0]!.eventId).toBe(recorder.get().events.at(-1)!.id);

    recorder.record({ kind: "service", name: "DataSource.execute", status: "ok", durationMs: 10, detail: { response: { rows: 0, columns: [{ name: "region" }] } } }, at("chart"));
    expect(rules(recorder, s, "chart")).toEqual(["no-rows"]);
    recorder.record({ kind: "service", name: "DataSource.execute", status: "warning", durationMs: 5, detail: { cancelled: true, error: { message: "aborted" } } }, at("chart"));
    expect(rules(recorder, s, "chart")).toEqual(["no-rows", "cancelled"]);
    recorder.record({ kind: "service", name: "DataSource.execute", status: "ok", durationMs: 4000, detail: { response: { rows: 12, columns: [] } } }, at("chart"));
    expect(rules(recorder, s, "chart")).toEqual(["slow"]);
    // Another component's failure is not this one's.
    recorder.record({ kind: "service", name: "DataSource.execute", status: "error", durationMs: 1, detail: { error: { message: "x" } } }, at("other"));
    expect(rules(recorder, s, "chart")).toEqual(["slow"]);
    // A step back in time sees only what had happened by then.
    const first = recorder.get().events.find((e) => e.status === "error")!;
    expect(componentFindings({ events: recorder.get().events, surfaceKey: key, surface: s, componentId: "chart", upTo: first.seq }).map((f) => f.rule)).toEqual(["query-failed"]);
  });
});

describe("saidBlocks", () => {
  it("reads what was asked as prose, lists and data", () => {
    const blocks = saidBlocks(['Source "retail" (DuckDB SQL). Tables:', "- orders(order_id BIGINT, amount DOUBLE)", "- stores(store_id BIGINT)", "", "Instruction: Add a number", "", "Current components:", JSON.stringify([{ id: "root", component: "Column", children: ["a", "b"] }])].join("\n"));
    expect(blocks.map((b) => b.kind)).toEqual(["text", "list", "text", "text", "json"]);
    expect(blocks[1]).toEqual({ kind: "list", items: ["orders(order_id BIGINT, amount DOUBLE)", "stores(store_id BIGINT)"] });
    expect(blocks[2]).toEqual({ kind: "text", lines: ["Instruction: Add a number"] });
    expect((blocks[4] as { code: string }).code).toContain('\n    "id": "root"');
    // Data cut short when it was recorded is shown as it is, not dropped.
    expect(saidBlocks('[{"id":"root","component":"Column","children":["a","b"]},{"id":"a","comp')[0]).toEqual({ kind: "json", code: '[{"id":"root","component":"Column","children":["a","b"]},{"id":"a","comp' });
    expect(saidBlocks("Show revenue")).toEqual([{ kind: "text", lines: ["Show revenue"] }]);
    expect(saidBlocks("")).toEqual([]);
  });
});
