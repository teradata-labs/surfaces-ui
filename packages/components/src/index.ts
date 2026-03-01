// Theme
export { ThemeProvider, useTheme } from './theme/ThemeProvider';
export type { ThemeConfig } from './theme/ThemeProvider';

// Figma Design Tokens
export {
  rgbToHsl,
  parseColorToHsl,
  parseFigmaColorToHsl,
  mapFigmaTokensToSurfaces,
  mapFigmaVariablesToSurfaces,
  generateSurfacesCSS,
  mergeSurfacesTokens,
} from './theme/figma-tokens';
export type {
  FigmaTokenType,
  FigmaToken,
  FigmaTokens,
  FigmaVariable,
  FigmaColor,
  SurfacesTokens,
} from './theme/figma-tokens';

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
export type { ButtonProps } from './primitives/button';
export { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from './primitives/card';
export { Badge, badgeVariants, NotificationBadge } from './primitives/badge';
export type { BadgeProps, NotificationBadgeProps } from './primitives/badge';
export { Alert, AlertTitle, AlertDescription } from './primitives/alert';
export type { AlertProps } from './primitives/alert';
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

// New primitives
export { Switch } from './primitives/switch';
export type { SwitchProps } from './primitives/switch';
export { Checkbox } from './primitives/checkbox';
export type { CheckboxProps } from './primitives/checkbox';
export { RadioGroup, RadioGroupItem } from './primitives/radio-group';
export type { RadioGroupProps, RadioGroupItemProps } from './primitives/radio-group';
export { CircularProgress } from './primitives/circular-progress';
export type { CircularProgressProps } from './primitives/circular-progress';
export { Progress } from './primitives/progress';
export type { ProgressProps } from './primitives/progress';

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

// Molecules
export { FilterChip, InputChip } from './molecules/chip';
export type { FilterChipProps, InputChipProps } from './molecules/chip';
export { EmptyState } from './molecules/empty-state';
export type { EmptyStateProps } from './molecules/empty-state';
export { FormField } from './molecules/form-field';
export type { FormFieldProps } from './molecules/form-field';
export { IconButton, iconButtonVariants } from './molecules/icon-button';
export type { IconButtonProps } from './molecules/icon-button';

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
  SurfacesRenderer,
  aiSystemPrompt,
  getCatalogPrompt,
  generateCatalogPrompt,
  generateComponentPrompt,
  generateComponentExample,
  generateSpecExample,
  CatalogDemo,
  chartSpec,
  dataTableSpec,
  tableWithFiltersSpec,
  sqlResultsSpec,
  sampleData,
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
  SurfacesRendererProps,
} from './catalog';
