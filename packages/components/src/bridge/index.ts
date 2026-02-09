/**
 * MCP Bridge
 *
 * Abstraction layer that replaces direct REST API calls with MCP tool
 * invocations via postMessage. Components use this bridge to communicate
 * with the MCP host environment.
 */

export { McpBridge } from './McpBridge';
export { McpAppsBridge } from './McpAppsBridge';
export { McpBridgeProvider, useMcpBridge } from './McpBridgeProvider';
export type { McpBridgeProviderProps } from './McpBridgeProvider';
export { useMcpTool, useMcpPagination, useMcpStream } from './hooks';
export type {
  UseMcpToolOptions,
  UseMcpToolResult,
  UseMcpPaginationResult,
  UseMcpStreamResult,
} from './hooks';
export type {
  McpToolResult,
  PageResult,
  McpRenderData,
  McpBridgeConfig,
  McpMessage,
  McpResponseMessage,
} from './types';
