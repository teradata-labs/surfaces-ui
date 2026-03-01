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
export type DensityMode = 'compact' | 'comfortable' | 'spacious';

export interface ThemeConfig {
  /** The user-selected theme mode. */
  theme: ThemeMode;
  /** Update the current theme mode. */
  setTheme: (mode: ThemeMode) => void;
  /** The resolved theme after evaluating system preference (always 'light' | 'dark'). */
  resolvedTheme: 'light' | 'dark';
  /** The current density mode. */
  density: DensityMode;
  /** Update the current density mode. */
  setDensity: (mode: DensityMode) => void;
}

interface ThemeProviderProps {
  /** The desired theme mode. Defaults to 'system'. */
  theme?: ThemeMode;
  /** The desired density mode. Defaults to 'comfortable'. */
  density?: DensityMode;
  /** Optional CSS custom-property overrides applied to the wrapper element. */
  tokenOverrides?: Record<string, string>;
  /**
   * When true, persists the current theme mode to `localStorage` under the
   * key `'theme'` and restores it on the next page load (overriding the
   * `theme` prop default).
   */
  persistTheme?: boolean;
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
  density: initialDensity,
  tokenOverrides,
  persistTheme = false,
  children,
}: ThemeProviderProps) {
  const [theme, setThemeState] = useState<ThemeMode>(() => {
    if (persistTheme && typeof window !== 'undefined') {
      const saved = localStorage.getItem('theme');
      if (saved === 'light' || saved === 'dark' || saved === 'system') {
        return saved as ThemeMode;
      }
    }
    return initialTheme;
  });
  const [resolvedTheme, setResolvedTheme] = useState<'light' | 'dark'>(() => {
    if (persistTheme && typeof window !== 'undefined') {
      const saved = localStorage.getItem('theme');
      if (saved === 'light' || saved === 'dark' || saved === 'system') {
        return resolveTheme(saved as ThemeMode);
      }
    }
    return resolveTheme(initialTheme);
  });

  const [density, setDensityState] = useState<DensityMode>(() => {
    if (initialDensity) return initialDensity;
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('density');
      if (stored === 'compact' || stored === 'comfortable' || stored === 'spacious') {
        return stored;
      }
    }
    return 'comfortable';
  });

  const setTheme = useCallback(
    (mode: ThemeMode) => {
      setThemeState(mode);
      if (persistTheme && typeof window !== 'undefined') {
        localStorage.setItem('theme', mode);
      }
    },
    [persistTheme],
  );

  const setDensity = useCallback((mode: DensityMode) => {
    setDensityState(mode);
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

  // Persist density changes to localStorage and apply data-density attribute
  useEffect(() => {
    localStorage.setItem('density', density);
    document.documentElement.setAttribute('data-density', density);
  }, [density]);

  const value = useMemo<ThemeConfig>(
    () => ({ theme, setTheme, resolvedTheme, density, setDensity }),
    [theme, setTheme, resolvedTheme, density, setDensity],
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

  // Always wrap in a div to apply data-density attribute (needed for CSS inheritance).
  // When there are token overrides, also apply the custom properties via style.
  return (
    <ThemeContext.Provider value={value}>
      <div data-density={density} style={overrideStyle}>
        {children}
      </div>
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
