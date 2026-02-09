import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

/* ── Public Types ──────────────────────────────────────────────────── */

export type ThemeMode = 'light' | 'dark' | 'system';

export interface ThemeConfig {
  /** The user-selected theme mode. */
  theme: ThemeMode;
  /** Update the current theme mode. */
  setTheme: (mode: ThemeMode) => void;
  /** The resolved theme after evaluating system preference (always 'light' | 'dark'). */
  resolvedTheme: 'light' | 'dark';
}

interface ThemeProviderProps {
  /** The desired theme mode. Defaults to 'system'. */
  theme?: ThemeMode;
  /** Optional CSS custom-property overrides applied to the wrapper element. */
  tokenOverrides?: Record<string, string>;
  children: React.ReactNode;
}

/* ── Context ───────────────────────────────────────────────────────── */

const ThemeContext = createContext<ThemeConfig | undefined>(undefined);

/* ── Helpers ───────────────────────────────────────────────────────── */

function getSystemTheme(): 'light' | 'dark' {
  if (typeof window === 'undefined') return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light';
}

function resolveTheme(mode: ThemeMode): 'light' | 'dark' {
  return mode === 'system' ? getSystemTheme() : mode;
}

/* ── Provider ──────────────────────────────────────────────────────── */

export function ThemeProvider({
  theme: initialTheme = 'system',
  tokenOverrides,
  children,
}: ThemeProviderProps) {
  const [theme, setThemeState] = useState<ThemeMode>(initialTheme);
  const [resolvedTheme, setResolvedTheme] = useState<'light' | 'dark'>(() =>
    resolveTheme(initialTheme),
  );

  const setTheme = useCallback((mode: ThemeMode) => {
    setThemeState(mode);
  }, []);

  // Sync the resolved theme whenever `theme` changes or the system preference changes.
  useEffect(() => {
    const resolved = resolveTheme(theme);
    setResolvedTheme(resolved);

    // Apply or remove the `dark` class on <html>.
    const root = document.documentElement;
    if (resolved === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [theme]);

  // Listen for system preference changes when mode is 'system'.
  useEffect(() => {
    if (theme !== 'system') return;

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

    const handler = (e: MediaQueryListEvent) => {
      const newResolved = e.matches ? 'dark' : 'light';
      setResolvedTheme(newResolved);

      const root = document.documentElement;
      if (newResolved === 'dark') {
        root.classList.add('dark');
      } else {
        root.classList.remove('dark');
      }
    };

    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, [theme]);

  // Sync with the prop when it changes externally.
  useEffect(() => {
    setThemeState(initialTheme);
  }, [initialTheme]);

  const value = useMemo<ThemeConfig>(
    () => ({ theme, setTheme, resolvedTheme }),
    [theme, setTheme, resolvedTheme],
  );

  // Build style object from tokenOverrides.
  const overrideStyle = useMemo(() => {
    if (!tokenOverrides || Object.keys(tokenOverrides).length === 0) {
      return undefined;
    }

    const style: Record<string, string> = {};
    for (const [key, val] of Object.entries(tokenOverrides)) {
      // Ensure property names are prefixed with --.
      const prop = key.startsWith('--') ? key : `--${key}`;
      style[prop] = val;
    }
    return style;
  }, [tokenOverrides]);

  // When there are token overrides we wrap children in a div that applies
  // the custom properties.  Otherwise we render children directly to avoid
  // an unnecessary DOM node.
  return (
    <ThemeContext.Provider value={value}>
      {overrideStyle ? (
        <div style={overrideStyle}>{children}</div>
      ) : (
        children
      )}
    </ThemeContext.Provider>
  );
}

/* ── Hook ──────────────────────────────────────────────────────────── */

export function useTheme(): ThemeConfig {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
