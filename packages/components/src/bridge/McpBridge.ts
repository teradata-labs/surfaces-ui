/**
 * McpBridge
 *
 * Core bridge class that wraps postMessage communication with the MCP host.
 * Components call MCP tools via this bridge instead of making direct REST API calls.
 *
 * The bridge sends messages to `window.parent` using postMessage in the
 * MCP Apps adapter format. Tool calls are sent as `{ type: 'tool', payload: { toolName, params } }`
 * and the adapter translates these to JSON-RPC `tools/call` requests.
 * Responses come back as MessageEvents with matching IDs.
 */

import type {
  McpBridgeConfig,
  McpMessage,
  McpRenderData,
  McpResponseMessage,
  McpToolResult,
  PageResult,
  PendingCall,
} from './types';

const DEFAULT_TIMEOUT = 30_000;
const DEFAULT_ORIGIN = '*';

export class McpBridge {
  private pendingCalls: Map<number, PendingCall>;
  private nextId: number;
  private listeners: Set<(data: McpRenderData) => void>;
  private streamListeners: Map<number, (chunk: unknown) => void>;
  private config: Required<McpBridgeConfig>;
  private connected: boolean;
  private boundHandleMessage: (event: MessageEvent) => void;

  constructor(config?: McpBridgeConfig) {
    this.pendingCalls = new Map();
    this.nextId = 1;
    this.listeners = new Set();
    this.streamListeners = new Map();
    this.connected = false;
    this.config = {
      targetOrigin: config?.targetOrigin ?? DEFAULT_ORIGIN,
      timeout: config?.timeout ?? DEFAULT_TIMEOUT,
    };
    this.boundHandleMessage = this.handleMessage.bind(this);
  }

  /**
   * Initialize the bridge by listening for messages from the MCP host.
   * Must be called before any tool calls can be made.
   */
  connect(): void {
    if (this.connected) {
      return;
    }
    window.addEventListener('message', this.boundHandleMessage);
    this.connected = true;
  }

  /**
   * Cleanup the bridge by removing message listeners and rejecting
   * any pending tool calls.
   */
  disconnect(): void {
    if (!this.connected) {
      return;
    }

    window.removeEventListener('message', this.boundHandleMessage);

    // Reject all pending calls
    for (const [id, pending] of this.pendingCalls) {
      clearTimeout(pending.timer);
      pending.reject(new Error('McpBridge disconnected while call was pending'));
      this.pendingCalls.delete(id);
    }

    // Clear all listeners
    this.listeners.clear();
    this.streamListeners.clear();
    this.connected = false;
  }

  /**
   * Returns whether the bridge is currently connected and listening for messages.
   */
  get isConnected(): boolean {
    return this.connected;
  }

  /**
   * Call an MCP tool and await the result.
   *
   * @param toolName - The name of the MCP tool to invoke
   * @param args - Optional arguments to pass to the tool
   * @returns Promise resolving to the tool result
   */
  async callTool<T = unknown>(
    toolName: string,
    args?: Record<string, unknown>,
  ): Promise<McpToolResult<T>> {
    if (!this.connected) {
      return {
        success: false,
        error: 'McpBridge is not connected. Call connect() first.',
      };
    }

    const id = this.nextId++;

    return new Promise<McpToolResult<T>>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pendingCalls.delete(id);
        resolve({
          success: false,
          error: `Tool call "${toolName}" timed out after ${this.config.timeout}ms`,
        });
      }, this.config.timeout);

      this.pendingCalls.set(id, {
        resolve: resolve as PendingCall['resolve'],
        reject,
        timer,
      });

      this.postToHost({
        type: 'tool',
        id,
        payload: {
          toolName,
          params: args ?? {},
        },
      });
    });
  }

  /**
   * Subscribe to render data pushed from the MCP host.
   * This is used to receive toolInput updates, theme changes, etc.
   *
   * @param callback - Function called when new render data arrives
   * @returns Unsubscribe function
   */
  onDataPush(callback: (data: McpRenderData) => void): () => void {
    this.listeners.add(callback);
    return () => {
      this.listeners.delete(callback);
    };
  }

  /**
   * Subscribe to streaming chunks for a specific request.
   * Used internally by the stream hook.
   *
   * @param requestId - The request ID to listen for chunks on
   * @param callback - Function called for each chunk
   * @returns Unsubscribe function
   */
  onStreamChunk(requestId: number, callback: (chunk: unknown) => void): () => void {
    this.streamListeners.set(requestId, callback);
    return () => {
      this.streamListeners.delete(requestId);
    };
  }

  /**
   * Request paginated data via a tool call.
   *
   * @param toolName - The name of the MCP tool that returns paginated data
   * @param args - Pagination arguments including offset, limit, and optional filters
   * @returns Promise resolving to a PageResult
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
   * Start a streaming tool call. Returns the request ID so the caller
   * can subscribe to chunks via onStreamChunk.
   *
   * @param toolName - The name of the MCP tool to stream from
   * @param args - Optional arguments to pass to the tool
   * @returns Object with the request id and a promise for the final result
   */
  startStream<T = unknown>(
    toolName: string,
    args?: Record<string, unknown>,
  ): { id: number; result: Promise<McpToolResult<T>> } {
    if (!this.connected) {
      const id = this.nextId++;
      return {
        id,
        result: Promise.resolve({
          success: false,
          error: 'McpBridge is not connected. Call connect() first.',
        }),
      };
    }

    const id = this.nextId++;

    const result = new Promise<McpToolResult<T>>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pendingCalls.delete(id);
        this.streamListeners.delete(id);
        resolve({
          success: false,
          error: `Stream "${toolName}" timed out after ${this.config.timeout}ms`,
        });
      }, this.config.timeout);

      this.pendingCalls.set(id, {
        resolve: resolve as PendingCall['resolve'],
        reject,
        timer,
      });

      this.postToHost({
        type: 'tool',
        id,
        payload: {
          toolName,
          params: { ...args, stream: true },
        },
      });
    });

    return { id, result };
  }

  /**
   * Cancel a pending stream by its request ID.
   */
  cancelStream(requestId: number): void {
    const pending = this.pendingCalls.get(requestId);
    if (pending) {
      clearTimeout(pending.timer);
      pending.resolve({ success: true, data: undefined });
      this.pendingCalls.delete(requestId);
    }
    this.streamListeners.delete(requestId);

    if (this.connected) {
      this.postToHost({
        type: 'cancel',
        id: requestId,
        payload: {},
      });
    }
  }

  /**
   * Handle incoming postMessage events from the MCP host.
   * Validates origin, routes responses to pending calls, and
   * dispatches render data to listeners.
   */
  private handleMessage(event: MessageEvent): void {
    // Origin validation
    if (
      this.config.targetOrigin !== '*' &&
      event.origin !== this.config.targetOrigin
    ) {
      return;
    }

    const message = event.data as McpResponseMessage | undefined;
    if (!message || typeof message !== 'object' || typeof message.type !== 'string') {
      return;
    }

    switch (message.type) {
      case 'tool_result': {
        if (message.id == null) {
          return;
        }
        const pending = this.pendingCalls.get(message.id);
        if (pending) {
          clearTimeout(pending.timer);
          this.pendingCalls.delete(message.id);
          this.streamListeners.delete(message.id);
          pending.resolve(message.payload as McpToolResult);
        }
        break;
      }

      case 'stream_chunk': {
        if (message.id == null) {
          return;
        }
        const chunkListener = this.streamListeners.get(message.id);
        if (chunkListener) {
          chunkListener(message.payload);
        }
        break;
      }

      case 'stream_end': {
        if (message.id == null) {
          return;
        }
        const streamPending = this.pendingCalls.get(message.id);
        if (streamPending) {
          clearTimeout(streamPending.timer);
          this.pendingCalls.delete(message.id);
          this.streamListeners.delete(message.id);
          streamPending.resolve(
            (message.payload as McpToolResult) ?? { success: true },
          );
        }
        break;
      }

      case 'render_data': {
        const renderData = message.payload as McpRenderData;
        if (renderData) {
          for (const listener of this.listeners) {
            try {
              listener(renderData);
            } catch (err) {
              console.error('[McpBridge] Error in render data listener:', err);
            }
          }
        }
        break;
      }

      case 'error': {
        if (message.id != null) {
          const errorPending = this.pendingCalls.get(message.id);
          if (errorPending) {
            clearTimeout(errorPending.timer);
            this.pendingCalls.delete(message.id);
            this.streamListeners.delete(message.id);
            errorPending.resolve({
              success: false,
              error:
                typeof message.payload === 'string'
                  ? message.payload
                  : (message.payload as { message?: string })?.message ??
                    'Unknown error from MCP host',
            });
          }
        }
        break;
      }

      default:
        // Unknown message type, ignore
        break;
    }
  }

  /**
   * Send a message to the MCP host via postMessage on the parent window.
   */
  private postToHost(message: McpMessage): void {
    try {
      const target = window.parent;
      if (target && target !== window) {
        target.postMessage(message, this.config.targetOrigin);
      } else {
        // Fallback: post to self for testing or same-window scenarios
        window.postMessage(message, this.config.targetOrigin);
      }
    } catch (err) {
      console.error('[McpBridge] Failed to post message to host:', err);
    }
  }
}
