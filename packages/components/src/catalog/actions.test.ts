/**
 * Action Handler Tests
 *
 * Unit tests for MCP action bridge layer.
 * Tests verify:
 * - MCP-02: execute_sql maps to bridge.callTool
 * - MCP-03: State coordination with functional updates
 * - MCP-04: Async result handling (loading/error states)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createMcpActionHandlers, type McpActionState } from './actions';
import type { BridgeLike } from '../bridge';

// Mock bridge that implements BridgeLike interface
function createMockBridge(callToolResponse?: {
  success: boolean;
  data?: unknown;
  error?: string;
}): BridgeLike {
  return {
    connect: vi.fn(),
    disconnect: vi.fn(),
    isConnected: true,
    callTool: vi.fn().mockResolvedValue(
      callToolResponse ?? { success: true, data: { columns: [], rows: [] } }
    ),
    onDataPush: vi.fn(() => () => {}),
    fetchPage: vi.fn().mockResolvedValue({ rows: [], total: 0, offset: 0, limit: 10, hasMore: false }),
    onStreamChunk: vi.fn(() => () => {}),
    startStream: vi.fn(() => ({ id: 1, result: Promise.resolve({ success: true }) })),
    cancelStream: vi.fn(),
  };
}

describe('createMcpActionHandlers', () => {
  let mockBridge: BridgeLike;
  let handlers: ReturnType<typeof createMcpActionHandlers>;
  let setState: ReturnType<typeof vi.fn>;
  let stateUpdates: McpActionState[];

  beforeEach(() => {
    mockBridge = createMockBridge();
    handlers = createMcpActionHandlers(mockBridge);
    stateUpdates = [];
    // Track all state updates by capturing the updater function results
    setState = vi.fn((updater) => {
      const prevState = stateUpdates[stateUpdates.length - 1] ?? {};
      const newState = typeof updater === 'function' ? updater(prevState) : updater;
      stateUpdates.push(newState);
    });
  });

  describe('execute_sql', () => {
    it('calls bridge.callTool with correct params', async () => {
      const params = { query: 'SELECT * FROM users', connection_id: 'conn-123' };
      await handlers.execute_sql(params, setState, {});

      expect(mockBridge.callTool).toHaveBeenCalledWith('execute_sql', {
        query: 'SELECT * FROM users',
        connection_id: 'conn-123',
      });
    });

    it('sets loading state before calling bridge', async () => {
      await handlers.execute_sql({ query: 'SELECT 1' }, setState, {});

      // First state update should set loading: true
      expect(stateUpdates[0]).toMatchObject({
        loading: true,
        error: null,
      });
    });

    it('transforms MCP result format to json-render state format', async () => {
      const mcpResult = {
        success: true,
        data: {
          columns: ['id', 'name', 'email'],
          rows: [
            [1, 'Alice', 'alice@example.com'],
            [2, 'Bob', 'bob@example.com'],
          ],
        },
      };
      const bridge = createMockBridge(mcpResult);
      const h = createMcpActionHandlers(bridge);

      await h.execute_sql({ query: 'SELECT * FROM users' }, setState, {});

      // Final state should have transformed data
      const finalState = stateUpdates[stateUpdates.length - 1];
      expect(finalState.data).toEqual([
        { id: 1, name: 'Alice', email: 'alice@example.com' },
        { id: 2, name: 'Bob', email: 'bob@example.com' },
      ]);
      expect(finalState.columns).toEqual(['id', 'name', 'email']);
      expect(finalState.row_count).toBe(2);
      expect(finalState.loading).toBe(false);
      expect(finalState.error).toBeNull();
    });

    it('sets error state on bridge failure', async () => {
      const bridge = createMockBridge({ success: false, error: 'Connection refused' });
      const h = createMcpActionHandlers(bridge);

      await h.execute_sql({ query: 'SELECT 1' }, setState, {});

      const finalState = stateUpdates[stateUpdates.length - 1];
      expect(finalState.error).toBe('Connection refused');
      expect(finalState.loading).toBe(false);
    });

    it('sets error state on thrown exception', async () => {
      const bridge = createMockBridge();
      (bridge.callTool as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Network error'));
      const h = createMcpActionHandlers(bridge);

      await h.execute_sql({ query: 'SELECT 1' }, setState, {});

      const finalState = stateUpdates[stateUpdates.length - 1];
      expect(finalState.error).toBe('Network error');
      expect(finalState.loading).toBe(false);
    });

    it('uses functional setState for atomic updates (MCP-03)', async () => {
      await handlers.execute_sql({ query: 'SELECT 1' }, setState, {});

      // Verify setState was called with functions, not values
      const calls = setState.mock.calls;
      expect(typeof calls[0][0]).toBe('function'); // loading: true
      expect(typeof calls[1][0]).toBe('function'); // result/error
    });

    it('preserves existing state during updates', async () => {
      const existingState: McpActionState = {
        data: [{ old: 'data' }],
        columns: ['old'],
        row_count: 1,
        loading: false,
        error: null,
      };
      stateUpdates.push(existingState);

      await handlers.execute_sql({ query: 'SELECT 1' }, setState, existingState);

      // Loading state should preserve other fields
      expect(stateUpdates[1]).toMatchObject({
        data: [{ old: 'data' }], // preserved
        columns: ['old'],        // preserved
        loading: true,
        error: null,
      });
    });
  });

  describe('export_csv', () => {
    it('generates CSV from state data', async () => {
      // Mock document.createElement and URL methods
      const mockLink = { href: '', download: '', click: vi.fn() };
      vi.spyOn(document, 'createElement').mockReturnValue(mockLink as unknown as HTMLAnchorElement);

      // Mock URL methods by assigning to global URL object
      const originalCreateObjectURL = URL.createObjectURL;
      const originalRevokeObjectURL = URL.revokeObjectURL;
      URL.createObjectURL = vi.fn().mockReturnValue('blob:test');
      URL.revokeObjectURL = vi.fn();

      const state: McpActionState = {
        data: [
          { id: 1, name: 'Alice' },
          { id: 2, name: 'Bob' },
        ],
        columns: ['id', 'name'],
      };

      await handlers.export_csv({ filename: 'test.csv' }, setState, state);

      expect(mockLink.download).toBe('test.csv');
      expect(mockLink.click).toHaveBeenCalled();

      // Restore original methods
      URL.createObjectURL = originalCreateObjectURL;
      URL.revokeObjectURL = originalRevokeObjectURL;
    });
  });

  describe('copy_json', () => {
    it('copies state data to clipboard as JSON', async () => {
      const writeTextMock = vi.fn().mockResolvedValue(undefined);
      Object.assign(navigator, { clipboard: { writeText: writeTextMock } });

      const state: McpActionState = {
        data: [{ id: 1, name: 'Test' }],
      };

      await handlers.copy_json({}, setState, state);

      expect(writeTextMock).toHaveBeenCalledWith(
        JSON.stringify([{ id: 1, name: 'Test' }], null, 2)
      );
    });
  });
});
