/**
 * MCP Bridge Types
 *
 * Type definitions for the MCP Bridge layer that abstracts postMessage
 * communication between UI components and the MCP host environment.
 */

/** Result returned from an MCP tool invocation. */
export interface McpToolResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

/** Paginated result set from a list-based MCP tool call. */
export interface PageResult<T = unknown> {
  rows: T[];
  total: number;
  offset: number;
  limit: number;
  hasMore: boolean;
}

/** Message format used for postMessage communication with the MCP host. */
export interface McpMessage {
  type: string;
  id?: number;
  payload?: unknown;
}

/** Data pushed from the MCP host to the rendered component. */
export interface McpRenderData {
  toolInput?: { arguments?: Record<string, unknown> };
  toolOutput?: unknown;
  theme?: 'light' | 'dark';
  locale?: string;
  displayMode?: 'inline' | 'modal' | 'fullscreen';
  maxHeight?: number;
}

/**
 * Maps logical tool names used by surfaces-ui components to the actual MCP tool
 * names registered on the connected server. Allows the same components to work
 * with different Teradata backends without code changes.
 *
 * Use one of the provided presets (`TERADATA_MCP_TOOL_MAPPING`, `VANTAGE_MCP_TOOL_MAPPING`)
 * or supply your own.
 */
export interface ToolMapping {
  /** Maps the internal `execute_sql` call to the server's SQL execution tool. */
  executeSQL: string;
  /** Maps `get_last_result`. Omit if the server has no equivalent. */
  getLastResult?: string;
  /** Maps `get_tables`. Omit if the server has no equivalent. */
  getTables?: string;
  /** Maps `get_databases`. Omit if the server has no equivalent. */
  getDatabases?: string;
  /** Maps `get_columns`. Omit if the server has no equivalent. */
  getColumns?: string;
}

/**
 * Targets the community `teradata-mcp-server` (https://github.com/Teradata/teradata-mcp-server).
 * This is the default mapping used by `McpAppsBridge`.
 */
export const TERADATA_MCP_TOOL_MAPPING: ToolMapping = {
  executeSQL: 'base_readQuery',
  getTables: 'base_tableList',
  getDatabases: 'base_databaseList',
  getColumns: 'base_columnDescription',
  // no getLastResult — teradata-mcp-server has no equivalent
};

/**
 * Targets the legacy `vantage-mcp` server. Use this if you are running the
 * older Teradata backend that exposes `teradata_execute_sql`.
 */
export const VANTAGE_MCP_TOOL_MAPPING: ToolMapping = {
  executeSQL: 'teradata_execute_sql',
  getLastResult: 'teradata_get_last_result',
};

/** Options for constructing a McpAppsBridge instance. */
export interface McpAppsBridgeOptions {
  /**
   * Tool name mapping to use. Defaults to `TERADATA_MCP_TOOL_MAPPING`.
   * Pass `VANTAGE_MCP_TOOL_MAPPING` to target the older vantage-mcp server.
   */
  toolMapping?: ToolMapping;
}

/** Configuration for the MCP Bridge instance. */
export interface McpBridgeConfig {
  /** Origin to validate incoming postMessage events against. Use '*' to allow any origin. */
  targetOrigin?: string;
  /** Timeout in milliseconds for tool calls. Default 30000. */
  timeout?: number;
}

/** Internal type for tracking pending tool call promises. */
export interface PendingCall<T = unknown> {
  resolve: (value: McpToolResult<T>) => void;
  reject: (reason: Error) => void;
  timer: ReturnType<typeof setTimeout>;
}

/** Response message format received from the MCP host. */
export interface McpResponseMessage {
  type: 'tool_result' | 'render_data' | 'stream_chunk' | 'stream_end' | 'error';
  id?: number;
  payload?: unknown;
}
