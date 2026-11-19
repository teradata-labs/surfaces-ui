import { agentEvent, scriptedAgent } from "@surfaces-ui/agent";
import { collect, memoryDataSource, toRows } from "@surfaces-ui/data";
import { describe, expect, it, vi } from "vitest";
import {
  WITHHELD,
  createRecorder,
  diffJson,
  parseTraceparent,
  performanceTracks,
  plain,
  recordMessage,
  replay,
  responseSummary,
  stepDiff,
  traceAgent,
  traceDataSource,
  traceService,
  traceSteps,
  traceparent,
} from "./index.js";

const SECRET_VALUES = ["Zanzibar-7731", "Quetzalcoatl-9920", "Ouagadougou-4418"];
const rows = SECRET_VALUES.map((city, i) => ({ id: i + 1, city, amount: 1000 + i }));
const source = () => memoryDataSource({ tables: { orders: rows } });

describe("recorder", () => {
  it("records events with trace context ids and keeps them in order", () => {
    const recorder = createRecorder();
    const a = recorder.record({ kind: "problem", name: "VALIDATION_FAILED", status: "error", detail: { path: "/root" } });
    const span = recorder.start({ kind: "service", name: "DataSource.count" });
    const child = recorder.record({ kind: "state", name: "controls" }, span.scope);
    span.end({ detail: { rows: 3 } });
    const { events } = recorder.get();
    expect(events.map((e) => e.seq)).toEqual([1, 2, 3]);
    expect(a.traceId).toMatch(/^[0-9a-f]{32}$/);
    expect(a.spanId).toMatch(/^[0-9a-f]{16}$/);
    expect(child.traceId).toBe(events[1]!.traceId);
    expect(child.parentId).toBe(events[1]!.spanId);
    expect(events[1]!.status).toBe("ok");
    expect(events[1]!.durationMs).toBeGreaterThanOrEqual(0);
    expect(events[1]!.detail.rows).toBe(3);
    expect(parseTraceparent(traceparent(span.scope))).toEqual({ traceId: child.traceId, spanId: child.parentId });
    expect(parseTraceparent("not one")).toBeUndefined();
  });

  it("stays within its limit, letting the oldest go", () => {
    const recorder = createRecorder({ limit: 3 });
    for (let i = 0; i < 5; i++) recorder.record({ kind: "event", name: `e${i}` });
    expect(recorder.get().events.map((e) => e.name)).toEqual(["e2", "e3", "e4"]);
    expect(recorder.get().dropped).toBe(2);
    // An event that was let go can still be ended without harm.
    recorder.update("gone", { status: "error" });
  });

  it("tells subscribers once per burst, after the code that recorded", async () => {
    const recorder = createRecorder();
    const heard = vi.fn();
    const stop = recorder.subscribe(heard);
    recorder.record({ kind: "event", name: "a" });
    recorder.record({ kind: "event", name: "b" });
    expect(heard).not.toHaveBeenCalled();
    await Promise.resolve();
    expect(heard).toHaveBeenCalledTimes(1);
    expect(heard.mock.calls[0]![0].events).toHaveLength(2);
    stop();
    recorder.record({ kind: "event", name: "c" });
    await Promise.resolve();
    expect(heard).toHaveBeenCalledTimes(1);
    recorder.clear();
    expect(recorder.get().events).toEqual([]);
  });

  it("joins a message recorded with no scope to the turn in progress", () => {
    const recorder = createRecorder();
    const turn = recorder.start({ kind: "agent", name: "turn: text" });
    const leave = recorder.enter(turn.scope);
    const inside = recorder.record({ kind: "message", name: "createSurface", surfaceId: "s1:main" });
    leave();
    const outside = recorder.record({ kind: "message", name: "createSurface", surfaceId: "s2:main" });
    expect(inside.parentId).toBe(turn.id);
    expect(outside.parentId).toBeUndefined();
    expect(recorder.surfaceScope("s1:main")).toMatchObject({ traceId: inside.traceId, spanId: inside.spanId });
  });
});

describe("plain", () => {
  it("keeps binary data as a length, withholds credentials and cuts long values", () => {
    const out = plain({
      $typeName: "x",
      arrowBatch: new Uint8Array(64),
      password: "hunter2",
      apiKey: "sk-live",
      headers: { Authorization: "Bearer abc" },
      secret: "LAKE",
      inputTokens: 12,
      big: 12n,
      huge: 2n ** 80n,
      text: "x".repeat(30),
      list: [1, 2, 3, 4],
    }, { maxString: 10, maxItems: 2 }) as Record<string, unknown>;
    expect(out).toEqual({
      arrowBatch: { "@bytes": 64 },
      password: WITHHELD,
      apiKey: WITHHELD,
      headers: { Authorization: WITHHELD },
      secret: "LAKE",
      inputTokens: 12,
      big: 12,
      huge: (2n ** 80n).toString(),
      text: "xxxxxxxxxx… [20 more characters]",
      list: [1, 2, "[2 more]"],
    });
  });

  it("summarises an answer without walking its lists", () => {
    expect(responseSummary({ tables: [{ name: "orders" }], total: 4n, sampleRows: [["Zanzibar"]], description: "About orders", executedSql: "SELECT 1", inner: { values: ["a"], ok: true } })).toEqual({
      tables: { "@count": 1 },
      total: 4,
      sampleRows: { "@count": 1 },
      description: { "@text": 12 },
      executedSql: "SELECT 1",
      inner: { values: { "@count": 1 }, ok: true },
    });
  });
});

describe("traceDataSource", () => {
  it("records a streamed query with its SQL and counts, and gives the same rows", async () => {
    const recorder = createRecorder();
    const traced = traceDataSource(source(), recorder);
    const request = { sourceId: "memory", query: { baseSql: "SELECT * FROM orders", page: { limit: 2, offset: 0n } } };
    const result = await collect(traced.execute(request));
    const plainResult = await collect(source().execute(request));
    expect(toRows(result.table)).toEqual(toRows(plainResult.table));

    const [event] = recorder.get().events;
    expect(event).toMatchObject({ kind: "service", name: "DataSource.execute", status: "ok" });
    expect(event!.durationMs).toBeGreaterThanOrEqual(0);
    const detail = event!.detail as { request: { query: { baseSql: string } }; response: Record<string, unknown> };
    expect(detail.request.query.baseSql).toBe("SELECT * FROM orders");
    expect(detail.response.rows).toBe(2);
    expect(detail.response.batches).toBeGreaterThan(0);
    expect(detail.response.bytes).toBeGreaterThan(0);
    expect(detail.response.columns).toEqual(expect.arrayContaining([expect.objectContaining({ name: "city" })]));
  });

  it("records unary calls and failures, and rethrows the same error", async () => {
    const recorder = createRecorder();
    const traced = traceDataSource(source(), recorder);
    const tables = await traced.listTables({ sourceId: "memory" });
    expect(tables.tables.length).toBe(1);
    await expect(collect(traced.execute({ sourceId: "memory", query: { baseSql: "SELECT * FROM missing" } }))).rejects.toThrow(/missing/i);
    const [list, failed] = recorder.get().events;
    expect(list).toMatchObject({ name: "DataSource.listTables", status: "ok" });
    expect((list!.detail.response as Record<string, unknown>).tables).toEqual({ "@count": 1 });
    expect(failed).toMatchObject({ name: "DataSource.execute", status: "error" });
    expect((failed!.detail.error as { message: string }).message).toMatch(/missing/i);
  });

  it("never holds a row value, a batch or a credential", async () => {
    const recorder = createRecorder();
    const traced = traceDataSource(source(), recorder);
    await collect(traced.execute({ sourceId: "memory", query: { baseSql: "SELECT * FROM orders" } }));
    await traced.count({ sourceId: "memory", query: { baseSql: "SELECT * FROM orders" } });
    await traced.describeTable({ sourceId: "memory", ref: { table: "orders" } });
    const service = traceService("Vault", { open: async (_: { password: string; token: string }) => ({ rows: [SECRET_VALUES], note: SECRET_VALUES[0]! }) }, recorder);
    await service.open({ password: "hunter2-swordfish", token: "tok_live_1234" });
    const text = JSON.stringify(recorder.get().events);
    for (const value of [...SECRET_VALUES, "hunter2-swordfish", "tok_live_1234"]) expect(text).not.toContain(value);
    expect(text).not.toContain("arrowBatch");
    expect(recorder.get().events).toHaveLength(4);
  });

  it("is traced once however often it is wrapped, in the scope given last", async () => {
    const recorder = createRecorder();
    const once = traceDataSource(source(), recorder);
    const twice = traceDataSource(once, recorder, { scope: { traceId: "a".repeat(32), spanId: "b".repeat(16), componentId: "chart" } });
    await twice.count({ sourceId: "memory", query: { baseSql: "SELECT * FROM orders" } });
    expect(recorder.get().events).toHaveLength(1);
    expect(recorder.get().events[0]).toMatchObject({ parentId: "b".repeat(16), componentId: "chart" });
    // A stream the reader leaves early is ended, not left running.
    for await (const _ of twice.execute({ sourceId: "memory", query: { baseSql: "SELECT * FROM orders" } })) break;
    expect(recorder.get().events[1]).toMatchObject({ status: "ok" });
    expect(recorder.get().events[1]!.detail.stoppedEarly).toBe(true);
  });
});

describe("traceService", () => {
  it("handles plain values, promises, streams and properties", async () => {
    const recorder = createRecorder();
    const service = {
      label: "svc",
      now: (_: { n: number }) => ({ value: 1 }),
      later: async (_: { n: number }) => ({ value: 2 }),
      async *many(_: { n: number }) {
        yield 1;
        yield 2;
      },
      boom: () => {
        throw new Error("no");
      },
    };
    const traced = traceService("Svc", service, recorder);
    expect(traced.label).toBe("svc");
    expect(traced.now({ n: 1 })).toEqual({ value: 1 });
    expect(await traced.later({ n: 2 })).toEqual({ value: 2 });
    const seen: number[] = [];
    for await (const n of traced.many({ n: 3 })) seen.push(n);
    expect(seen).toEqual([1, 2]);
    expect(() => traced.boom()).toThrow("no");
    expect(recorder.get().events.map((e) => [e.name, e.status])).toEqual([["Svc.now", "ok"], ["Svc.later", "ok"], ["Svc.many", "ok"], ["Svc.boom", "error"]]);
    expect(recorder.get().events[2]!.detail.response).toEqual({ items: 2 });
    expect(traced.now).toBe(traced.now);
  });
});

describe("traceAgent", () => {
  const create = { version: "1.0", createSurface: { surfaceId: "main", catalogId: "analytics" } };
  it("records a turn as one trace: the request, text, steps, usage and the answer", async () => {
    const recorder = createRecorder();
    const agent = traceAgent(
      scriptedAgent(() => [
        agentEvent.text("Here "),
        agentEvent.step({ id: "q", title: "Query orders", tool: "run_sql", detail: "SELECT 1" }),
        agentEvent.text("you go."),
        agentEvent.surface(create),
        agentEvent.usage({ inputTokens: 10n, outputTokens: 4n }),
        agentEvent.done("s1", "scripted"),
      ]),
      recorder,
    );
    const events = [];
    for await (const event of agent.send({ sessionId: "", input: { case: "text", value: "Show orders" } })) {
      events.push(event);
      // What is recorded while the turn streams belongs to it.
      if (event.event.case === "surface") recordMessage(recorder, { format: "a2ui", key: "s1:main", raw: event.event.value });
    }
    expect(events).toHaveLength(6);
    const [turn, message] = recorder.get().events;
    expect(turn).toMatchObject({ kind: "agent", name: "turn: text", status: "ok" });
    expect(message).toMatchObject({ kind: "message", name: "createSurface", traceId: turn!.traceId, parentId: turn!.spanId });
    const detail = turn!.detail as Record<string, any>;
    expect(detail.request.input).toEqual({ case: "text", text: "Show orders" });
    expect(detail.text).toBe("Here you go.");
    expect(detail.steps).toEqual([expect.objectContaining({ id: "q", title: "Query orders", tool: "run_sql", detail: "SELECT 1" })]);
    expect(detail.surfaceMessages).toBe(1);
    expect(detail.usage).toMatchObject({ inputTokens: 10, outputTokens: 4 });
    expect(detail.generatedBy).toBe("scripted");
  });

  it("marks a turn that failed, and wraps an agent once", async () => {
    const recorder = createRecorder();
    const agent = traceAgent(scriptedAgent(() => [agentEvent.error("FAILED", "The model is away.")]), recorder);
    expect(traceAgent(agent, recorder)).toBe(agent);
    for await (const _ of agent.send({ input: { case: "text", value: "Hi" } })) void _;
    expect(recorder.get().events).toHaveLength(1);
    expect(recorder.get().events[0]).toMatchObject({ status: "error" });
    expect(recorder.get().events[0]!.detail.error).toEqual({ code: "FAILED", message: "The model is away." });
  });
});

// A surface model small enough to read here; the real one is handed in the same way from @surfaces-ui/spec.
type Mini = { components: Record<string, unknown>; data: unknown };
const options = {
  apply(surfaces: Record<string, Mini>, message: unknown): Record<string, Mini> {
    const m = message as Record<string, any>;
    if (m.createSurface) return { ...surfaces, [m.createSurface.surfaceId]: { components: {}, data: m.createSurface.dataModel ?? {} } };
    if (m.deleteSurface) return Object.fromEntries(Object.entries(surfaces).filter(([id]) => id !== m.deleteSurface.surfaceId));
    const body = m.updateComponents ?? m.updateDataModel;
    const held = surfaces[body.surfaceId];
    if (!held) throw new Error(`No surface "${body.surfaceId}"`);
    if (m.updateComponents) return { ...surfaces, [body.surfaceId]: { ...held, components: { ...held.components, ...Object.fromEntries(body.components.map((c: { id: string }) => [c.id, c])) } } };
    return { ...surfaces, [body.surfaceId]: { ...held, data: body.value } };
  },
  setPath: (model: unknown, path: string, value: unknown) => ({ ...(model as object), [path.slice(1)]: value }),
};

describe("replay", () => {
  const log = () => {
    const recorder = createRecorder();
    recordMessage(recorder, { format: "a2ui", key: "s1:main", raw: { version: "1.0", createSurface: { surfaceId: "main", dataModel: { region: "EU" } } } });
    recordMessage(recorder, { format: "a2ui", key: "s1:main", raw: { version: "1.0", updateComponents: { surfaceId: "main", components: [{ id: "root", component: "Text", text: "Hello" }] } } });
    recordMessage(recorder, { format: "a2ui", key: "s1:main", raw: { version: "1.0", updateComponents: { surfaceId: "gone", components: [] } }, applied: false, error: { message: "No surface" } });
    recorder.record({ kind: "state", name: "data.write", surfaceId: "s1:main", detail: { path: "/region", value: "NA" } });
    recorder.record({ kind: "state", name: "controls", surfaceId: "s1:main", componentId: "root", detail: { controls: { sorts: [{ column: "amount" }] } } });
    recorder.record({ kind: "service", name: "DataSource.count" });
    recordMessage(recorder, { format: "a2ui", key: "s1:main", raw: { version: "1.0", updateComponents: { surfaceId: "main", components: [{ id: "root", component: "Text", text: "Goodbye" }] } } });
    recordMessage(recorder, { format: "a2ui", key: "s2:main", raw: { version: "1.0", createSurface: { surfaceId: "main" } } });
    return recorder.get().events;
  };

  it("gives the surfaces as they stood at any step", () => {
    const events = log();
    expect(traceSteps(events).map((e) => e.seq)).toEqual([1, 2, 3, 4, 5, 7, 8]);
    expect(replay(events, 0, options).surfaces).toEqual({});
    expect(replay(events, 1, options).surfaces["s1:main"]).toEqual({ components: {}, data: { region: "EU" } });
    expect(replay(events, 2, options).surfaces["s1:main"]!.components).toEqual({ root: { id: "root", component: "Text", text: "Hello" } });
    // A message that was refused changes nothing.
    expect(replay(events, 3, options)).toEqual(replay(events, 2, options));
    const written = replay(events, 5, options);
    expect(written.surfaces["s1:main"]!.data).toEqual({ region: "NA" });
    expect(written.controls["s1:main"]).toEqual({ root: { sorts: [{ column: "amount" }] } });
    const end = replay(events, undefined, options);
    expect((end.surfaces["s1:main"]!.components.root as { text: string }).text).toBe("Goodbye");
    // Two hosts that both call a surface "main" are kept apart.
    expect(Object.keys(end.surfaces)).toEqual(["s1:main", "s2:main"]);
    // What the person wrote stays over the agent's data model.
    expect(end.surfaces["s1:main"]!.data).toEqual({ region: "NA" });
  });

  it("replaces a surface handed over whole, and forgets on reset", () => {
    const recorder = createRecorder();
    recordMessage(recorder, { format: "surface", key: "v1:page", snapshot: true, raw: { version: "1.0", createSurface: { surfaceId: "page", dataModel: { n: 1 } } } });
    recordMessage(recorder, { format: "surface", key: "v1:page", snapshot: true, raw: { version: "1.0", createSurface: { surfaceId: "page", dataModel: { n: 2 } } } });
    recorder.record({ kind: "state", name: "reset", detail: { prefix: "v1:" } });
    const { events } = recorder.get();
    expect(replay(events, 2, options).surfaces["v1:page"]!.data).toEqual({ n: 2 });
    expect(replay(events, 3, options).surfaces).toEqual({});
  });

  it("diffs a step against the one before", () => {
    const events = log();
    expect(stepDiff(events, 4, options)).toEqual([{ path: "/surfaces/s1:main/data/region", change: "changed", before: "EU", after: "NA" }]);
    expect(stepDiff(events, 7, options)).toEqual([{ path: "/surfaces/s1:main/components/root/text", change: "changed", before: "Hello", after: "Goodbye" }]);
    expect(diffJson({ a: [1, 2], b: 1 }, { a: [1], c: 2 })).toEqual([
      { path: "/a/1", change: "removed", before: 2 },
      { path: "/b", change: "removed", before: 1 },
      { path: "/c", change: "added", after: 2 },
    ]);
  });
});

describe("performanceTracks", () => {
  it("measures each finished span once on a track for its kind", async () => {
    const recorder = createRecorder();
    const measure = vi.spyOn(performance, "measure").mockImplementation(() => ({}) as PerformanceMeasure);
    const stop = performanceTracks(recorder);
    const span = recorder.start({ kind: "service", name: "DataSource.execute" });
    await Promise.resolve();
    expect(measure).not.toHaveBeenCalled();
    span.end();
    await Promise.resolve();
    await Promise.resolve();
    expect(measure).toHaveBeenCalledTimes(1);
    const [name, options_] = measure.mock.calls[0] as unknown as [string, { start: number; end: number; detail: { devtools: Record<string, unknown> } }];
    expect(name).toBe("DataSource.execute");
    expect(options_.end).toBeGreaterThanOrEqual(options_.start);
    expect(options_.detail.devtools).toMatchObject({ dataType: "track-entry", track: "Service calls", trackGroup: "Surfaces UI" });
    stop();
    measure.mockRestore();
  });
});

describe("a call the caller stopped", () => {
  it("is recorded as a warning, not a failure", async () => {
    const recorder = createRecorder();
    const stop = new AbortController();
    const service = traceService("Svc", { wait: (_: object, options?: { signal?: AbortSignal }) => new Promise((_, reject) => options?.signal?.addEventListener("abort", () => reject(new Error("signal is aborted without reason")))) }, recorder);
    const pending = service.wait({}, { signal: stop.signal });
    stop.abort();
    await expect(pending).rejects.toThrow();
    expect(recorder.get().events[0]).toMatchObject({ status: "warning", detail: { cancelled: true } });
  });
});
