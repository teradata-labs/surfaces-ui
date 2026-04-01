/**
 * ChartWithTheme
 *
 * Chart wrapper that automatically applies chart theme from context.
 * Falls back to Chart component if no ChartThemeProvider is available.
 */

import * as React from 'react';
import { Chart } from '../primitives/chart';
import { useChartTheme } from '../theme/ChartThemeProvider';
import type { ChartProps } from '../primitives/chart/types';

export function ChartWithTheme(props: ChartProps) {
  const { themeKey } = useChartTheme();

  // Use theme from context if no explicit theme prop provided
  // Convert theme key to string to ensure compatibility with ECharts
  const theme = props.theme || String(themeKey);

  // Debug logging
  React.useEffect(() => {
    console.log('[ChartWithTheme] Theme key from context:', themeKey);
    console.log('[ChartWithTheme] Final theme:', theme);
    console.log('[ChartWithTheme] Chart props:', props);
  }, [themeKey, theme, props]);

  return <Chart {...props} theme={theme} />;
}
