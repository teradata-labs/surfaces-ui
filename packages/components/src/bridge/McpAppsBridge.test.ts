/**
 * McpAppsBridge Unit Tests
 *
 * Tests tool name mapping, response normalization, and the configurable
 * toolMapping option for targeting different Teradata backends.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { McpAppsBridge } from './McpAppsBridge';
import {
  TERADATA_MCP_TOOL_MAPPING,
  VANTAGE_MCP_TOOL_MAPPING,
} from './types';

// ─── Mock @modelcontextprotocol/ext-apps ────────────────────────────────────
// vi.mock is hoisted to the top of the file, so mock functions must be
// declared via vi.hoisted() to be available inside the factory.

const { mockConnect, mockCallServerTool, mockOpenLink } = vi.hoisted(() => ({
  mockConnect: vi.fn(),
  mockCallServerTool: vi.fn(),
  mockOpenLink: vi.fn(),
}));

vi.mock('@modelcontextprotocol/ext-apps', () => ({
  // Must use `function` (not arrow) so `new App()` works correctly in Vitest 4.x
  App: vi.fn().mockImplementation(function (this: Record<string, unknown>) {
    this.connect = mockConnect;
    this.callServerTool = mockCallServerTool;
    this.openLink = mockOpenLink;
    this.ontoolresult = null;
  }),
}));

// Helper to build a tool result with a JSON text content block
function toolResponse(body: unknown) {
  return { content: [{ type: 'text', text: JSON.stringify(body) }] };
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('McpAppsBridge', () => {
  let bridge: McpAppsBridge;

  beforeEach(() => {
    vi.clearAllMocks();
    bridge = new McpAppsBridge();
    bridge.connect();
  });

  afterEach(() => {
    bridge.disconnect();
  });

  // ── Connection lifecycle ──────────────────────────────────────────────────

  describe('connection lifecycle', () => {
    it('starts disconnected', () => {
      const b = new McpAppsBridge();
      expect(b.isConnected).toBe(false);
    });

    it('connects and becomes connected', () => {
      const b = new McpAppsBridge();
      b.connect();
      expect(b.isConnected).toBe(true);
    });

    it('connect is idempotent', () => {
      const b = new McpAppsBridge();
      mockConnect.mockClear();
      b.connect();
      b.connect();
      // Second call must not re-invoke app.connect()
      expect(mockConnect).toHaveBeenCalledTimes(1);
    });

    it('disconnects and clears listeners', () => {
      bridge.onDataPush(() => {});
      bridge.disconnect();
      expect(bridge.isConnected).toBe(false);
    });

    it('returns error when tool called before connect', async () => {
      const b = new McpAppsBridge();
      const result = await b.callTool('execute_sql', { query: 'SELECT 1' });
      expect(result.success).toBe(false);
      expect(result.error).toMatch(/not connected/i);
    });
  });

  // ── Tool name mapping: default (TERADATA_MCP_TOOL_MAPPING) ───────────────

  describe('tool mapping — default (TERADATA_MCP_TOOL_MAPPING)', () => {
    it('maps execute_sql → base_readQuery', async () => {
      mockCallServerTool.mockResolvedValueOnce(
        toolResponse({ data: [], columns: [], row_count: 0 }),
      );
      await bridge.callTool('execute_sql', { query: 'SELECT 1' });
      expect(mockCallServerTool).toHaveBeenCalledWith({
        name: 'base_readQuery',
        arguments: { sql: 'SELECT 1' },
      });
    });

    it('remaps query → sql arg for execute_sql', async () => {
      mockCallServerTool.mockResolvedValueOnce(
        toolResponse({ data: [], columns: [], row_count: 0 }),
      );
      await bridge.callTool('execute_sql', { query: 'SELECT 2', connection_id: 'prod' });
      const call = mockCallServerTool.mock.calls[0][0];
      expect(call.arguments.sql).toBe('SELECT 2');
      expect(call.arguments.connection_id).toBe('prod');
      expect(call.arguments.query).toBeUndefined();
    });

    it('maps get_tables → base_tableList', async () => {
      mockCallServerTool.mockResolvedValueOnce(
        toolResponse({ data: [], columns: [], row_count: 0 }),
      );
      await bridge.callTool('get_tables', { database_name: 'mydb' });
      expect(mockCallServerTool).toHaveBeenCalledWith({
        name: 'base_tableList',
        arguments: { database_name: 'mydb' },
      });
    });

    it('maps get_databases → base_databaseList', async () => {
      mockCallServerTool.mockResolvedValueOnce(
        toolResponse({ data: [], columns: [], row_count: 0 }),
      );
      await bridge.callTool('get_databases', {});
      expect(mockCallServerTool).toHaveBeenCalledWith({
        name: 'base_databaseList',
        arguments: {},
      });
    });

    it('maps get_columns → base_columnDescription', async () => {
      mockCallServerTool.mockResolvedValueOnce(
        toolResponse({ data: [], columns: [], row_count: 0 }),
      );
      await bridge.callTool('get_columns', { database_name: 'mydb', obj_name: 'orders' });
      expect(mockCallServerTool).toHaveBeenCalledWith({
        name: 'base_columnDescription',
        arguments: { database_name: 'mydb', obj_name: 'orders' },
      });
    });

    it('returns empty success for get_last_result (no mapping)', async () => {
      const result = await bridge.callTool('get_last_result', {});
      expect(result.success).toBe(true);
      expect(mockCallServerTool).not.toHaveBeenCalled();
    });

    it('passes unknown tool names through unchanged', async () => {
      mockCallServerTool.mockResolvedValueOnce(
        toolResponse({ success: true, data: 'ok' }),
      );
      await bridge.callTool('my_custom_tool', { foo: 'bar' });
      expect(mockCallServerTool).toHaveBeenCalledWith({
        name: 'my_custom_tool',
        arguments: { foo: 'bar' },
      });
    });
  });

  // ── Tool name mapping: VANTAGE_MCP_TOOL_MAPPING ───────────────────────────

  describe('tool mapping — VANTAGE_MCP_TOOL_MAPPING', () => {
    let vBridge: McpAppsBridge;

    beforeEach(() => {
      vi.clearAllMocks();
      vBridge = new McpAppsBridge({ toolMapping: VANTAGE_MCP_TOOL_MAPPING });
      vBridge.connect();
    });

    afterEach(() => {
      vBridge.disconnect();
    });

    it('maps execute_sql → teradata_execute_sql', async () => {
      mockCallServerTool.mockResolvedValueOnce(
        toolResponse({ columns: ['x'], rows: [[1]] }),
      );
      await vBridge.callTool('execute_sql', { query: 'SELECT 1' });
      expect(mockCallServerTool).toHaveBeenCalledWith({
        name: 'teradata_execute_sql',
        arguments: { sql: 'SELECT 1' },
      });
    });

    it('maps get_last_result → teradata_get_last_result', async () => {
      mockCallServerTool.mockResolvedValueOnce(
        toolResponse({ columns: [], rows: [] }),
      );
      await vBridge.callTool('get_last_result', {});
      expect(mockCallServerTool).toHaveBeenCalledWith({
        name: 'teradata_get_last_result',
        arguments: {},
      });
    });

    it('returns empty success for get_tables (no mapping in VANTAGE_MCP)', async () => {
      const result = await vBridge.callTool('get_tables', {});
      expect(result.success).toBe(true);
      expect(mockCallServerTool).not.toHaveBeenCalled();
    });
  });

  // ── Custom mapping ────────────────────────────────────────────────────────

  describe('tool mapping — custom', () => {
    it('accepts a custom mapping', async () => {
      const custom = new McpAppsBridge({
        toolMapping: { executeSQL: 'run_query', getTables: 'list_tables' },
      });
      custom.connect();
      mockCallServerTool.mockResolvedValueOnce(
        toolResponse({ data: [], columns: [], row_count: 0 }),
      );
      await custom.callTool('execute_sql', { query: 'SELECT 1' });
      expect(mockCallServerTool).toHaveBeenCalledWith({
        name: 'run_query',
        arguments: { sql: 'SELECT 1' },
      });
      custom.disconnect();
    });
  });

  // ── Response normalization ────────────────────────────────────────────────

  describe('normalizeResponse', () => {
    it('normalizes teradata-mcp-server format { data, columns, row_count }', async () => {
      mockCallServerTool.mockResolvedValueOnce(
        toolResponse({
          data: [{ id: 1, name: 'Alice' }],
          columns: ['id', 'name'],
          row_count: 1,
          metadata: { tool_name: 'base_readQuery', sql: 'SELECT ...' },
        }),
      );
      const result = await bridge.callTool('execute_sql', { query: 'SELECT ...' });
      expect(result.success).toBe(true);
      expect(result.data).toEqual({
        success: true,
        columns: ['id', 'name'],
        data: [{ id: 1, name: 'Alice' }],
        row_count: 1,
      });
    });

    it('uses data.length when row_count is missing', async () => {
      mockCallServerTool.mockResolvedValueOnce(
        toolResponse({
          data: [{ x: 1 }, { x: 2 }],
          columns: ['x'],
        }),
      );
      const result = await bridge.callTool('execute_sql', { query: 'SELECT x' });
      expect(result.success).toBe(true);
      const data = result.data as { row_count: number };
      expect(data.row_count).toBe(2);
    });

    it('normalizes legacy vantage-mcp format { columns, rows: [[...]] }', async () => {
      mockCallServerTool.mockResolvedValueOnce(
        toolResponse({
          columns: ['id', 'name'],
          rows: [
            [1, 'Alice'],
            [2, 'Bob'],
          ],
        }),
      );
      const result = await bridge.callTool('execute_sql', { query: 'SELECT ...' });
      expect(result.success).toBe(true);
      expect(result.data).toEqual({
        success: true,
        columns: ['id', 'name'],
        data: [
          { id: 1, name: 'Alice' },
          { id: 2, name: 'Bob' },
        ],
        row_count: 2,
      });
    });

    it('passes through already-formatted { success, ... } responses', async () => {
      mockCallServerTool.mockResolvedValueOnce(
        toolResponse({ success: true, columns: ['a'], data: [{ a: 1 }], row_count: 1 }),
      );
      const result = await bridge.callTool('execute_sql', { query: 'SELECT a' });
      expect(result.success).toBe(true);
      expect(result.data).toMatchObject({ success: true, columns: ['a'] });
    });

    it('returns error response when success:false', async () => {
      mockCallServerTool.mockResolvedValueOnce(
        toolResponse({ success: false, error: 'Table not found' }),
      );
      const result = await bridge.callTool('execute_sql', { query: 'SELECT bad' });
      expect(result.success).toBe(false);
      expect(result.error).toBe('Table not found');
    });

    it('returns raw text when response is not JSON', async () => {
      mockCallServerTool.mockResolvedValueOnce({
        content: [{ type: 'text', text: 'not json at all' }],
      });
      const result = await bridge.callTool('execute_sql', { query: 'SELECT 1' });
      expect(result.success).toBe(true);
      expect(result.data).toBe('not json at all');
    });

    it('handles empty data array gracefully', async () => {
      mockCallServerTool.mockResolvedValueOnce(
        toolResponse({ data: [], columns: ['id'], row_count: 0 }),
      );
      const result = await bridge.callTool('execute_sql', { query: 'SELECT ...' });
      expect(result.success).toBe(true);
      const data = result.data as { row_count: number; data: unknown[] };
      expect(data.row_count).toBe(0);
      expect(data.data).toEqual([]);
    });
  });

  // ── TERADATA_MCP_TOOL_MAPPING and VANTAGE_MCP_TOOL_MAPPING exports ────────

  describe('preset exports', () => {
    it('TERADATA_MCP_TOOL_MAPPING has expected keys', () => {
      expect(TERADATA_MCP_TOOL_MAPPING.executeSQL).toBe('base_readQuery');
      expect(TERADATA_MCP_TOOL_MAPPING.getTables).toBe('base_tableList');
      expect(TERADATA_MCP_TOOL_MAPPING.getDatabases).toBe('base_databaseList');
      expect(TERADATA_MCP_TOOL_MAPPING.getColumns).toBe('base_columnDescription');
      expect(TERADATA_MCP_TOOL_MAPPING.getLastResult).toBeUndefined();
    });

    it('VANTAGE_MCP_TOOL_MAPPING has expected keys', () => {
      expect(VANTAGE_MCP_TOOL_MAPPING.executeSQL).toBe('teradata_execute_sql');
      expect(VANTAGE_MCP_TOOL_MAPPING.getLastResult).toBe('teradata_get_last_result');
    });
  });
});
