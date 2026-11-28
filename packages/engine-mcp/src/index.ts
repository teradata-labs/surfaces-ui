import { StreamableHTTPClientTransport } from "@modelcontextprotocol/client";
import type { Transport } from "@modelcontextprotocol/client";

export { type McpSql, type McpSqlOptions, databaseError, findQueryTool, mcpSql } from "./client.js";
export { type McpEngineOptions, createMcpEngine, standardType, teradataMcpClient, typeOfValues } from "./engine.js";
export { inlineParams, literal } from "./literal.js";
export { type SqlColumn, type SqlRows, type ToolAnswer, readRows, toolError } from "./parse.js";
export { pythonLiteral } from "./python.js";

/**
 * A database's MCP server over Streamable HTTP. `token` is called per
 * connection and its value sent as a bearer token; the host reads it from
 * its own environment or vault, never from config.
 */
export function httpServer(url: string, options: { token?(): string | undefined; headers?: Record<string, string> } = {}): () => Transport {
  return () => {
    const token = options.token?.();
    return new StreamableHTTPClientTransport(new URL(url), { requestInit: { headers: { ...options.headers, ...(token ? { Authorization: `Bearer ${token}` } : {}) } } });
  };
}
