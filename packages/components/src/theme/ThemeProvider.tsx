import {
  type Mode,
  type Theme,
  MODES,
  defaultTheme,
  parseTheme,
  themeCss,
} from "@surfaces-ui/tokens";
import {
  type ReactNode,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useState,
} from "react";

/** What a person has chosen: the theme document and the light/dark mode. */
export interface ThemeState {
  theme: Theme;
  mode: Mode;
}

/**
 * Where the choice is kept. Implement this to persist through a host bridge
 * (an MCP App, an embed) or a server instead of the browser.
 */
export interface ThemeStore {
  load(): ThemeState | undefined | Promise<ThemeState | undefined>;
  save(state: ThemeState): void | Promise<void>;
}

/** Keeps the choice in localStorage. Works (without persisting) when storage is unavailable. */
export function localThemeStore(key = "surfaces.theme"): ThemeStore {
  return {
    load() {
      try {
        const raw = globalThis.localStorage?.getItem(key);
        if (!raw) return undefined;
        const parsed = JSON.parse(raw) as { theme?: unknown; mode?: unknown };
        return {
          theme: parseTheme(parsed.theme, defaultTheme),
          mode: MODES.includes(parsed.mode as Mode) ? (parsed.mode as Mode) : "system",
        };
      } catch {
        return undefined;
      }
    },
    save(state) {
      try {
        globalThis.localStorage?.setItem(key, JSON.stringify(state));
      } catch {
        // Storage blocked or full: the choice still applies for this visit.
      }
    },
  };
}

export interface ThemeContextValue extends ThemeState {
  setTheme(theme: Theme): void;
  setMode(mode: Mode): void;
  /** The mode actually showing, with "system" resolved. */
  resolvedMode: "light" | "dark";
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

export interface ThemeProviderProps {
  children: ReactNode;
  /** Theme used until the store answers, and when it has nothing saved. */
  initialTheme?: Theme;
  initialMode?: Mode;
  /** Pass `null` to keep the choice in memory only. Defaults to localStorage. */
  store?: ThemeStore | null;
  /**
   * "root" (default) themes the whole document. "scoped" themes only this
   * provider's subtree, so several themes can share a page.
   */
  scope?: "root" | "scoped";
}

function useSystemDark(): boolean {
  const query = "(prefers-color-scheme: dark)";
  const [dark, setDark] = useState(() => globalThis.matchMedia?.(query).matches ?? false);
  useEffect(() => {
    const media = globalThis.matchMedia?.(query);
    if (!media) return;
    const onChange = () => setDark(media.matches);
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);
  return dark;
}

export function ThemeProvider({
  children,
  initialTheme = defaultTheme,
  initialMode = "system",
  store,
  scope = "root",
}: ThemeProviderProps) {
  const resolvedStore = useMemo(() => (store === undefined ? localThemeStore() : store), [store]);
  const [state, setState] = useState<ThemeState>({ theme: initialTheme, mode: initialMode });
  const scopeId = `sf-${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  const systemDark = useSystemDark();

  useEffect(() => {
    if (!resolvedStore) return;
    let cancelled = false;
    void Promise.resolve(resolvedStore.load())
      .then((saved) => {
        if (saved && !cancelled) setState(saved);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [resolvedStore]);

  const update = useCallback(
    (patch: Partial<ThemeState>) => {
      setState((prev) => {
        const next = { ...prev, ...patch };
        if (resolvedStore) void Promise.resolve(resolvedStore.save(next)).catch(() => {});
        return next;
      });
    },
    [resolvedStore],
  );

  const css = useMemo(
    () => themeCss(state.theme, scope === "root" ? {} : { selector: `[data-sf-scope="${scopeId}"]` }),
    [state.theme, scope, scopeId],
  );

  useEffect(() => {
    if (scope !== "root") return;
    const root = document.documentElement;
    if (state.mode === "system") root.removeAttribute("data-theme");
    else root.setAttribute("data-theme", state.mode);
  }, [scope, state.mode]);

  // A theme that asks for more contrast says so on the page, so a host can drop its own decoration (a glow, a texture)
  // as it would for `prefers-contrast: more`.
  useEffect(() => {
    if (scope !== "root") return;
    const root = document.documentElement;
    if (state.theme.contrast === "more") root.setAttribute("data-contrast", "more");
    else root.removeAttribute("data-contrast");
  }, [scope, state.theme.contrast]);

  const value = useMemo<ThemeContextValue>(
    () => ({
      ...state,
      setTheme: (theme) => update({ theme }),
      setMode: (mode) => update({ mode }),
      resolvedMode: state.mode === "system" ? (systemDark ? "dark" : "light") : state.mode,
    }),
    [state, update, systemDark],
  );

  return (
    <ThemeContext.Provider value={value}>
      <style data-sf-theme={scope === "root" ? "root" : scopeId}>{css}</style>
      {scope === "root" ? (
        children
      ) : (
        <div
          className="sf-scope"
          data-sf-scope={scopeId}
          data-theme={state.mode === "system" ? undefined : state.mode}
        >
          {children}
        </div>
      )}
    </ThemeContext.Provider>
  );
}

/** Like `useTheme`, but returns undefined outside a ThemeProvider instead of throwing. */
export function useOptionalTheme(): ThemeContextValue | undefined {
  return useContext(ThemeContext);
}

export function useTheme(): ThemeContextValue {
  const value = useContext(ThemeContext);
  if (!value) throw new Error("useTheme must be used inside <ThemeProvider>");
  return value;
}
