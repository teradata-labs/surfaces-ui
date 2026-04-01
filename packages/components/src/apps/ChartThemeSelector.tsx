/**
 * ChartThemeSelector
 *
 * Dropdown selector for chart color themes.
 * Shows base theme names - automatically switches between light/dark variants.
 *
 * Requires a <ChartThemeProvider> ancestor.
 */

import * as React from 'react';
import { useChartTheme } from '../theme/ChartThemeProvider';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '../primitives/select';
import { Palette } from 'lucide-react';

// Theme display names (base themes only, auto-switch light/dark)
const themeOptions = [
  { value: 'highContrast', label: 'High Contrast' },
  { value: 'colorblindSafe', label: 'Universal (Colorblind Safe)' },
  { value: 'oceanDepths', label: 'Ocean Depths' },
  { value: 'earthTones', label: 'Natural Elements' },
  { value: 'professional', label: 'Professional' },
];

export function ChartThemeSelector({ className }: { className?: string }) {
  const { baseTheme, setBaseTheme } = useChartTheme();

  return (
    <div className={className}>
      <Select value={baseTheme} onValueChange={setBaseTheme}>
        <SelectTrigger className="w-[200px] h-9">
          <div className="flex items-center gap-2">
            <Palette className="h-4 w-4" />
            <SelectValue />
          </div>
        </SelectTrigger>
        <SelectContent>
          {themeOptions.map(({ value, label }) => (
            <SelectItem key={value} value={value}>
              {label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
