/**
 * Where saved state lives: the browser, a host's bridge, a server, files.
 * Every part of the library that keeps something (a chat thread, a theme,
 * the dev tools' panel, a surface library, semantic models, `persist`) takes
 * one of these, so a host plugs in one backend for all of them. Values are
 * text; whoever saves decides the format and checks it again on load.
 */
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
