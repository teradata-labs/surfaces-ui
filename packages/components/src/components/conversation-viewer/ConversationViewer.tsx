/**
 * ConversationViewer
 *
 * Displays Loom agent conversation history. Fetches sessions from the
 * bridge, lets you pick one, then renders the full message thread with
 * role-based styling (user / assistant / tool).
 *
 * Designed for the LoomBridge but works with any BridgeLike that
 * implements `get_conversation_history` and `list_sessions` tools.
 */

import * as React from 'react';
import { useState, useEffect, useCallback, useRef } from 'react';
import { useMcpBridge } from '../../bridge/McpBridgeProvider';
import { Card, CardContent, CardHeader, CardTitle } from '../../primitives/card';
import { Badge } from '../../primitives/badge';
import { Button } from '../../primitives/button';
import type {
  ConversationMessage,
  SessionSummary,
  ConversationHistoryResponse,
  ListSessionsResponse,
} from './types';

// ─── Helpers ───────────────────────────────────────────────────

function formatTimestamp(ts: string): string {
  const num = Number(ts);
  if (!num) return ts;
  const d = new Date(num * 1000);
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function roleColor(role: string): string {
  switch (role) {
    case 'user': return 'bg-primary/10 border-primary/20';
    case 'assistant': return 'bg-muted border-muted-foreground/10';
    case 'tool': return 'bg-secondary/50 border-secondary';
    case 'system': return 'bg-accent/20 border-accent/30';
    default: return 'bg-muted';
  }
}

function roleBadgeVariant(role: string): 'default' | 'secondary' | 'outline' {
  switch (role) {
    case 'user': return 'default';
    case 'assistant': return 'secondary';
    default: return 'outline';
  }
}

// ─── Message Bubble ────────────────────────────────────────────

function MessageBubble({ message }: { message: ConversationMessage }) {
  const [expanded, setExpanded] = useState(false);
  const content = message.content ?? '';
  const isLong = content.length > 500;
  const displayContent = isLong && !expanded ? content.slice(0, 500) + '...' : content;

  return (
    <div className={`rounded-lg border p-3 ${roleColor(message.role)}`}>
      <div className="flex items-center gap-2 mb-1.5">
        <Badge variant={roleBadgeVariant(message.role)} className="text-[10px] uppercase">
          {message.role}
        </Badge>
        <span className="text-[10px] text-muted-foreground">
          {formatTimestamp(message.timestamp)}
        </span>
        {message.role === 'tool' && (
          <Badge variant="outline" className="text-[10px]">
            tool call
          </Badge>
        )}
      </div>

      {content ? (
        <div className="text-sm whitespace-pre-wrap break-words leading-relaxed">
          {displayContent}
          {isLong && (
            <button
              onClick={() => setExpanded(!expanded)}
              className="ml-1 text-primary text-xs hover:underline"
            >
              {expanded ? 'show less' : 'show more'}
            </button>
          )}
        </div>
      ) : (
        <span className="text-xs text-muted-foreground italic">
          (continued below)
        </span>
      )}
    </div>
  );
}

// ─── Session Picker ────────────────────────────────────────────

function SessionPicker({
  sessions,
  selected,
  onSelect,
}: {
  sessions: SessionSummary[];
  selected: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="space-y-1">
      {sessions.map(s => (
        <button
          key={`${s.id}-${s.updatedAt}`}
          onClick={() => onSelect(s.id)}
          className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors ${
            selected === s.id
              ? 'bg-primary text-primary-foreground'
              : 'hover:bg-muted'
          }`}
        >
          <div className="flex items-center justify-between">
            <code className="text-xs">{s.id}</code>
            <Badge
              variant={s.state === 'active' ? 'default' : 'secondary'}
              className={`text-[10px] ${selected === s.id ? 'bg-primary-foreground/20 text-primary-foreground' : ''}`}
            >
              {s.state}
            </Badge>
          </div>
          <div className="flex items-center justify-between mt-0.5 text-xs opacity-70">
            <span>{s.conversationCount ?? 0} msgs</span>
            {s.totalCostUsd != null && s.totalCostUsd > 0 && (
              <span>${s.totalCostUsd.toFixed(4)}</span>
            )}
          </div>
        </button>
      ))}
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────

export interface ConversationViewerProps {
  /** Pre-select a session by ID. */
  initialSessionId?: string;
  /** CSS class for the outer container. */
  className?: string;
}

export function ConversationViewer({ initialSessionId, className }: ConversationViewerProps) {
  const { bridge } = useMcpBridge();

  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [selectedSession, setSelectedSession] = useState<string | null>(initialSessionId ?? null);
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [sessionsLoading, setSessionsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Load sessions
  const loadSessions = useCallback(async () => {
    setSessionsLoading(true);
    const result = await bridge.callTool<ListSessionsResponse>('list_sessions');
    if (result.success && result.data) {
      // Deduplicate by id (keep latest updatedAt)
      const byId = new Map<string, SessionSummary>();
      for (const s of result.data.sessions ?? []) {
        const existing = byId.get(s.id);
        if (!existing || Number(s.updatedAt) > Number(existing.updatedAt)) {
          byId.set(s.id, s);
        }
      }
      const deduped = Array.from(byId.values())
        .sort((a, b) => Number(b.updatedAt) - Number(a.updatedAt));
      setSessions(deduped);

      // Auto-select first if none selected
      if (!selectedSession && deduped.length > 0) {
        const first = deduped[0];
        if (first) {
          setSelectedSession(first.id);
        }
      }
    }
    setSessionsLoading(false);
  }, [bridge, selectedSession]);

  // Load conversation for selected session
  const loadConversation = useCallback(async (sessionId: string) => {
    setLoading(true);
    setError(null);
    setMessages([]);

    const result = await bridge.callTool<ConversationHistoryResponse>(
      'get_conversation_history',
      { session_id: sessionId, limit: 100 },
    );

    if (result.success && result.data) {
      setMessages(result.data.messages ?? []);
    } else {
      setError(result.error ?? 'Failed to load conversation');
    }
    setLoading(false);
  }, [bridge]);

  useEffect(() => { loadSessions(); }, [loadSessions]);

  useEffect(() => {
    if (selectedSession) {
      loadConversation(selectedSession);
    }
  }, [selectedSession, loadConversation]);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView?.({ behavior: 'smooth' });
  }, [messages]);

  return (
    <div className={`flex gap-4 ${className ?? ''}`}>
      {/* Session sidebar */}
      <Card className="w-64 shrink-0 self-start">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm">Sessions</CardTitle>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 text-xs"
              onClick={loadSessions}
              disabled={sessionsLoading}
            >
              {sessionsLoading ? '...' : 'Refresh'}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="max-h-[600px] overflow-y-auto">
          {sessionsLoading ? (
            <p className="text-xs text-muted-foreground animate-pulse">Loading sessions...</p>
          ) : sessions.length === 0 ? (
            <p className="text-xs text-muted-foreground">No sessions found</p>
          ) : (
            <SessionPicker
              sessions={sessions}
              selected={selectedSession}
              onSelect={setSelectedSession}
            />
          )}
        </CardContent>
      </Card>

      {/* Conversation thread */}
      <Card className="flex-1 min-w-0">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm">
              {selectedSession ? (
                <>Conversation <code className="text-xs font-normal ml-1">{selectedSession}</code></>
              ) : (
                'Select a session'
              )}
            </CardTitle>
            {selectedSession && (
              <Button
                variant="ghost"
                size="sm"
                className="h-6 text-xs"
                onClick={() => loadConversation(selectedSession)}
                disabled={loading}
              >
                {loading ? '...' : 'Reload'}
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {error && (
            <div className="bg-destructive/10 text-destructive border border-destructive/20 rounded-md p-2 text-xs mb-3">
              {error}
            </div>
          )}

          {loading ? (
            <div className="space-y-3 animate-pulse">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-16 bg-muted rounded-lg" />
              ))}
            </div>
          ) : messages.length === 0 && selectedSession ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              No messages in this session
            </p>
          ) : !selectedSession ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              Pick a session from the sidebar to view its conversation
            </p>
          ) : (
            <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1">
              {messages.map(msg => (
                <MessageBubble key={msg.id} message={msg} />
              ))}
              <div ref={messagesEndRef} />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
