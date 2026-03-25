import type { BridgeLike, ToolMapping } from '@surfacesui/components';

export type { BridgeLike, ToolMapping };

export interface McpAppThemeOptions {
  /** Theme mode. Default: 'system' */
  mode?: 'light' | 'dark' | 'system';
  /** Persist theme choice to localStorage. Default: false */
  persistTheme?: boolean;
  /** Density mode. Default: 'comfortable' */
  density?: 'compact' | 'comfortable' | 'spacious';
  /** CSS custom property overrides applied to the theme wrapper. */
  tokenOverrides?: Record<string, string>;
}

export interface McpAppOptions {
  /** App name passed to the ext-apps SDK. Default: 'McpApp' */
  name?: string;
  /** App version passed to the ext-apps SDK. Default: '1.0.0' */
  version?: string;
  /** Root element ID. Default: 'root' */
  rootId?: string;
  /** Theme configuration. */
  theme?: McpAppThemeOptions;
  /** Custom bridge instance (overrides auto-created McpAppsBridge). */
  bridge?: BridgeLike;
  /**
   * Tool name mapping for the auto-created McpAppsBridge. Controls which MCP
   * server tools the app calls for logical operations like `execute_sql`.
   *
   * Defaults to `TERADATA_MCP_TOOL_MAPPING` (targets teradata-mcp-server).
   * Pass `VANTAGE_MCP_TOOL_MAPPING` for the legacy vantage-mcp server.
   * Ignored when a custom `bridge` is provided.
   */
  toolMapping?: ToolMapping;
}

export interface McpAppHandle {
  /** Unmount the React tree and disconnect the bridge. */
  unmount: () => void;
}
