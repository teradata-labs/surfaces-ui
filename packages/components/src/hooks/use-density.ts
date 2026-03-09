/**
 * useDensity — Resolves the effective density for a component.
 *
 * Priority: explicit prop > ThemeProvider context > 'compact' fallback.
 * Uses useContext directly (returns undefined without provider)
 * instead of useTheme() (which throws), so components work
 * with or without ThemeProvider.
 */

import { useContext } from 'react';
import { ThemeContext } from '../theme/ThemeProvider';
import type { DensityMode } from '../theme/ThemeProvider';

const DEFAULT_DENSITY: DensityMode = 'compact';

export function useDensity(propDensity?: DensityMode): DensityMode {
  const theme = useContext(ThemeContext);
  if (propDensity) return propDensity;
  return theme?.density ?? DEFAULT_DENSITY;
}
