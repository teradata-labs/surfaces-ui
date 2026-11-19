// Stands in for every `echarts/*` import in the bundle: the page loads ECharts
// itself (window.echarts, the full build, every chart already registered), so
// the bundle borrows it instead of carrying its own copy.

type ECharts = { init: (...args: unknown[]) => unknown };

function page(): ECharts {
  const found = (globalThis as { echarts?: ECharts }).echarts;
  if (!found) throw new Error("Charts need ECharts: load echarts.js before surfaces-page.js.");
  return found;
}

/** The full build already has every chart and component, so there is nothing to register. */
export function use(_parts: unknown): void {}

export function init(...args: unknown[]): unknown {
  return page().init(...args);
}

// Named parts the components register with `use`; the full build has them already.
export const BarChart = {};
export const LineChart = {};
export const PieChart = {};
export const ScatterChart = {};
export const AriaComponent = {};
export const DataZoomComponent = {};
export const DatasetComponent = {};
export const GridComponent = {};
export const LegendComponent = {};
export const TooltipComponent = {};
export const CanvasRenderer = {};
