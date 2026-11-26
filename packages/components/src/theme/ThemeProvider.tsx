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
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { type StateStorage, browserStorage } from "@surfaces-ui/data";

/** What a person has chosen: the theme document and the light/dark mode. */
export interface ThemeState {
  theme: Theme;
  mode: Mode;
}

/**
 * Reads a saved theme choice. Saved text can be edited by anyone with access
 * to the storage, so the theme goes through `parseTheme` and an unknown mode
 * falls back to "system"; unreadable text is ignored.
 */
export function parseThemeState(text: string | null | undefined): ThemeState | undefined {
  if (!text) return undefined;
  try {
    const parsed = JSON.parse(text) as { theme?: unknown; mode?: unknown };
    if (!parsed || typeof parsed !== "object") return undefined;
    return { theme: parseTheme(parsed.theme, defaultTheme), mode: MODES.includes(parsed.mode as Mode) ? (parsed.mode as Mode) : "system" };
  } catch {
    return undefined;
  }
}

export interface ThemeContextValue extends ThemeState {
  setTheme(theme: Theme): void;
  setMode(mode: Mode): void;
  /** The mode actually showing, with "system" resolved. */
  resolvedMode: "light" | "dark";
  /** The host's own themes, chosen by name beside the built-in presets (by a page, an agent's surface or `ThemePicker`). */
  themes: readonly Theme[];
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

export interface ThemeProviderProps {
  children: ReactNode;
  /** Theme used until the saved choice loads, and when it has nothing saved. */
  initialTheme?: Theme;
  initialMode?: Mode;
  /**
   * Where the choice is kept: the browser (the default), a host's bridge or a
   * server, through the same `StateStorage` every part of the library takes.
   * Pass `null` to keep the choice in memory only.
   */
  storage?: StateStorage | null;
  /** The key the choice is kept under. Default "surfaces.theme". */
  storageKey?: string;
  /**
   * "root" (default) themes the whole document. "scoped" themes only this
   * provider's subtree, so several themes can share a page.
   */
  scope?: "root" | "scoped";
  /**
   * The host's own themes (a company's brand themes, say), offered by name
   * beside the built-in presets: a page's or a surface's `theme` request can
   * choose one, and `ThemePicker` lists them. Pass them through `parseTheme`
   * first. A provider inside another keeps the outer one's unless given its own.
   */
  themes?: readonly Theme[];
}

const NO_THEMES: readonly Theme[] = [];

const DARK_QUERY = "(prefers-color-scheme: dark)";

function subscribeSystemDark(onChange: () => void): () => void {
  const media = globalThis.matchMedia?.(DARK_QUERY);
  if (!media) return () => {};
  media.addEventListener("change", onChange);
  return () => media.removeEventListener("change", onChange);
}

const systemDarkNow = () => globalThis.matchMedia?.(DARK_QUERY).matches ?? false;

/**
 * Whether the system asks for dark. A server cannot know, so it renders light, and the page hydrates as light
 * before it reads the system's choice: the HTML a server wrote and the first render in the browser always agree.
 * The theme's CSS already follows `prefers-color-scheme` on its own, so the page is never shown in the wrong mode.
 */
function useSystemDark(): boolean {
  return useSyncExternalStore(subscribeSystemDark, systemDarkNow, () => false);
}

export function ThemeProvider({
  children,
  initialTheme = defaultTheme,
  initialMode = "system",
  storage,
  storageKey = "surfaces.theme",
  scope = "root",
  themes: given,
}: ThemeProviderProps) {
  const outer = useContext(ThemeContext);
  const themes = given ?? outer?.themes ?? NO_THEMES;
  const resolvedStorage = useMemo(() => (storage === undefined ? browserStorage() : storage), [storage]);
  // A choice made before the saved one has loaded wins: the saved one is older.
  const chosen = useRef(false);
  const [state, setState] = useState<ThemeState>({ theme: initialTheme, mode: initialMode });
  const scopeId = `sf-${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  const systemDark = useSystemDark();

  useEffect(() => {
    if (!resolvedStorage) return;
    let cancelled = false;
    void Promise.resolve(resolvedStorage.load(storageKey))
      .then((text) => {
        const saved = parseThemeState(text);
        if (saved && !cancelled && !chosen.current) setState(saved);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [resolvedStorage, storageKey]);

  const update = useCallback(
    (patch: Partial<ThemeState>) => {
      chosen.current = true;
      setState((prev) => {
        // Asking for what is already set changes nothing, so a host that keeps the mode in step with its own
        // toggle from an effect does not render again, and again.
        if (Object.entries(patch).every(([key, value]) => prev[key as keyof ThemeState] === value)) return prev;
        const next = { ...prev, ...patch };
        if (resolvedStorage) void Promise.resolve(resolvedStorage.save(storageKey, JSON.stringify(next))).catch(() => {});
        return next;
      });
    },
    [resolvedStorage, storageKey],
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

  // The same functions on every render, so a host can list them in an effect's dependencies.
  const setTheme = useCallback((theme: Theme) => update({ theme }), [update]);
  const setMode = useCallback((mode: Mode) => update({ mode }), [update]);

  const value = useMemo<ThemeContextValue>(
    () => ({
      ...state,
      setTheme,
      setMode,
      resolvedMode: state.mode === "system" ? (systemDark ? "dark" : "light") : state.mode,
      themes,
    }),
    [state, setTheme, setMode, systemDark, themes],
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
