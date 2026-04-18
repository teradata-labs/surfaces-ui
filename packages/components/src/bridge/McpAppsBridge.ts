/**
 * McpAppsBridge
 *
 * Bridge adapter for MCP Apps protocol (Claude Desktop, etc.).
 * Implements the same interface as McpBridge but uses @modelcontextprotocol/ext-apps
 * for communication instead of postMessage.
 *
 * This allows the same components (SQLEditor, etc.) to work in both:
 * - iframe/postMessage environments (web-based MCP hosts)
 * - MCP Apps environments (Claude Desktop)
 */

import { App } from '@modelcontextprotocol/ext-apps';
import type {
  McpBridgeConfig,
  McpRenderData,
  McpToolResult,
  PageResult,
} from './types';

export class McpAppsBridge {
  private app: App;
  private listeners: Set<(data: McpRenderData) => void>;
  private streamListeners: Map<number, (chunk: unknown) => void>;
  private connected: boolean;
  private nextStreamId: number;

  constructor(_config?: McpBridgeConfig) {
    // Config is ignored for MCP Apps - the App class handles connection details
    this.app = new App({ name: 'SurfacesUI', version: '1.0.0' });
    this.listeners = new Set();
    this.streamListeners = new Map();
    this.connected = false;
    this.nextStreamId = 1;
  }

  /**
   * Initialize the bridge by connecting to the MCP Apps host.
   */
  connect(): void {
    if (this.connected) {
      return;
    }

    this.app.connect();

    // Listen for tool results pushed from host (initial render)
    this.app.ontoolresult = (toolResult: unknown) => {
      // Convert to render data format and notify listeners
      const renderData: McpRenderData = {
        toolOutput: toolResult,
      };
      for (const listener of this.listeners) {
        try {
          listener(renderData);
        } catch (err) {
          console.error('[McpAppsBridge] Error in render data listener:', err);
        }
      }
    };

    this.connected = true;
  }

  /**
   * Cleanup the bridge.
   */
  disconnect(): void {
    this.listeners.clear();
    this.streamListeners.clear();
    this.connected = false;
  }

  /**
   * Returns whether the bridge is currently connected.
   */
  get isConnected(): boolean {
    return this.connected;
  }

  /**
   * Normalize vantage-mcp response format to surfacesui expected format.
   *
   * vantage-mcp returns: { columns: [...], rows: [[...], [...]] }
   * surfacesui expects: { success: true, columns: [...], data: [{col: val}, ...], row_count: N }
   */
  private normalizeResponse(raw: unknown): unknown {
    if (typeof raw !== 'object' || raw === null) {
      return raw;
    }

    const obj = raw as Record<string, unknown>;

    // If already in expected format (has success field), return as-is
    if ('success' in obj) {
      return obj;
    }

    // Handle success message strings (DDL/DML)
    if (typeof raw === 'string') {
      const text = raw as string;
      if (text.startsWith('✓') || text.toLowerCase().includes('executed successfully')) {
        return {
          success: true,
          message: text,
          columns: [],
          data: [],
          row_count: 0,
        };
      }
    }

    // Transform vantage-mcp format { columns, rows } to { success, columns, data, row_count }
    if ('columns' in obj && 'rows' in obj) {
      const columns = obj.columns as string[];
      const rows = obj.rows as unknown[][];

      // Convert 2D array to array of objects
      const data = rows.map((row) => {
        if (!Array.isArray(row)) return row;
        const rowObj: Record<string, unknown> = {};
        columns.forEach((col, i) => {
          rowObj[col] = i < row.length ? row[i] : null;
        });
        return rowObj;
      });

      return {
        success: true,
        columns,
        data,
        row_count: data.length,
      };
    }

    return raw;
  }

  /**
   * Map tool names and arguments from surfacesui conventions to teradata-mcp-server conventions.
   * This allows the same components to work with different backends.
   */
  private mapToolCall(toolName: string, args?: Record<string, unknown>): { name: string; arguments: Record<string, unknown> } {
    // Map execute_sql -> base_readQuery (teradata-mcp-server), query -> sql
    if (toolName === 'execute_sql') {
      const mappedArgs: Record<string, unknown> = {};
      if (args?.query !== undefined) {
        mappedArgs.sql = args.query;
      }
      if (args?.persist !== undefined) {
        mappedArgs.persist = args.persist;
      }
      // Pass through other args except 'query' and 'persist' (already handled)
      for (const [key, value] of Object.entries(args ?? {})) {
        if (key !== 'query' && key !== 'persist') {
          mappedArgs[key] = value;
        }
      }
      return { name: 'base_readQuery', arguments: mappedArgs };
    }

    // Default: pass through unchanged
    return { name: toolName, arguments: args ?? {} };
  }

  /**
   * Call an MCP tool and await the result.
   * Maps to the ext-apps callServerTool API.
   */
  async callTool<T = unknown>(
    toolName: string,
    args?: Record<string, unknown>,
  ): Promise<McpToolResult<T>> {
    if (!this.connected) {
      return {
        success: false,
        error: 'McpAppsBridge is not connected. Call connect() first.',
      };
    }

    try {
      // Map tool name and args to vantage-mcp conventions
      const mapped = this.mapToolCall(toolName, args);

      const toolResult = await this.app.callServerTool({
        name: mapped.name,
        arguments: mapped.arguments,
      });

      // Parse the tool result - MCP returns content array
      const textContent = (toolResult as { content?: Array<{ type: string; text?: string }> })
        ?.content?.find((c) => c.type === 'text');

      if (textContent?.text) {
        try {
          const parsed = JSON.parse(textContent.text);

          // Normalize vantage-mcp response format to surfacesui format
          const normalized = this.normalizeResponse(parsed);

          // Check if the result indicates an error
          if (typeof normalized === 'object' && normalized !== null && 'success' in normalized) {
            const result = normalized as { success: boolean; error?: string };
            if (!result.success) {
              return {
                success: false,
                error: result.error ?? 'Unknown error',
              };
            }
          }
          return {
            success: true,
            data: normalized as T,
          };
        } catch {
          // Return raw text if not JSON
          return {
            success: true,
            data: textContent.text as unknown as T,
          };
        }
      }

      return {
        success: true,
        data: toolResult as T,
      };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Tool call failed',
      };
    }
  }

  /**
   * Subscribe to render data pushed from the MCP host.
   */
  onDataPush(callback: (data: McpRenderData) => void): () => void {
    this.listeners.add(callback);
    return () => {
      this.listeners.delete(callback);
    };
  }

  /**
   * Subscribe to streaming chunks (not fully supported in MCP Apps yet).
   */
  onStreamChunk(requestId: number, callback: (chunk: unknown) => void): () => void {
    this.streamListeners.set(requestId, callback);
    return () => {
      this.streamListeners.delete(requestId);
    };
  }

  /**
   * Request paginated data via a tool call.
   */
  async fetchPage<T = unknown>(
    toolName: string,
    args: {
      offset: number;
      limit: number;
      filters?: Record<string, unknown>;
    },
  ): Promise<PageResult<T>> {
    const result = await this.callTool<PageResult<T>>(toolName, {
      offset: args.offset,
      limit: args.limit,
      ...(args.filters ?? {}),
    });

    if (!result.success || !result.data) {
      return {
        rows: [],
        total: 0,
        offset: args.offset,
        limit: args.limit,
        hasMore: false,
      };
    }

    return result.data;
  }

  /**
   * Start a streaming tool call (limited support in MCP Apps).
   */
  startStream<T = unknown>(
    toolName: string,
    args?: Record<string, unknown>,
  ): { id: number; result: Promise<McpToolResult<T>> } {
    const id = this.nextStreamId++;

    // MCP Apps doesn't have native streaming - just do a regular call
    const result = this.callTool<T>(toolName, { ...args, stream: true });

    return { id, result };
  }

  /**
   * Cancel a pending stream.
   */
  cancelStream(requestId: number): void {
    this.streamListeners.delete(requestId);
  }

  /**
   * Open a link in the user's browser via the MCP Apps host.
   * This is the proper way to open external URLs from an MCP App.
   */
  async openLink(url: string): Promise<{ success: boolean; error?: string }> {
    if (!this.connected) {
      return {
        success: false,
        error: 'McpAppsBridge is not connected. Call connect() first.',
      };
    }

    try {
      const result = await this.app.openLink({ url });
      if (result.isError) {
        return {
          success: false,
          error: 'Host denied the link request',
        };
      }
      return { success: true };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Failed to open link',
      };
    }
  }
}
