/**
 * ConversationViewer Unit Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ConversationViewer } from './ConversationViewer';
import { McpBridgeProvider } from '../../bridge/McpBridgeProvider';
import type { BridgeLike } from '../../bridge/McpBridgeProvider';

// ─── Mock bridge factory ────────────────────────────────────

type ToolHandler = (args?: Record<string, unknown>) => Promise<{ success: boolean; data?: unknown; error?: string }>;

function createMockBridge(toolHandlers: Record<string, ToolHandler> = {}): BridgeLike {
  const callTool = vi.fn(async (toolName: string, args?: Record<string, unknown>) => {
    const handler = toolHandlers[toolName];
    if (handler) return handler(args);
    return { success: true, data: {} };
  });

  return {
    connect: vi.fn(),
    disconnect: vi.fn(),
    isConnected: true,
    callTool,
    onDataPush: vi.fn(() => () => {}),
    fetchPage: vi.fn().mockResolvedValue({ rows: [], total: 0, offset: 0, limit: 10, hasMore: false }),
    onStreamChunk: vi.fn(() => () => {}),
    startStream: vi.fn(() => ({ id: 1, result: Promise.resolve({ success: true }) })),
    cancelStream: vi.fn(),
  };
}

function renderWithBridge(bridge: BridgeLike, props: Record<string, unknown> = {}) {
  return render(
    <McpBridgeProvider bridge={bridge}>
      <ConversationViewer {...props} />
    </McpBridgeProvider>,
  );
}

// ─── Test data ──────────────────────────────────────────────

const mockSessions = {
  sessions: [
    { id: 'sess_001', createdAt: '1700000000', updatedAt: '1700000100', state: 'active', totalCostUsd: 0.025, conversationCount: 4 },
    { id: 'sess_002', createdAt: '1700000200', updatedAt: '1700000300', state: 'active', totalCostUsd: 0.050, conversationCount: 8 },
  ],
};

const mockHistory001 = {
  sessionId: 'sess_001',
  messages: [
    { id: '1', role: 'user', content: 'Hello from session one', timestamp: '1700000000' },
    { id: '2', role: 'assistant', content: 'Hi from session one!', timestamp: '1700000010' },
  ],
};

const mockHistory002 = {
  sessionId: 'sess_002',
  messages: [
    { id: '10', role: 'user', content: 'Hello agent', timestamp: '1700000200' },
    { id: '11', role: 'assistant', content: 'Hi! How can I help?', timestamp: '1700000210' },
    { id: '12', role: 'tool', content: 'tool_search completed: 5 results', timestamp: '1700000220' },
    { id: '13', role: 'assistant', content: 'I found some tools for you.', timestamp: '1700000230' },
  ],
};

function defaultHandlers(overrides: Record<string, ToolHandler> = {}): Record<string, ToolHandler> {
  return {
    list_sessions: async () => ({ success: true, data: mockSessions }),
    get_conversation_history: async (args) => {
      const sid = args?.session_id;
      if (sid === 'sess_001') return { success: true, data: mockHistory001 };
      if (sid === 'sess_002') return { success: true, data: mockHistory002 };
      return { success: true, data: { sessionId: sid, messages: [] } };
    },
    ...overrides,
  };
}

// ─── Tests ──────────────────────────────────────────────────

describe('ConversationViewer', () => {
  const user = userEvent.setup();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('session loading', () => {
    it('shows loading state initially', () => {
      const bridge = createMockBridge({
        list_sessions: () => new Promise(() => {}), // never resolves
      });
      renderWithBridge(bridge);
      expect(screen.getByText('Loading sessions...')).toBeInTheDocument();
    });

    it('loads and displays sessions', async () => {
      const bridge = createMockBridge(defaultHandlers());
      renderWithBridge(bridge);

      await waitFor(() => {
        expect(screen.getByText('sess_001')).toBeInTheDocument();
        // sess_002 appears in sidebar + conversation header (auto-selected)
        expect(screen.getAllByText('sess_002').length).toBeGreaterThanOrEqual(1);
      });
    });

    it('shows empty state when no sessions', async () => {
      const bridge = createMockBridge({
        list_sessions: async () => ({ success: true, data: { sessions: [] } }),
      });
      renderWithBridge(bridge);

      await waitFor(() => {
        expect(screen.getByText('No sessions found')).toBeInTheDocument();
      });
    });

    it('deduplicates sessions by id, keeping latest updatedAt', async () => {
      const bridge = createMockBridge({
        list_sessions: async () => ({
          success: true,
          data: {
            sessions: [
              { id: 'sess_dup', createdAt: '100', updatedAt: '200', state: 'active', conversationCount: 2 },
              { id: 'sess_dup', createdAt: '100', updatedAt: '300', state: 'active', conversationCount: 5 },
            ],
          },
        }),
        get_conversation_history: async () => ({
          success: true,
          data: { sessionId: 'sess_dup', messages: [] },
        }),
      });
      renderWithBridge(bridge);

      await waitFor(() => {
        const items = screen.getAllByText('sess_dup');
        // One in the sidebar, one in the conversation header
        expect(items.length).toBeLessThanOrEqual(2);
      });
    });
  });

  describe('conversation loading', () => {
    it('auto-selects first session (by most recent updatedAt) and loads its conversation', async () => {
      const bridge = createMockBridge(defaultHandlers());
      renderWithBridge(bridge);

      // sess_002 has higher updatedAt, so it's sorted first and auto-selected
      await waitFor(() => {
        expect(screen.getByText('Hello agent')).toBeInTheDocument();
        expect(screen.getByText('Hi! How can I help?')).toBeInTheDocument();
      });
    });

    it('displays tool messages with tool call badge', async () => {
      const bridge = createMockBridge(defaultHandlers());
      renderWithBridge(bridge);

      await waitFor(() => {
        expect(screen.getByText('tool_search completed: 5 results')).toBeInTheDocument();
        expect(screen.getByText('tool call')).toBeInTheDocument();
      });
    });

    it('shows error when conversation load fails', async () => {
      const bridge = createMockBridge({
        list_sessions: async () => ({ success: true, data: mockSessions }),
        get_conversation_history: async () => ({ success: false, error: 'Session not found' }),
      });
      renderWithBridge(bridge);

      await waitFor(() => {
        expect(screen.getByText('Session not found')).toBeInTheDocument();
      });
    });
  });

  describe('session selection', () => {
    it('loads conversation when clicking a different session', async () => {
      const bridge = createMockBridge(defaultHandlers());
      renderWithBridge(bridge);

      // Wait for auto-load of sess_002
      await waitFor(() => {
        expect(screen.getByText('Hello agent')).toBeInTheDocument();
      });

      // Click sess_001
      await user.click(screen.getByText('sess_001'));

      await waitFor(() => {
        expect(screen.getByText('Hello from session one')).toBeInTheDocument();
      });
    });
  });

  describe('message rendering', () => {
    it('renders role badges for each message type', async () => {
      const bridge = createMockBridge(defaultHandlers());
      renderWithBridge(bridge);

      await waitFor(() => {
        // sess_002 has user, assistant, tool roles
        const userBadges = screen.getAllByText('user');
        const assistantBadges = screen.getAllByText('assistant');
        const toolBadges = screen.getAllByText('tool');
        expect(userBadges.length).toBeGreaterThanOrEqual(1);
        expect(assistantBadges.length).toBeGreaterThanOrEqual(1);
        expect(toolBadges.length).toBeGreaterThanOrEqual(1);
      });
    });

    it('truncates long messages with show more toggle', async () => {
      const longMessage = 'A'.repeat(600);
      const bridge = createMockBridge({
        list_sessions: async () => ({ success: true, data: mockSessions }),
        get_conversation_history: async () => ({
          success: true,
          data: {
            sessionId: 'sess_002',
            messages: [{ id: '1', role: 'assistant', content: longMessage, timestamp: '1700000000' }],
          },
        }),
      });
      renderWithBridge(bridge);

      await waitFor(() => {
        expect(screen.getByText('show more')).toBeInTheDocument();
      });

      await user.click(screen.getByText('show more'));

      await waitFor(() => {
        expect(screen.getByText('show less')).toBeInTheDocument();
      });
    });

    it('shows placeholder for empty content messages', async () => {
      const bridge = createMockBridge({
        list_sessions: async () => ({ success: true, data: mockSessions }),
        get_conversation_history: async () => ({
          success: true,
          data: {
            sessionId: 'sess_002',
            messages: [{ id: '1', role: 'assistant', content: '', timestamp: '1700000000' }],
          },
        }),
      });
      renderWithBridge(bridge);

      await waitFor(() => {
        expect(screen.getByText('(continued below)')).toBeInTheDocument();
      });
    });
  });

  describe('refresh actions', () => {
    it('has a refresh button for sessions', async () => {
      const bridge = createMockBridge({
        list_sessions: async () => ({ success: true, data: { sessions: [] } }),
      });
      renderWithBridge(bridge);

      await waitFor(() => {
        expect(screen.getByText('Refresh')).toBeInTheDocument();
      });
    });
  });

  describe('initialSessionId prop', () => {
    it('pre-selects the given session', async () => {
      const bridge = createMockBridge(defaultHandlers());
      renderWithBridge(bridge, { initialSessionId: 'sess_001' });

      await waitFor(() => {
        expect(screen.getByText('Hello from session one')).toBeInTheDocument();
      });
    });
  });
});
