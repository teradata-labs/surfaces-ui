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
