/**
 * ThemeToggle
 *
 * A small icon button that switches between light and dark mode via useTheme().
 * Shared between showcase and kitchen-sink apps.
 *
 * Requires a <ThemeProvider persistTheme> ancestor.
 */

import * as React from 'react';
import { useTheme } from '../theme/ThemeProvider';
import { IconButton } from '../molecules/icon-button';
import { Sun, Moon } from 'lucide-react';

export function ThemeToggle({ className }: { className?: string }) {
  const { resolvedTheme, setTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';

  return (
    <IconButton
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      variant="standard"
      size="sm"
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      className={className}
    >
      {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </IconButton>
  );
}
