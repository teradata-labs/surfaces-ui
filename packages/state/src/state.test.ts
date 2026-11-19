import { FilterOperator } from "@surfaces-ui/proto";
import { describe, expect, it, vi } from "vitest";
import { createQueryRuns, createStore, createViewState, decodeState, derive, encodeState, memoryStorage, parseViewState, persist, syncUrl, withHistory } from "./index.js";

describe("store", () => {
  it("notifies on change only, and derives values that update when they differ", () => {
    const store = createStore({ count: 1, label: "a" });
    const seen: number[] = [];
    const doubled = derive(store, (s) => s.count * 2);
    const stop = doubled.subscribe((value) => seen.push(value));
    store.set((s) => ({ ...s, label: "b" }));
    store.set((s) => ({ ...s, count: 2 }));
    store.set(store.get());
    expect(seen).toEqual([4]);
    stop();
    store.set((s) => ({ ...s, count: 5 }));
    expect(seen).toEqual([4]);
    expect(doubled.get()).toBe(10);
  });

  it("undoes and redoes without recording the travel itself", () => {
    const store = createStore(0);
    const history = withHistory(store);
    store.set(1);
    store.set(2);
    history.undo();
    expect(store.get()).toBe(1);
    history.undo();
    expect([store.get(), history.canUndo(), history.canRedo()]).toEqual([0, false, true]);
    history.redo();
    expect(store.get()).toBe(1);
    store.set(9);
    expect(history.canRedo()).toBe(false);
  });

  it("records again after being stopped and started, as a StrictMode effect rerun does", () => {
    const store = createStore(0);
    const history = withHistory(store);
    history.stop();
    store.set(1);
    expect(history.canUndo()).toBe(false);
    history.start();
    history.start();
    store.set(2);
    history.undo();
    expect([store.get(), history.canUndo()]).toEqual([1, false]);
  });
});

describe("persistence", () => {
  it("restores saved state, saves changes, and refuses state that fails its check", async () => {
    vi.useFakeTimers();
    const storage = memoryStorage({ view: encodeState({ version: 1, state: { n: 7n } }), bad: encodeState({ version: 1, state: "<script>" }), old: encodeState({ version: 0, state: 3 }) });
    const store = createStore<{ n: bigint }>({ n: 0n });
    const saving = persist(store, { key: "view", storage });
    await saving.ready;
    expect(store.get()).toEqual({ n: 7n });
    store.set({ n: 8n });
    vi.advanceTimersByTime(250);
    expect(decodeState(storage.data.view!)).toEqual({ version: 1, state: { n: 8n } });
    saving.stop();

    const guarded = createStore(1);
    await persist(guarded, { key: "bad", storage, parse: (v) => (typeof v === "number" ? v : undefined) }).ready;
    expect(guarded.get()).toBe(1);
    const migrated = createStore(0);
    await persist(migrated, { key: "old", storage, version: 2, migrate: (saved) => Number(saved) * 10 }).ready;
    expect(migrated.get()).toBe(30);
    vi.useRealTimers();
  });

  it("keeps a query parameter in step with the store", () => {
    const location = { href: "https://app.test/dash?view=EU&other=1" };
    const history = { replaceState: (_: unknown, __: string, url: string) => void (location.href = url) };
    const store = createStore("");
    const stop = syncUrl(store, { param: "view", encode: (v) => v, decode: (t) => (/^[A-Z]+$/.test(t) ? t : undefined), location, history, events: undefined });
    expect(store.get()).toBe("EU");
    store.set("NA");
    expect(location.href).toBe("https://app.test/dash?view=NA&other=1");
    store.set("");
    expect(location.href).toBe("https://app.test/dash?other=1");
    stop();
  });
});

describe("view state", () => {
  it("turns selections and ranges into engine filters, leaving out a view's own column", () => {
    const view = createViewState();
    view.toggle("region", "Europe");
    view.toggle("region", "Asia Pacific");
    view.toggle("status", "shipped");
    view.setRange("ordered_at", { from: "2026-01-01" });
    expect(view.filters()).toEqual([
      { column: "region", operator: FilterOperator.IN, values: [{ kind: { case: "stringValue", value: "Europe" } }, { kind: { case: "stringValue", value: "Asia Pacific" } }] },
      { column: "status", operator: FilterOperator.EQ, values: [{ kind: { case: "stringValue", value: "shipped" } }] },
      { column: "ordered_at", operator: FilterOperator.GTE, values: [{ kind: { case: "stringValue", value: "2026-01-01" } }] },
    ]);
    expect(view.filters("region").map((f) => f.column)).toEqual(["status", "ordered_at"]);
    expect(view.activeCount()).toBe(3);
    view.toggle("status", "shipped");
    view.clear("ordered_at");
    expect(view.filters().map((f) => f.column)).toEqual(["region"]);
    view.clear();
    expect(view.get()).toEqual({ selections: {}, ranges: {}, sorts: [] });
  });

  it("checks view state that comes from storage or the address bar", () => {
    expect(parseViewState({ selections: { region: ["EU", 3], bad: [{}], empty: [] }, ranges: { d: { from: "a", to: {} } }, sorts: [{ column: "x", desc: 1 }, "no"] })).toEqual({
      selections: { region: ["EU", 3] },
      ranges: { d: { from: "a" } },
      sorts: [{ column: "x", desc: false }],
    });
    expect(parseViewState("nope")).toBeUndefined();
  });
});

describe("query runs", () => {
  it("gives every run a time and keeps a history of what was run before", () => {
    let tick = 0;
    const runs = createQueryRuns({ now: () => new Date(Date.UTC(2026, 0, 1, 0, 0, tick++)) });
    const first = runs.run("SELECT 1");
    const again = runs.rerun()!;
    expect(again.sql).toBe("SELECT 1");
    expect(again.ranAt > first.ranAt).toBe(true);
    runs.run("SELECT 2");
    expect(runs.get().current?.sql).toBe("SELECT 2");
    expect(runs.get().history.map((r) => r.sql)).toEqual(["SELECT 1"]);
  });
});
