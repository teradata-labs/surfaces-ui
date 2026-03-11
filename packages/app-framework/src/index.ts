// ── App bootstrap ──────────────────────────────────────────────────
export { createMcpApp } from './createMcpApp.js';
export type { McpAppOptions, McpAppHandle, McpAppThemeOptions, BridgeLike } from './types.js';

// ── Bridge (re-exports from @surfacesui/components) ────────────────
export {
  McpBridgeProvider,
  useMcpBridge,
  McpAppsBridge,
  useMcpTool,
  useMcpPagination,
  useMcpStream,
} from '@surfacesui/components';
export type {
  McpToolResult,
  PageResult,
  McpRenderData,
} from '@surfacesui/components';

// ── Theme (re-exports) ────────────────────────────────────────────
export { ThemeProvider, useTheme } from '@surfacesui/components';
export type { ThemeConfig } from '@surfacesui/components';

// ── Primitives (re-exports) ───────────────────────────────────────
export {
  Button,
  buttonVariants,
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
  Badge,
  badgeVariants,
  NotificationBadge,
  Alert,
  AlertTitle,
  AlertDescription,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  ScrollArea,
  ScrollBar,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Label,
  Input,
  Separator,
  Switch,
  Checkbox,
  RadioGroup,
  RadioGroupItem,
  Progress,
  CircularProgress,
} from '@surfacesui/components';

// ── Utility ───────────────────────────────────────────────────────
export { cn } from '@surfacesui/components';
