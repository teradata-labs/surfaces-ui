/**
 * MCP Action Handlers
 *
 * Bridges json-render ActionProvider to MCP Bridge tool calls.
 * Each handler wraps async MCP operations with proper state management.
 */
import type { BridgeLike } from '../bridge/McpBridgeProvider';

/** State shape for components using MCP actions */
export interface McpActionState {
  data?: Record<string, unknown>[];
  columns?: string[];
  row_count?: number;
  loading?: boolean;
  error?: string | null;
}

/** SetState function signature from json-render ActionProvider */
type SetState = (
  updater: McpActionState | ((prev: McpActionState) => McpActionState)
) => void;

/**
 * Create ActionProvider-compatible handlers that bridge to MCP tool calls.
 *
 * @param bridge - MCP Bridge instance (McpBridge or McpAppsBridge)
 * @returns Action handlers keyed by action name
 */
export function createMcpActionHandlers(bridge: BridgeLike) {
  return {
    /**
     * Execute SQL query via MCP Bridge and update state with results.
     * MCP-02: Maps execute_sql action to MCP tool call.
     * MCP-03: Uses functional setState for atomic state updates (prevents race conditions).
     * MCP-04: Handles async tool results with loading/error states.
     */
    execute_sql: async (
      params: { query: string; connection_id?: string },
      setState: SetState,
      _state: McpActionState
    ) => {
      // Set loading state atomically
      setState(prev => ({
        ...prev,
        loading: true,
        error: null,
      }));

      try {
        // Call MCP tool via bridge
        const result = await bridge.callTool<{
          columns: string[];
          rows: unknown[][];
        }>('execute_sql', {
          query: params.query,
          connection_id: params.connection_id,
        });

        if (!result.success) {
          throw new Error(result.error ?? 'SQL execution failed');
        }

        // Transform MCP result format to json-render state format
        // MCP returns { columns: string[], rows: unknown[][] }
        // Components expect { data: Record<string, unknown>[] }
        const { columns = [], rows = [] } = result.data ?? {};

        const data = rows.map(row => {
          const obj: Record<string, unknown> = {};
          columns.forEach((col, i) => {
            obj[col] = row[i];
          });
          return obj;
        });

        // Atomic state update - single source of truth
        setState(prev => ({
          ...prev,
          data,
          columns,
          row_count: data.length,
          loading: false,
          error: null,
        }));
      } catch (err) {
        // Error handling with atomic state update
        setState(prev => ({
          ...prev,
          error: err instanceof Error ? err.message : 'Unknown error',
          loading: false,
        }));
      }
    },

    /**
     * Export current data to CSV file.
     * Delegates to existing utility function.
     */
    export_csv: async (
      params: { filename?: string },
      _setState: SetState,
      state: McpActionState
    ) => {
      const filename = params.filename ?? 'export.csv';
      const data = state.data ?? [];
      const columns = state.columns ?? (data[0] ? Object.keys(data[0]) : []);

      // Build CSV content
      const header = columns.join(',');
      const rows = data.map(row =>
        columns.map(col => {
          const val = row[col];
          // Escape quotes and wrap strings with commas/quotes
          if (typeof val === 'string' && (val.includes(',') || val.includes('"'))) {
            return `"${val.replace(/"/g, '""')}"`;
          }
          return String(val ?? '');
        }).join(',')
      );
      const csv = [header, ...rows].join('\n');

      // Download via blob
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      link.click();
      URL.revokeObjectURL(url);
    },

    /**
     * Copy current data as JSON to clipboard.
     */
    copy_json: async (
      _params: Record<string, unknown>,
      _setState: SetState,
      state: McpActionState
    ) => {
      const data = state.data ?? [];
      await navigator.clipboard.writeText(JSON.stringify(data, null, 2));
    },
  };
}
