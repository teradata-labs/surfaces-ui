/**
 * LoomBridge
 *
 * Bridge adapter for Loom's gRPC-gateway HTTP API.
 * Implements BridgeLike so the same components work with Loom as the backend
 * instead of vantage-mcp or Claude Desktop.
 *
 * Tool calls are mapped to Loom REST endpoints:
 *   - list_agents      → GET  /v1/agents
 *   - list_sessions    → GET  /v1/sessions
 *   - list_ui_apps     → GET  /v1/apps
 *   - list_component_types → GET /v1/apps/component-types
 *   - get_health       → GET  /health
 *   - create_ui_app    → POST /v1/apps
 *   - weave            → POST /v1/weave
 *   - (default)        → POST /v1/weave (agent-mediated)
 */

import type {
  McpBridgeConfig,
  McpRenderData,
  McpToolResult,
  PageResult,
} from './types';

export interface LoomBridgeConfig extends McpBridgeConfig {
  /** Loom HTTP gateway base URL. Default: http://localhost:5006 */
  loomUrl?: string;
  /** Default agent ID to route weave calls to. */
  agentId?: string;
  /** Default session ID for conversation continuity. */
  sessionId?: string;
}

/** Route definition for mapping a tool name to a REST call. */
interface ToolRoute {
  method: 'GET' | 'POST';
  /** Path template. Use {arg_name} for path params extracted from args. */
  path: string | ((args: Record<string, unknown>) => string);
  /** Transform tool args into the request body/params. */
  mapArgs?: (args: Record<string, unknown>) => Record<string, unknown>;
  /** Transform the response into the expected format. */
  mapResponse?: (response: unknown) => unknown;
}

export class LoomBridge {
  private loomUrl: string;
  private agentId: string | undefined;
  private sessionId: string | undefined;
  private listeners: Set<(data: McpRenderData) => void>;
  private streamListeners: Map<number, (chunk: unknown) => void>;
  private connected: boolean;
  private nextStreamId: number;

  /** Explicit tool-to-REST route mappings. */
  private routes: Map<string, ToolRoute>;

  constructor(config?: LoomBridgeConfig) {
    this.loomUrl = config?.loomUrl ?? 'http://localhost:5006';
    this.agentId = config?.agentId;
    this.sessionId = config?.sessionId;
    this.listeners = new Set();
    this.streamListeners = new Map();
    this.connected = false;
    this.nextStreamId = 1;

    this.routes = new Map<string, ToolRoute>([
      ['list_agents', { method: 'GET', path: '/v1/agents' }],
      ['list_sessions', { method: 'GET', path: '/v1/sessions' }],
      ['list_ui_apps', { method: 'GET', path: '/v1/apps' }],
      ['list_component_types', { method: 'GET', path: '/v1/apps/component-types' }],
      ['get_health', { method: 'GET', path: '/health' }],
      ['create_ui_app', { method: 'POST', path: '/v1/apps' }],
      ['update_ui_app', {
        method: 'POST',
        path: '/v1/apps',
        mapArgs: (args) => ({ ...args, overwrite: true }),
      }],
      ['weave', {
        method: 'POST',
        path: '/v1/weave',
        mapArgs: (args) => ({
          query: args.query ?? args.message ?? '',
          session_id: args.session_id ?? this.sessionId ?? '',
          agent_id: args.agent_id ?? this.agentId ?? '',
          timeout_seconds: args.timeout_seconds ?? 60,
        }),
      }],
      ['get_conversation_history', {
        method: 'GET',
        path: (args) => `/v1/sessions/${args.session_id}/history`,
        mapArgs: (args) => {
          const { session_id: _, ...rest } = args;
          return rest;
        },
      }],
      ['get_session', {
        method: 'GET',
        path: (args) => `/v1/sessions/${args.session_id}`,
        mapArgs: () => ({}),
      }],
    ]);
  }

  connect(): void {
    if (this.connected) return;
    this.connected = true;
  }

  disconnect(): void {
    this.listeners.clear();
    this.streamListeners.clear();
    this.connected = false;
  }

  get isConnected(): boolean {
    return this.connected;
  }

  async callTool<T = unknown>(
    toolName: string,
    args?: Record<string, unknown>,
  ): Promise<McpToolResult<T>> {
    if (!this.connected) {
      return { success: false, error: 'LoomBridge is not connected. Call connect() first.' };
    }

    try {
      const route = this.routes.get(toolName);

      let data: unknown;

      if (route) {
        const resolvedPath = typeof route.path === 'function'
          ? route.path(args ?? {})
          : route.path;
        const mappedArgs = route.mapArgs ? route.mapArgs(args ?? {}) : args;

        if (route.method === 'GET') {
          const params = mappedArgs ? new URLSearchParams(
            Object.entries(mappedArgs)
              .filter(([, v]) => v !== undefined && v !== '')
              .map(([k, v]) => [k, String(v)])
          ).toString() : '';
          const url = `${this.loomUrl}${resolvedPath}${params ? `?${params}` : ''}`;
          const resp = await fetch(url);
          if (!resp.ok) {
            return { success: false, error: `Loom ${resolvedPath}: ${resp.status} ${resp.statusText}` };
          }
          data = await resp.json();
        } else {
          const resp = await fetch(`${this.loomUrl}${resolvedPath}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(mappedArgs ?? {}),
          });
          if (!resp.ok) {
            const errText = await resp.text();
            return { success: false, error: `Loom ${resolvedPath}: ${resp.status} ${errText}` };
          }
          data = await resp.json();
        }

        if (route.mapResponse) {
          data = route.mapResponse(data);
        }
      } else {
        // Unknown tool: route through Weave as an agent-mediated request
        const query = args?.query
          ? String(args.query)
          : `Execute tool "${toolName}" with arguments: ${JSON.stringify(args)}`;

        const resp = await fetch(`${this.loomUrl}/v1/weave`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            query,
            session_id: this.sessionId ?? '',
            agent_id: this.agentId ?? '',
            timeout_seconds: 60,
          }),
        });

        if (!resp.ok) {
          const errText = await resp.text();
          return { success: false, error: `Loom weave: ${resp.status} ${errText}` };
        }
        data = await resp.json();
      }

      return { success: true, data: data as T };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : 'LoomBridge call failed',
      };
    }
  }

  onDataPush(callback: (data: McpRenderData) => void): () => void {
    this.listeners.add(callback);
    return () => { this.listeners.delete(callback); };
  }

  onStreamChunk(requestId: number, callback: (chunk: unknown) => void): () => void {
    this.streamListeners.set(requestId, callback);
    return () => { this.streamListeners.delete(requestId); };
  }

  async fetchPage<T = unknown>(
    toolName: string,
    args: { offset: number; limit: number; filters?: Record<string, unknown> },
  ): Promise<PageResult<T>> {
    const result = await this.callTool<PageResult<T>>(toolName, {
      offset: args.offset,
      limit: args.limit,
      ...(args.filters ?? {}),
    });

    if (!result.success || !result.data) {
      return { rows: [], total: 0, offset: args.offset, limit: args.limit, hasMore: false };
    }

    return result.data;
  }

  startStream<T = unknown>(
    toolName: string,
    args?: Record<string, unknown>,
  ): { id: number; result: Promise<McpToolResult<T>> } {
    const id = this.nextStreamId++;
    // Loom streaming would use SSE at /v1/weave:stream - for now, fallback to sync
    const result = this.callTool<T>(toolName, { ...args, stream: true });
    return { id, result };
  }

  cancelStream(requestId: number): void {
    this.streamListeners.delete(requestId);
  }

  /** Update the session ID for conversation continuity. */
  setSessionId(sessionId: string): void {
    this.sessionId = sessionId;
  }

  /** Update the target agent ID. */
  setAgentId(agentId: string): void {
    this.agentId = agentId;
  }
}
