/**
 * ECharts React Wrapper
 *
 * Provides a React wrapper for ECharts with proper lifecycle management,
 * theme support, and responsive resizing.
 */

import * as React from 'react';
import * as echarts from 'echarts';

export interface EChartsProps {
  /** ECharts configuration options */
  option: echarts.EChartsOption;
  /** Custom styles for the container */
  style?: React.CSSProperties;
  /** Additional setOption settings */
  settings?: echarts.SetOptionOpts;
  /** Show loading indicator */
  loading?: boolean;
  /** ECharts theme name (must be registered first) */
  theme?: string;
  /** CSS class for the container */
  className?: string;
}

export function ECharts({
  option,
  style,
  settings,
  loading,
  theme,
  className,
}: EChartsProps) {
  const chartRef = React.useRef<HTMLDivElement>(null);
  const chartInstance = React.useRef<echarts.ECharts | null>(null);

  // Initialize chart and handle theme changes
  React.useEffect(() => {
    if (chartRef.current) {
      // Dispose existing instance if any (theme change requires re-initialization)
      if (chartInstance.current) {
        chartInstance.current.dispose();
      }
      chartInstance.current = echarts.init(chartRef.current, theme);
    }

    return () => {
      if (chartInstance.current) {
        chartInstance.current.dispose();
        chartInstance.current = null;
      }
    };
  }, [theme]);

  // Update chart option when it changes
  React.useEffect(() => {
    if (chartInstance.current) {
      // Use notMerge: true to replace entire option (prevents old series/config from persisting)
      chartInstance.current.setOption(option, { notMerge: true, ...settings });
    }
  }, [option, settings]);

  // Handle loading state
  React.useEffect(() => {
    if (chartInstance.current) {
      if (loading) {
        chartInstance.current.showLoading();
      } else {
        chartInstance.current.hideLoading();
      }
    }
  }, [loading]);

  // Handle resize events
  React.useEffect(() => {
    const handleResize = () => {
      if (chartInstance.current) {
        chartInstance.current.resize();
      }
    };

    window.addEventListener('resize', handleResize);

    // Setup ResizeObserver for container size changes (when panels show/hide)
    let resizeObserver: ResizeObserver | null = null;
    if (chartRef.current && typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(() => {
        // Small delay to ensure DOM has updated
        setTimeout(() => {
          chartInstance.current?.resize();
        }, 100);
      });
      resizeObserver.observe(chartRef.current);
    }

    return () => {
      window.removeEventListener('resize', handleResize);
      resizeObserver?.disconnect();
    };
  }, []);

  const defaultStyle: React.CSSProperties = {
    height: '400px',
    width: '100%',
  };

  return (
    <div
      ref={chartRef}
      style={{ ...defaultStyle, ...style }}
      className={className}
    />
  );
}

export default ECharts;
