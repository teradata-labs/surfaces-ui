// Theme
export { ThemeProvider, useTheme } from './theme/ThemeProvider';
export type { ThemeConfig, DensityMode } from './theme/ThemeProvider';

// Hooks
export { useDensity } from './hooks/use-density';
export { useAutoLayout, getLayoutedElements } from './hooks/use-auto-layout';
export type { LayoutConfig, LayoutDirection } from './hooks/use-auto-layout';

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
export { McpAppsBridge } from './bridge/McpAppsBridge';
export { McpBridgeProvider, useMcpBridge } from './bridge/McpBridgeProvider';
export type { BridgeLike } from './bridge/McpBridgeProvider';
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
export type { AlertProps, AlertVariant, AlertMode } from './primitives/alert';
export {
  Dialog,
  DialogBody,
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
export { Input, inputVariants } from './primitives/input';
export type { InputProps } from './primitives/input';
export { Separator } from './primitives/separator';
export { ViewModeToggle } from './primitives/view-mode-toggle';
export type { ViewModeOption, ViewModeToggleProps } from './primitives/view-mode-toggle';

// Flow primitives
export { FlowHandle } from './primitives/flow-handle';
export type { FlowHandleProps } from './primitives/flow-handle';
export { FlowNode } from './primitives/flow-node';
export type { FlowNodeProps, FlowNodeVariant } from './primitives/flow-node';

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
export { ActionRibbon } from './molecules/action-ribbon';
export type { ActionRibbonProps, ActionRibbonState } from './molecules/action-ribbon';
export { Snackbar } from './molecules/snackbar';
export type { SnackbarProps, SnackbarVariant } from './molecules/snackbar';
export { CodeSnippet } from './molecules/code-snippet';
export type { CodeSnippetProps } from './molecules/code-snippet';

// New primitives (extended)
export { Slider } from './primitives/slider';
export type { SliderProps } from './primitives/slider';
export { Typography } from './primitives/typography';
export type { TypographyProps, TypographyVariant } from './primitives/typography';
export { Icon } from './primitives/icon';
export type { IconProps, IconSize } from './primitives/icon';
export { ListItem } from './primitives/list-item';
export type { ListItemProps, ListItemLines } from './primitives/list-item';
export { TextLockup } from './molecules/text-lockup';
export type { TextLockupProps, TextLockupSize } from './molecules/text-lockup';
export { IconLockup } from './molecules/icon-lockup';
export type { IconLockupProps, IconLockupLayout } from './molecules/icon-lockup';
export { Menu } from './molecules/menu';
export type { MenuProps, MenuItemProps } from './molecules/menu';
export { Toolbar, ToolbarSeparator } from './molecules/toolbar';
export type { ToolbarProps, ToolbarSeparatorProps } from './molecules/toolbar';
export { StatusDialog } from './molecules/status-dialog';
export type { StatusDialogProps, StatusDialogStatus } from './molecules/status-dialog';
export { NodePalette } from './molecules/node-palette';
export type { NodePaletteProps, PaletteItem, PaletteCategory } from './molecules/node-palette';
export { AgentNode } from './molecules/agent-node';
export type { AgentNodeData, AgentStatus } from './molecules/agent-node';

// Organisms
export { SideSheet, SideSheetHeader, SideSheetContent, SideSheetFooter } from './organisms/side-sheet';
export type { SideSheetProps, SideSheetHeaderProps, SideSheetContentProps, SideSheetFooterProps } from './organisms/side-sheet';
export { FullScreenDialog } from './organisms/full-screen-dialog';
export type { FullScreenDialogProps } from './organisms/full-screen-dialog';
export { FocusedPage } from './organisms/focused-page';
export type { FocusedPageProps, BreadcrumbItem } from './organisms/focused-page';
export { TreeList, TreeListItem } from './organisms/tree-list';
export type { TreeListProps, TreeListItemProps, TreeNode } from './organisms/tree-list';
export { OnboardingCards, OnboardingCardItem } from './organisms/onboarding-cards';
export type { OnboardingCardsProps, OnboardingCard, OnboardingCardState } from './organisms/onboarding-cards';
export { NotebookCell, CellErrorAlert, CellCodeMirror } from './organisms/notebook-cell';
export type { NotebookCellProps, NotebookCellType, NotebookCellStatus, NotebookCellError, CellCodeMirrorProps } from './organisms/notebook-cell';

// Flow organisms
export { FlowCanvas } from './organisms/flow-canvas';
export type { FlowCanvasProps } from './organisms/flow-canvas';
export { FlowEditor } from './organisms/flow-editor';
export type { FlowEditorProps } from './organisms/flow-editor';
export { AgentFlowView } from './organisms/agent-flow-view';
export type { AgentFlowViewProps, AgentStep } from './organisms/agent-flow-view';

// Table Core (shared foundation)
export { TableCell, TableHeader, useVirtualTable } from './primitives/table-core';
export type { TableDensity, SortState, SortDirection, CellAlignment, BaseColumnDef } from './primitives/table-core';
export { DENSITY_HEIGHTS } from './primitives/table-core';

// Data Table (Covalent organism)
export { DataTable } from './organisms/data-table';
export { DataTableRow } from './organisms/data-table';
export type { DataTableProps, DataTableColumn, ColumnType, RowAction } from './organisms/data-table';

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
  getFullSystemPrompt,
  COMPONENT_SCHEMAS,
  getSchemaByName,
  getSchemasByCategory,
  getAvailableSchemas,
  generateComponentCatalogPrompt,
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
  ComponentSchema,
  PropDefinition,
  UsageGuidance,
  UsagePattern,
} from './catalog';

// Figma Component Map
export {
  COMPONENT_MAP,
  getComponentsByStatus,
  getComponentsByCategory,
  getComponentsByLevel,
  figmaToReact,
  reactToFigma,
  getComponentCatalog,
} from './figma';
export type { ComponentMapEntry, AtomicLevel, ComponentStatus, ComponentCategory } from './figma';

// Covalent Variable Map
export {
  COLOR_VARIABLE_MAP,
  COMPONENT_VARIABLE_MAP,
  TYPOGRAPHY_VARIABLE_MAP,
  ELEVATION_MAP,
  resolveColorVariable,
  resolveComponentVariable,
  getAllMappings,
} from './theme/covalent-variable-map';
