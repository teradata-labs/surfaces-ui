/**
 * LoomBridge Unit Tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { LoomBridge } from './LoomBridge';

// Mock fetch globally
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

function jsonResponse(body: unknown, status = 200) {
  return Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? 'OK' : 'Error',
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(JSON.stringify(body)),
  });
}

describe('LoomBridge', () => {
  let bridge: LoomBridge;

  beforeEach(() => {
    vi.clearAllMocks();
    bridge = new LoomBridge({ loomUrl: 'http://localhost:5006' });
  });

  afterEach(() => {
    bridge.disconnect();
  });

  // ─── Connection lifecycle ──────────────────────────────────

  describe('connection lifecycle', () => {
    it('starts disconnected', () => {
      expect(bridge.isConnected).toBe(false);
    });

    it('connects and disconnects', () => {
      bridge.connect();
      expect(bridge.isConnected).toBe(true);
      bridge.disconnect();
      expect(bridge.isConnected).toBe(false);
    });

    it('connect is idempotent', () => {
      bridge.connect();
      bridge.connect();
      expect(bridge.isConnected).toBe(true);
    });

    it('returns error when calling tool before connect', async () => {
      const result = await bridge.callTool('get_health');
      expect(result.success).toBe(false);
      expect(result.error).toContain('not connected');
    });
  });

  // ─── GET route mapping ─────────────────────────────────────

  describe('GET route mapping', () => {
    beforeEach(() => bridge.connect());

    it('maps list_agents to GET /v1/agents', async () => {
      const payload = { agents: [{ id: '1', name: 'guide', status: 'running' }] };
      mockFetch.mockReturnValueOnce(jsonResponse(payload));

      const result = await bridge.callTool('list_agents');

      expect(mockFetch).toHaveBeenCalledWith('http://localhost:5006/v1/agents');
      expect(result.success).toBe(true);
      expect(result.data).toEqual(payload);
    });

    it('maps list_sessions to GET /v1/sessions', async () => {
      const payload = { sessions: [{ id: 'sess_1', state: 'active' }] };
      mockFetch.mockReturnValueOnce(jsonResponse(payload));

      const result = await bridge.callTool('list_sessions');

      expect(mockFetch).toHaveBeenCalledWith('http://localhost:5006/v1/sessions');
      expect(result.success).toBe(true);
      expect(result.data).toEqual(payload);
    });

    it('maps list_ui_apps to GET /v1/apps', async () => {
      mockFetch.mockReturnValueOnce(jsonResponse({ apps: [] }));
      await bridge.callTool('list_ui_apps');
      expect(mockFetch).toHaveBeenCalledWith('http://localhost:5006/v1/apps');
    });

    it('maps list_component_types to GET /v1/apps/component-types', async () => {
      mockFetch.mockReturnValueOnce(jsonResponse({ types: [] }));
      await bridge.callTool('list_component_types');
      expect(mockFetch).toHaveBeenCalledWith('http://localhost:5006/v1/apps/component-types');
    });

    it('maps get_health to GET /health', async () => {
      mockFetch.mockReturnValueOnce(jsonResponse({ status: 'healthy' }));
      const result = await bridge.callTool('get_health');
      expect(mockFetch).toHaveBeenCalledWith('http://localhost:5006/health');
      expect(result.data).toEqual({ status: 'healthy' });
    });

    it('passes GET query params from args', async () => {
      mockFetch.mockReturnValueOnce(jsonResponse({ sessions: [] }));
      await bridge.callTool('list_sessions', { state: 'active', limit: '10' });
      const calledUrl = mockFetch.mock.calls[0][0] as string;
      expect(calledUrl).toContain('/v1/sessions?');
      expect(calledUrl).toContain('state=active');
      expect(calledUrl).toContain('limit=10');
    });

    it('filters out undefined and empty args from GET params', async () => {
      mockFetch.mockReturnValueOnce(jsonResponse({ sessions: [] }));
      await bridge.callTool('list_sessions', { state: '', backend: undefined });
      expect(mockFetch).toHaveBeenCalledWith('http://localhost:5006/v1/sessions');
    });
  });

  // ─── Dynamic path routes ───────────────────────────────────

  describe('dynamic path routes', () => {
    beforeEach(() => bridge.connect());

    it('maps get_conversation_history with session_id in path', async () => {
      const payload = { sessionId: 'sess_abc', messages: [] };
      mockFetch.mockReturnValueOnce(jsonResponse(payload));

      const result = await bridge.callTool('get_conversation_history', {
        session_id: 'sess_abc',
        limit: '50',
      });

      const calledUrl = mockFetch.mock.calls[0][0] as string;
      expect(calledUrl).toContain('/v1/sessions/sess_abc/history');
      expect(calledUrl).toContain('limit=50');
      // session_id should NOT appear as a query param
      expect(calledUrl).not.toContain('session_id=');
      expect(result.success).toBe(true);
      expect(result.data).toEqual(payload);
    });

    it('maps get_session with session_id in path', async () => {
      mockFetch.mockReturnValueOnce(jsonResponse({ id: 'sess_abc', state: 'active' }));

      await bridge.callTool('get_session', { session_id: 'sess_abc' });

      const calledUrl = mockFetch.mock.calls[0][0] as string;
      expect(calledUrl).toBe('http://localhost:5006/v1/sessions/sess_abc');
    });
  });

  // ─── POST route mapping ────────────────────────────────────

  describe('POST route mapping', () => {
    beforeEach(() => bridge.connect());

    it('maps create_ui_app to POST /v1/apps', async () => {
      mockFetch.mockReturnValueOnce(jsonResponse({ name: 'test-app' }));

      await bridge.callTool('create_ui_app', { name: 'test-app', spec: {} });

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:5006/v1/apps',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        }),
      );
    });

    it('maps weave to POST /v1/weave with correct body', async () => {
      const response = { text: 'Hello!', sessionId: 'sess_new' };
      mockFetch.mockReturnValueOnce(jsonResponse(response));

      bridge.setAgentId('agent-1');
      bridge.setSessionId('sess-prev');
      const result = await bridge.callTool('weave', { query: 'hello' });

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.query).toBe('hello');
      expect(body.agent_id).toBe('agent-1');
      expect(body.session_id).toBe('sess-prev');
      expect(body.timeout_seconds).toBe(60);
      expect(result.data).toEqual(response);
    });

    it('maps update_ui_app with overwrite=true', async () => {
      mockFetch.mockReturnValueOnce(jsonResponse({ name: 'app' }));

      await bridge.callTool('update_ui_app', { name: 'app', spec: {} });

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.overwrite).toBe(true);
    });
  });

  // ─── Unknown tools → Weave fallback ───────────────────────

  describe('unknown tool fallback', () => {
    beforeEach(() => bridge.connect());

    it('routes unknown tools through weave', async () => {
      mockFetch.mockReturnValueOnce(jsonResponse({ text: 'done' }));

      await bridge.callTool('some_custom_tool', { foo: 'bar' });

      const calledUrl = mockFetch.mock.calls[0][0] as string;
      expect(calledUrl).toBe('http://localhost:5006/v1/weave');
      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.query).toContain('some_custom_tool');
      expect(body.query).toContain('bar');
    });

    it('uses query arg directly if present', async () => {
      mockFetch.mockReturnValueOnce(jsonResponse({ text: 'ok' }));

      await bridge.callTool('unknown', { query: 'do something specific' });

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.query).toBe('do something specific');
    });
  });

  // ─── Error handling ────────────────────────────────────────

  describe('error handling', () => {
    beforeEach(() => bridge.connect());

    it('returns error on HTTP failure (GET)', async () => {
      mockFetch.mockReturnValueOnce(
        Promise.resolve({ ok: false, status: 500, statusText: 'Internal Server Error', json: () => Promise.resolve({}) }),
      );

      const result = await bridge.callTool('get_health');
      expect(result.success).toBe(false);
      expect(result.error).toContain('500');
    });

    it('returns error on HTTP failure (POST)', async () => {
      mockFetch.mockReturnValueOnce(
        Promise.resolve({ ok: false, status: 400, text: () => Promise.resolve('bad request') }),
      );

      const result = await bridge.callTool('create_ui_app', { name: 'x' });
      expect(result.success).toBe(false);
      expect(result.error).toContain('bad request');
    });

    it('returns error on network failure', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Connection refused'));

      const result = await bridge.callTool('get_health');
      expect(result.success).toBe(false);
      expect(result.error).toBe('Connection refused');
    });
  });

  // ─── Session / Agent ID management ─────────────────────────

  describe('session and agent ID management', () => {
    beforeEach(() => bridge.connect());

    it('uses configured agentId and sessionId in weave calls', async () => {
      mockFetch.mockReturnValueOnce(jsonResponse({ text: 'hi' }));

      bridge.setAgentId('a1');
      bridge.setSessionId('s1');
      await bridge.callTool('weave', { query: 'test' });

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.agent_id).toBe('a1');
      expect(body.session_id).toBe('s1');
    });

    it('allows per-call override of agent_id', async () => {
      mockFetch.mockReturnValueOnce(jsonResponse({ text: 'hi' }));

      bridge.setAgentId('default');
      await bridge.callTool('weave', { query: 'test', agent_id: 'override' });

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.agent_id).toBe('override');
    });
  });

  // ─── Listener management ───────────────────────────────────

  describe('listener management', () => {
    it('onDataPush subscribes and unsubscribes', () => {
      const cb = vi.fn();
      const unsub = bridge.onDataPush(cb);
      expect(typeof unsub).toBe('function');
      unsub();
    });

    it('onStreamChunk subscribes and unsubscribes', () => {
      const cb = vi.fn();
      const unsub = bridge.onStreamChunk(1, cb);
      expect(typeof unsub).toBe('function');
      unsub();
    });

    it('cancelStream does not throw', () => {
      expect(() => bridge.cancelStream(999)).not.toThrow();
    });
  });

  // ─── fetchPage ─────────────────────────────────────────────

  describe('fetchPage', () => {
    beforeEach(() => bridge.connect());

    it('passes offset and limit to callTool', async () => {
      mockFetch.mockReturnValueOnce(jsonResponse({ sessions: [] }));

      await bridge.fetchPage('list_sessions', { offset: 10, limit: 20 });

      const calledUrl = mockFetch.mock.calls[0][0] as string;
      expect(calledUrl).toContain('offset=10');
      expect(calledUrl).toContain('limit=20');
    });

    it('returns empty page on failure', async () => {
      mockFetch.mockRejectedValueOnce(new Error('fail'));

      const page = await bridge.fetchPage('list_sessions', { offset: 0, limit: 10 });
      expect(page.rows).toEqual([]);
      expect(page.total).toBe(0);
      expect(page.hasMore).toBe(false);
    });
  });

  // ─── startStream ──────────────────────────────────────────

  describe('startStream', () => {
    beforeEach(() => bridge.connect());

    it('returns an id and a result promise', async () => {
      mockFetch.mockReturnValueOnce(jsonResponse({ text: 'streamed' }));

      const { id, result } = bridge.startStream('weave', { query: 'hi' });
      expect(typeof id).toBe('number');
      const res = await result;
      expect(res.success).toBe(true);
    });
  });

  // ─── Config defaults ──────────────────────────────────────

  describe('config defaults', () => {
    it('defaults loomUrl to localhost:5006', async () => {
      const defaultBridge = new LoomBridge();
      defaultBridge.connect();
      mockFetch.mockReturnValueOnce(jsonResponse({ status: 'healthy' }));

      await defaultBridge.callTool('get_health');
      expect(mockFetch).toHaveBeenCalledWith('http://localhost:5006/health');
      defaultBridge.disconnect();
    });
  });
});
