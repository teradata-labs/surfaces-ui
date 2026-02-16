// Theme
export { ThemeProvider, useTheme } from './theme/ThemeProvider';
export type { ThemeConfig } from './theme/ThemeProvider';

// MCP Bridge
export { McpBridge } from './bridge/McpBridge';
export { McpBridgeProvider, useMcpBridge } from './bridge/McpBridgeProvider';
export { useMcpTool, useMcpPagination, useMcpStream } from './bridge/hooks';
export type { McpToolResult, PageResult, McpRenderData, McpBridgeConfig, McpMessage } from './bridge/types';

// Analytics
export { AnalyticsProvider, useAnalytics } from './lib/analytics';
export type { AnalyticsConfig } from './lib/analytics';

// Primitives
export { Button, buttonVariants } from './primitives/button';
export { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from './primitives/card';
export { Badge, badgeVariants } from './primitives/badge';
export {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from './primitives/dialog';
export { ScrollArea, ScrollBar } from './primitives/scroll-area';
export { Tabs, TabsContent, TabsList, TabsTrigger } from './primitives/tabs';
export { Label } from './primitives/label';
export { Input } from './primitives/input';
export { Separator } from './primitives/separator';
export { ViewModeToggle } from './primitives/view-mode-toggle';
export type { ViewModeOption, ViewModeToggleProps } from './primitives/view-mode-toggle';

// Charts
export { ECharts } from './components/charts';
export type { EChartsProps } from './components/charts';
export {
  accessibleThemes,
  getThemeGroups,
  getTheme,
  getThemeKeys,
  registerEChartsThemes,
} from './components/charts';
export type { ChartTheme } from './components/charts';

// SQL Results Display (new)
export {
  SQLResultsDisplay,
  createDefaultActions,
  DEFAULT_RESULTS_CONFIG,
  DEFAULT_CHART_CONFIG,
  DEFAULT_DATE_RANGE,
} from './components/sql-results';
export type {
  SQLResultsDisplayProps,
  SQLResultsConfig,
  SQLResultsAction,
  SQLResultData,
  ChartConfig,
  ChartType,
  AggregationType,
  DateRangeFilter,
} from './components/sql-results';

// SQL Editor Components
export {
  SQLEditor,
  CodeMirrorSQLInput,
  SimpleSQLInput,
  SQLToolbar,
  SQLResultsTable,
  SQLVisualization,
} from './components/sql-editor';
export type {
  SQLEditorProps,
  SQLEditorExtendedProps,
  SQLInputProps,
  SQLToolbarProps,
  SQLResultsTableProps,
  SQLVisualizationProps,
  SQLResult,
  LegacyChartConfig,
  LegacyResultsConfig,
} from './components/sql-editor';

// Utility
export { cn } from './lib/utils';

// json-render Catalog
export {
  catalog,
  ChartSchema,
  DataTableSchema,
  FilterSchema,
  DensityToggleSchema,
  ViewModeToggleSchema,
  TableWithFiltersSchema,
  ChartWithControlsSchema,
  SQLResultsDisplaySchema,
  registry,
  aiSystemPrompt,
  getCatalogPrompt,
  generateCatalogPrompt,
  generateComponentPrompt,
  generateComponentExample,
  generateSpecExample,
} from './catalog';
export type {
  ChartProps as CatalogChartProps,
  DataTableProps as CatalogDataTableProps,
  FilterProps as CatalogFilterProps,
  DensityToggleProps as CatalogDensityToggleProps,
  ViewModeToggleProps as CatalogViewModeToggleProps,
  TableWithFiltersSchemaProps as CatalogTableWithFiltersProps,
  ChartWithControlsSchemaProps as CatalogChartWithControlsProps,
  SQLResultsDisplaySchemaProps as CatalogSQLResultsDisplayProps,
} from './catalog';
