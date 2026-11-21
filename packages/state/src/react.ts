import { useCallback, useEffect, useMemo, useSyncExternalStore } from "react";
import { type HistoryControls, type ReadableStore, type Store, withHistory } from "./store.js";

/**
 * Reads a store in a component. With a selector the component re-renders
 * only when the selected part changes; return a value that is stable for
 * the same state (a field, not a new object).
 */
export function useStore<T>(store: ReadableStore<T>): T;
export function useStore<T, U>(store: ReadableStore<T>, selector: (value: T) => U): U;
export function useStore<T, U>(store: ReadableStore<T>, selector?: (value: T) => U): T | U {
  const subscribe = useCallback((notify: () => void) => store.subscribe(notify), [store]);
  const read = useCallback(() => (selector ? selector(store.get()) : store.get()), [store, selector]);
  return useSyncExternalStore(subscribe, read, read);
}

/** Undo and redo for a store, with flags that update as the history changes. */
export function useHistory<T>(store: Store<T>, limit?: number): HistoryControls {
  const history = useMemo(() => withHistory(store, limit), [store, limit]);
  useEffect(() => {
    history.start();
    return history.stop;
  }, [history]);
  // Reading the store makes the flags fresh after every change.
  useStore(store);
  return history;
}
