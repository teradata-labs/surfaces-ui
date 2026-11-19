/** A value that can be read, replaced and watched. The base of every state service here. */
export interface Store<T> {
  get(): T;
  /** Replaces the value, or computes the next one from the current one. Setting an identical value notifies nobody. */
  set(next: T | ((current: T) => T)): void;
  /** Calls `listener` after each change. Returns a function that stops it. */
  subscribe(listener: (value: T, previous: T) => void): () => void;
}

/**
 * Creates a store. It has no dependency on React or the DOM, so the same
 * state can drive components, an MCP app page, a test, or code on a server.
 */
export function createStore<T>(initial: T): Store<T> {
  let value = initial;
  const listeners = new Set<(value: T, previous: T) => void>();
  return {
    get: () => value,
    set(next) {
      const resolved = typeof next === "function" ? (next as (current: T) => T)(value) : next;
      if (Object.is(resolved, value)) return;
      const previous = value;
      value = resolved;
      for (const listener of [...listeners]) listener(value, previous);
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => void listeners.delete(listener);
    },
  };
}

/** A read-only store computed from another. It updates only when the computed value changes. */
export function derive<T, U>(source: Store<T>, compute: (value: T) => U, equal: (a: U, b: U) => boolean = Object.is): Pick<Store<U>, "get" | "subscribe"> {
  let current = compute(source.get());
  const listeners = new Set<(value: U, previous: U) => void>();
  let stop: (() => void) | undefined;
  const refresh = () => {
    const next = compute(source.get());
    if (equal(next, current)) return;
    const previous = current;
    current = next;
    for (const listener of [...listeners]) listener(current, previous);
  };
  return {
    get() {
      // With nobody subscribed there is nothing keeping it fresh, so it is computed on read.
      if (!stop) current = compute(source.get());
      return current;
    },
    subscribe(listener) {
      if (listeners.size === 0) {
        current = compute(source.get());
        stop = source.subscribe(refresh);
      }
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
        if (listeners.size === 0) {
          stop?.();
          stop = undefined;
        }
      };
    },
  };
}

export interface HistoryControls {
  undo(): void;
  redo(): void;
  canUndo(): boolean;
  canRedo(): boolean;
  /** Forgets every earlier and later value. */
  clear(): void;
}

/**
 * Adds undo and redo to a store. Each change made through the store is one
 * step; undoing and redoing are not recorded as new steps.
 */
export function withHistory<T>(store: Store<T>, limit = 100): HistoryControls & { stop(): void; start(): void } {
  let past: T[] = [];
  let future: T[] = [];
  let travelling = false;
  let unsubscribe: (() => void) | undefined;
  // Restartable, so a React effect that is cleaned up and run again (StrictMode) keeps recording.
  const start = () => {
    unsubscribe ??= store.subscribe((_, previous) => {
      if (travelling) return;
      past.push(previous);
      if (past.length > limit) past = past.slice(-limit);
      future = [];
    });
  };
  const stop = () => {
    unsubscribe?.();
    unsubscribe = undefined;
  };
  start();
  const travel = (from: T[], to: T[]) => {
    const target = from.pop();
    to.push(store.get());
    travelling = true;
    try {
      store.set(target as T);
    } finally {
      travelling = false;
    }
  };
  return {
    undo: () => past.length > 0 && travel(past, future),
    redo: () => future.length > 0 && travel(future, past),
    canUndo: () => past.length > 0,
    canRedo: () => future.length > 0,
    clear() {
      past = [];
      future = [];
    },
    stop,
    start,
  };
}
