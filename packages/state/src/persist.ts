import type { Store } from "./store.js";

/** Where saved state lives. Implement it over any storage: the browser, a host bridge, a server. */
export interface StateStorage {
  load(key: string): string | null | undefined | Promise<string | null | undefined>;
  save(key: string, value: string): void | Promise<void>;
}

/** Keeps state for the lifetime of the page. For tests, and for hosts with no storage. */
export function memoryStorage(initial: Record<string, string> = {}): StateStorage & { data: Record<string, string> } {
  const data = { ...initial };
  return { data, load: (key) => data[key], save: (key, value) => void (data[key] = value) };
}

/** The browser's localStorage. Safe to create where it does not exist or is blocked: it then keeps nothing. */
export function browserStorage(): StateStorage {
  const storage = (() => {
    try {
      return typeof localStorage === "undefined" ? undefined : localStorage;
    } catch {
      return undefined;
    }
  })();
  return {
    load(key) {
      try {
        return storage?.getItem(key);
      } catch {
        return undefined;
      }
    },
    save(key, value) {
      try {
        storage?.setItem(key, value);
      } catch {
        // Full or blocked storage must not break the page.
      }
    },
  };
}

export interface PersistOptions<T> {
  key: string;
  storage: StateStorage;
  /** Bump when the shape changes; older saved state then goes through `migrate`, or is dropped without it. */
  version?: number;
  migrate?(saved: unknown, fromVersion: number): T | undefined;
  /**
   * Checks saved state before it is used. Saved state can be edited by
   * anyone with access to the storage, so it is not trusted: return
   * undefined to ignore it.
   */
  parse?(saved: unknown): T | undefined;
  /** Wait this long after the last change before saving. Defaults to 200 ms. */
  debounceMs?: number;
  /** What to save, when not all of the state should outlive the page. */
  select?(value: T): unknown;
}

const replacer = (_: string, value: unknown) => (typeof value === "bigint" ? { $bigint: String(value) } : value);
const reviver = (_: string, value: unknown) =>
  value !== null && typeof value === "object" && typeof (value as { $bigint?: unknown }).$bigint === "string" ? BigInt((value as { $bigint: string }).$bigint) : value;

/** Text for a state value. Large integers survive the round trip. */
export const encodeState = (value: unknown) => JSON.stringify(value, replacer);
export const decodeState = (text: string): unknown => JSON.parse(text, reviver);

/**
 * Loads a store's saved value and saves it again after each change. Returns
 * `ready` (resolved once the saved value has been applied) and `stop`.
 */
export function persist<T>(store: Store<T>, options: PersistOptions<T>): { ready: Promise<void>; stop(): void; flush(): void } {
  const { key, storage, version = 1, debounceMs = 200 } = options;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let stopped = false;
  const write = () => {
    timer = undefined;
    void storage.save(key, encodeState({ version, state: options.select ? options.select(store.get()) : store.get() }));
  };
  const ready = (async () => {
    try {
      const text = await storage.load(key);
      if (stopped || !text) return;
      const saved = decodeState(text) as { version?: number; state?: unknown };
      const from = typeof saved?.version === "number" ? saved.version : 0;
      const raw = from === version ? saved.state : options.migrate?.(saved?.state, from);
      const value = raw === undefined ? undefined : options.parse ? options.parse(raw) : (raw as T);
      if (value !== undefined) store.set(value);
    } catch {
      // Unreadable saved state is ignored; the store keeps its initial value.
    }
  })();
  const unsubscribe = store.subscribe(() => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(write, debounceMs);
  });
  return {
    ready,
    flush() {
      if (!timer) return;
      clearTimeout(timer);
      write();
    },
    stop() {
      stopped = true;
      unsubscribe();
      if (timer) {
        clearTimeout(timer);
        write();
      }
    },
  };
}

export interface UrlSyncOptions<T> {
  /** Query parameter that carries the state. */
  param: string;
  /** Turns state into a short string. Return "" to leave the parameter out. Never put personal data here. */
  encode(value: T): string;
  /** Reads state back. The address bar is untrusted input: return undefined for anything unexpected. */
  decode(text: string): T | undefined;
  /** Defaults to the page's own location and history. */
  location?: { href: string };
  history?: { replaceState(data: unknown, unused: string, url: string): void };
  /** Listens for back and forward. Defaults to window. */
  events?: { addEventListener(type: "popstate", listener: () => void): void; removeEventListener(type: "popstate", listener: () => void): void };
}

/**
 * Keeps a store and a query parameter in step, so a view can be linked to
 * and survives a reload. The address is replaced, not pushed, so filtering
 * does not fill the back button.
 */
export function syncUrl<T>(store: Store<T>, options: UrlSyncOptions<T>): () => void {
  const location = options.location ?? globalThis.location;
  const history = options.history ?? globalThis.history;
  const events = options.events ?? (typeof window === "undefined" ? undefined : window);
  if (!location || !history) return () => {};
  const read = () => {
    const text = new URL(location.href).searchParams.get(options.param);
    if (text === null) return;
    const value = options.decode(text);
    if (value !== undefined) store.set(value);
  };
  read();
  const unsubscribe = store.subscribe((value) => {
    const url = new URL(location.href);
    const text = options.encode(value);
    if (text === "") url.searchParams.delete(options.param);
    else url.searchParams.set(options.param, text);
    if (url.href !== location.href) history.replaceState(null, "", url.href);
  });
  events?.addEventListener("popstate", read);
  return () => {
    unsubscribe();
    events?.removeEventListener("popstate", read);
  };
}
