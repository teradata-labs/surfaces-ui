/**
 * ChartThemeProvider
 *
 * Provides chart theme selection and auto-switching based on UI theme (light/dark).
 * Stores user preference in localStorage.
 */

import * as React from 'react';
import { chartThemes, getAutoThemeKey, type ChartThemeKey, type ChartTheme } from './chart-themes';
import { useTheme } from './ThemeProvider';

interface ChartThemeContextValue {
  /** Current chart theme key */
  themeKey: ChartThemeKey;
  /** Current chart theme object */
  theme: ChartTheme;
  /** User's base theme preference (without Light/Dark suffix) */
  baseTheme: string;
  /** Set chart theme by key */
  setThemeKey: (key: ChartThemeKey) => void;
  /** Set base theme (will auto-select Light/Dark variant) */
  setBaseTheme: (base: string) => void;
  /** Whether auto-switching is enabled */
  autoSwitch: boolean;
  /** Toggle auto-switching based on UI theme */
  setAutoSwitch: (enabled: boolean) => void;
}

const ChartThemeContext = React.createContext<ChartThemeContextValue | undefined>(undefined);

export interface ChartThemeProviderProps {
  children: React.ReactNode;
  /** Enable persistent storage of theme preference. Default: true */
  persistTheme?: boolean;
  /** Default base theme. Default: 'professional' */
  defaultBaseTheme?: string;
}

export function ChartThemeProvider({
  children,
  persistTheme = true,
  defaultBaseTheme = 'professional'
}: ChartThemeProviderProps) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';

  const [baseTheme, setBaseThemeState] = React.useState<string>(() => {
    if (persistTheme && typeof window !== 'undefined') {
      return localStorage.getItem('chart-base-theme') || defaultBaseTheme;
    }
    return defaultBaseTheme;
  });

  const [autoSwitch, setAutoSwitchState] = React.useState<boolean>(() => {
    if (persistTheme && typeof window !== 'undefined') {
      const stored = localStorage.getItem('chart-auto-switch');
      return stored !== null ? stored === 'true' : true;
    }
    return true;
  });

  const [manualThemeKey, setManualThemeKey] = React.useState<ChartThemeKey | null>(null);

  // Auto-select theme based on UI theme when auto-switch is enabled
  const themeKey = React.useMemo(() => {
    if (autoSwitch) {
      return getAutoThemeKey(isDark, baseTheme);
    }
    return manualThemeKey || getAutoThemeKey(isDark, baseTheme);
  }, [autoSwitch, isDark, baseTheme, manualThemeKey]);

  const theme = React.useMemo(() => chartThemes[themeKey], [themeKey]);

  const setBaseTheme = React.useCallback((base: string) => {
    setBaseThemeState(base);
    if (persistTheme && typeof window !== 'undefined') {
      localStorage.setItem('chart-base-theme', base);
    }
    // When changing base theme, re-enable auto-switch
    setAutoSwitchState(true);
    if (persistTheme && typeof window !== 'undefined') {
      localStorage.setItem('chart-auto-switch', 'true');
    }
  }, [persistTheme]);

  const setThemeKey = React.useCallback((key: ChartThemeKey) => {
    setManualThemeKey(key);
    // When manually selecting a theme, disable auto-switch
    setAutoSwitchState(false);
    if (persistTheme && typeof window !== 'undefined') {
      localStorage.setItem('chart-auto-switch', 'false');
    }
  }, [persistTheme]);

  const setAutoSwitch = React.useCallback((enabled: boolean) => {
    setAutoSwitchState(enabled);
    if (persistTheme && typeof window !== 'undefined') {
      localStorage.setItem('chart-auto-switch', String(enabled));
    }
  }, [persistTheme]);

  const value = React.useMemo(
    () => ({
      themeKey,
      theme,
      baseTheme,
      setThemeKey,
      setBaseTheme,
      autoSwitch,
      setAutoSwitch,
    }),
    [themeKey, theme, baseTheme, setThemeKey, setBaseTheme, autoSwitch, setAutoSwitch]
  );

  return (
    <ChartThemeContext.Provider value={value}>
      {children}
    </ChartThemeContext.Provider>
  );
}

export function useChartTheme() {
  const context = React.useContext(ChartThemeContext);
  if (!context) {
    throw new Error('useChartTheme must be used within a ChartThemeProvider');
  }
  return context;
}
