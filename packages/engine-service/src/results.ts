import { clone, toJsonString } from "@bufbuild/protobuf";
import type { Engine, Param } from "@surfaces-ui/engine";
import { type TimeTravel, TimeTravelSchema, type ViewQuery, ViewQuerySchema } from "@surfaces-ui/proto";
import { assertReadOnly, hasViewState, isPlainScan, trimStatement } from "@surfaces-ui/sql";

export interface StoredResultsOptions {
  /** Largest result kept, in rows. A longer result is not kept and its views query live. Defaults to 250,000. */
  maxRows?: number;
  /** Results kept at once; the least recently used is dropped first. Defaults to 24. */
  maxEntries?: number;
  /** How long a result is kept after it was made, in ms. Defaults to 15 minutes. */
  ttlMs?: number;
}

/** A stored copy of one base query's result. */
export interface Held {
  key: string;
  relation: string;
  rowCount: number;
  /** ISO 8601 time the base query ran. */
  createdAt: string;
}

interface Entry {
  engine: Engine;
  /** Resolves to undefined when the result was too large to keep or could not be stored. */
  held: Promise<Held | undefined>;
  madeAt: number;
  usedAt: number;
  /** The `not_before` this entry was made for; requests asking for that or earlier are served by it. */
  madeFor: string;
}

export interface ResultStore {
  /**
   * The stored result to read for this view, running the base query once if
   * it is not held yet. Undefined means the view should query live.
   */
  get(sourceId: string, engine: Engine, query: ViewQuery, timeTravel: TimeTravel | undefined, notBefore: string): Promise<Held | undefined>;
  /** Stops using a stored result, e.g. after it turned out to be gone. */
  forget(key: string): void;
  /** Drops every stored result, e.g. after the data underneath changed. */
  clear(): void;
  close(): Promise<void>;
}

/** The view applied to the stored rows instead of to the base query. */
export function overStored(query: ViewQuery, held: Held): ViewQuery {
  const copy = clone(ViewQuerySchema, query);
  copy.baseSql = `SELECT * FROM ${held.relation}`;
  copy.parameters = [];
  return copy;
}

/**
 * Keeps query results so that sorting, filtering, paging and charting one
 * query do not run it again each time. Requests for the same base query share
 * one run. Plain table scans are never kept: engines page those directly.
 *
 * Results are shared by everyone who can reach the server. A server with more
 * than one user must put the user in the key (or keep one store per user).
 */
export function createResultStore(options: StoredResultsOptions = {}): ResultStore {
  const maxRows = options.maxRows ?? 250_000;
  const maxEntries = options.maxEntries ?? 24;
  const ttlMs = options.ttlMs ?? 15 * 60_000;
  const entries = new Map<string, Entry>();

  const drop = (key: string) => {
    const entry = entries.get(key);
    if (!entry) return;
    entries.delete(key);
    void entry.held.then((held) => held && entry.engine.dropStored?.(held.relation)).catch(() => {});
  };

  const sweep = () => {
    const now = Date.now();
    for (const [key, entry] of entries) if (now - entry.madeAt > ttlMs) drop(key);
    const byUse = [...entries].sort((a, b) => a[1].usedAt - b[1].usedAt);
    for (const [key] of byUse.slice(0, Math.max(0, entries.size - maxEntries))) drop(key);
  };

  return {
    async get(sourceId, engine, query, timeTravel, notBefore) {
      if (!engine.store || !hasViewState(query) || isPlainScan(query.baseSql)) return undefined;
      const sql = trimStatement(query.baseSql);
      const key = JSON.stringify([
        sourceId,
        sql,
        query.parameters.map((p) => [p.kind.case, String(p.kind.value)]),
        timeTravel ? toJsonString(TimeTravelSchema, timeTravel) : "",
      ]);
      const now = Date.now();
      let entry = entries.get(key);
      if (entry && (now - entry.madeAt > ttlMs || (notBefore !== "" && entry.madeFor < notBefore && new Date(entry.madeAt).toISOString() < notBefore))) {
        drop(key);
        entry = undefined;
      }
      if (!entry) {
        assertReadOnly(sql, engine.dialect);
        const params = query.parameters.map((p) => p.kind.value as Param);
        const held = engine
          .store(sql, params, { maxRows, timeTravel })
          .then(async (stored): Promise<Held | undefined> => {
            if (stored.complete) return { key, relation: stored.relation, rowCount: stored.rowCount, createdAt: new Date(now).toISOString() };
            await engine.dropStored?.(stored.relation).catch(() => {});
            return undefined;
          })
          .catch(() => {
            // The live path runs the query and reports what is wrong with it.
            if (entries.get(key) === created) entries.delete(key);
            return undefined;
          });
        const created: Entry = { engine, held, madeAt: now, usedAt: now, madeFor: notBefore };
        entry = created;
        entries.set(key, entry);
        sweep();
      }
      entry.usedAt = now;
      return entry.held;
    },
    forget: drop,
    clear() {
      for (const key of [...entries.keys()]) drop(key);
    },
    async close() {
      for (const key of [...entries.keys()]) drop(key);
    },
  };
}
