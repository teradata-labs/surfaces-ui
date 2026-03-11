/**
 * Loom Integration Demo App
 *
 * Dashboard that connects surfaces-ui components to a live Loom server
 * via LoomBridge. Demonstrates:
 *   - Bridge abstraction working with a non-vantage-mcp backend
 *   - Live data from Loom (agents, sessions, UI apps)
 *   - Agent chat via Weave RPC
 *   - surfaces-ui primitives rendering real data
 */

import * as React from 'react';
import { useState, useEffect, useCallback } from 'react';
import { createRoot } from 'react-dom/client';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { LoomBridge } from '../bridge/LoomBridge';
import { McpBridgeProvider } from '../bridge/McpBridgeProvider';
import { ThemeWrapper } from './ThemeWrapper';
import { Card, CardContent } from '../primitives/card';
import { Badge } from '../primitives/badge';
import { Button } from '../primitives/button';
import { Input } from '../primitives/input';
import { ConversationViewer } from '../components/conversation-viewer';
import { TableWithFilters } from '../molecules/table-with-filters/TableWithFilters';
import { SelectableList } from '../molecules/selectable-list';
import '../theme/tokens.css';

// ─── Types ─────────────────────────────────────────────────────

interface LoomAgent {
  id: string;
  name: string;
  status: string;
  activeSessions?: number;
  metadata?: { description?: string };
}

interface LoomUIApp {
  name: string;
  uri: string;
  displayName: string;
  description: string;
  dynamic?: boolean;
}

interface WeaveResponse {
  text: string;
  sessionId: string;
  cost?: { totalCostUsd: number };
  agentId?: string;
}

// ─── Main Dashboard ────────────────────────────────────────────

function LoomDashboard({ bridge }: { bridge: LoomBridge }) {
  const [agents, setAgents] = useState<LoomAgent[]>([]);
  const [apps, setApps] = useState<LoomUIApp[]>([]);
  const [health, setHealth] = useState<string>('checking...');
  const [loading, setLoading] = useState(true);
  const [_error, setError] = useState<string | null>(null);

  // Chat state
  const [chatInput, setChatInput] = useState('');
  const [chatMessages, setChatMessages] = useState<
    Array<{ role: 'user' | 'assistant'; text: string; cost?: number }>
  >([]);
  const [chatLoading, setChatLoading] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState<string>('');

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);

    const [healthResult, agentsResult, appsResult] = await Promise.all([
      bridge.callTool<{ status: string }>('get_health'),
      bridge.callTool<{ agents: LoomAgent[] }>('list_agents'),
      bridge.callTool<{ apps: LoomUIApp[] }>('list_ui_apps'),
    ]);

    if (healthResult.success && healthResult.data) {
      setHealth(healthResult.data.status);
    } else {
      setHealth('unreachable');
      setError(healthResult.error ?? 'Cannot reach Loom server');
    }

    if (agentsResult.success && agentsResult.data) {
      setAgents(agentsResult.data.agents ?? []);
      // Auto-select first agent for chat (only if none selected yet)
      const agentList = agentsResult.data.agents ?? [];
      const firstAgent = agentList[0];
      if (firstAgent) {
        setSelectedAgent((prev) => prev || firstAgent.id);
      }
    }

    if (appsResult.success && appsResult.data) {
      setApps(appsResult.data.apps ?? []);
    }

    setLoading(false);
  }, [bridge]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleChat = async () => {
    if (!chatInput.trim() || chatLoading) return;

    const userMessage = chatInput.trim();
    setChatInput('');
    setChatMessages((prev) => [...prev, { role: 'user', text: userMessage }]);
    setChatLoading(true);

    if (selectedAgent) {
      bridge.setAgentId(selectedAgent);
    }

    const result = await bridge.callTool<WeaveResponse>('weave', {
      query: userMessage,
      agent_id: selectedAgent,
    });

    if (result.success && result.data) {
      const resp = result.data;
      setChatMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          text: resp.text,
          cost: resp.cost?.totalCostUsd,
        },
      ]);
      if (resp.sessionId) {
        bridge.setSessionId(resp.sessionId);
      }
      // Refresh data after chat (agent may have created apps, etc.)
      loadData();
    } else {
      setChatMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          text: `Error: ${result.error}`,
        },
      ]);
    }

    setChatLoading(false);
  };

  const selectedAgentData = agents.find((a) => a.id === selectedAgent);

  return (
    <div className="bg-background flex h-screen overflow-hidden">
      {/* Left Sidebar - Agents List */}
      <div className="border-border bg-background flex w-full max-w-md flex-col border-r">
        {/* Sidebar Header */}
        <div className="border-border border-b p-4 flex-shrink-0">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-semibold">Agents</h2>
            <Badge variant={health === 'healthy' ? 'default' : 'destructive'} className="text-xs">
              {health}
            </Badge>
          </div>
        </div>

        {/* Agents List */}
        <SelectableList
          items={agents.map((agent) => ({
            id: agent.id,
            name: agent.name,
            status: agent.status,
            description: agent.metadata?.description,
            metadata:
              agent.activeSessions && agent.activeSessions > 0
                ? [`${agent.activeSessions} sessions`]
                : undefined,
          }))}
          selectedId={selectedAgent}
          onItemClick={setSelectedAgent}
          showSearch={true}
          searchPlaceholder="Search agents..."
          itemLabel="agent"
          itemLabelPlural="agents"
        />
      </div>

      {/* Main Content Area */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {selectedAgentData ? (
          <>
            {/* Agent Detail Header */}
            <div className="border-border bg-background border-b px-6 py-4">
              <div className="mb-3 flex items-center gap-3">
                <Button variant="ghost" size="sm" onClick={() => setSelectedAgent('')}>
                  <svg
                    className="mr-2 h-4 w-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M10 19l-7-7m0 0l7-7m-7 7h18"
                    />
                  </svg>
                  Back
                </Button>
                <div className="flex flex-1 items-center gap-2">
                  <svg
                    className="text-primary h-5 w-5"
                    fill="none"
                    strokeWidth="2"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <rect width="18" height="18" x="3" y="3" rx="2" />
                    <path d="M9 9h.01M15 9h.01M9 15h.01M15 15h.01" />
                  </svg>
                  <h1 className="text-lg font-semibold">{selectedAgentData.name}</h1>
                  <Badge variant="secondary" className="text-xs">
                    {selectedAgentData.status}
                  </Badge>
                </div>
              </div>

              {selectedAgentData.metadata?.description && (
                <p className="text-muted-foreground mb-3 text-sm">
                  {selectedAgentData.metadata.description}
                </p>
              )}

              {/* Stats */}
              <div className="flex flex-wrap items-center gap-3">
                <div className="bg-muted/30 border-border flex items-center gap-2 rounded-md border px-3 py-1.5">
                  <span className="text-muted-foreground text-xs font-medium">Status:</span>
                  <span className="text-xs font-medium capitalize">{selectedAgentData.status}</span>
                </div>
                {selectedAgentData.activeSessions !== undefined && (
                  <div className="bg-muted/30 border-border flex items-center gap-2 rounded-md border px-3 py-1.5">
                    <span className="text-muted-foreground text-xs font-medium">
                      Active Sessions:
                    </span>
                    <span className="text-xs font-medium">
                      {selectedAgentData.activeSessions || 0}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Agent Content */}
            <div className="flex-1 overflow-auto p-6">
              <div className="mx-auto max-w-5xl space-y-6">
                {/* Chat with Agent */}
                <section>
                  <h2 className="mb-3 text-lg font-semibold">Chat</h2>
                  <Card>
                    <CardContent className="pt-4">
                      {/* Messages */}
                      <div className="mb-4 max-h-96 space-y-3 overflow-y-auto">
                        {chatMessages.length === 0 && (
                          <p className="text-muted-foreground py-8 text-center text-sm">
                            Send a message to test the Weave integration
                          </p>
                        )}
                        {chatMessages.map((msg, i) => (
                          <div
                            key={i}
                            className={`rounded-lg p-3 text-sm ${
                              msg.role === 'user' ? 'bg-primary/10 ml-12' : 'bg-muted mr-12'
                            }`}
                          >
                            <div className="mb-1 flex items-center gap-2">
                              <span className="text-xs font-medium uppercase">{msg.role}</span>
                              {msg.cost !== undefined && (
                                <Badge variant="secondary" className="text-[10px]">
                                  ${msg.cost.toFixed(4)}
                                </Badge>
                              )}
                            </div>
                            <div className="prose prose-sm dark:prose-invert max-w-none">
                              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                {msg.text}
                              </ReactMarkdown>
                            </div>
                          </div>
                        ))}
                        {chatLoading && (
                          <div className="bg-muted mr-12 animate-pulse rounded-lg p-3 text-sm">
                            Thinking...
                          </div>
                        )}
                      </div>

                      {/* Input */}
                      <div className="flex gap-2">
                        <Input
                          type="text"
                          value={chatInput}
                          onChange={(e) => setChatInput(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && handleChat()}
                          placeholder="Ask the agent something..."
                          disabled={chatLoading}
                        />
                        <Button onClick={handleChat} disabled={chatLoading || !chatInput.trim()}>
                          Send
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </section>

                {/* Conversation Viewer */}
                <section>
                  <h2 className="mb-3 text-lg font-semibold">Conversation Viewer</h2>
                  <ConversationViewer agentId={selectedAgent} />
                </section>

                {/* UI Apps */}
                <section>
                  <h2 className="mb-3 text-lg font-semibold">UI Apps</h2>
                  {apps.length === 0 && !loading ? (
                    <p className="text-muted-foreground text-sm">No UI apps registered</p>
                  ) : (
                    <TableWithFilters
                      data={apps.map((app) => ({
                        name: app.displayName,
                        description: app.description,
                        uri: app.uri,
                        type: app.dynamic ? 'dynamic' : 'static',
                      }))}
                      columns={['name', 'description', 'uri', 'type']}
                      height={300}
                      initialDensity="comfortable"
                      showFilter={true}
                      showDensityToggle={true}
                    />
                  )}
                </section>
              </div>
            </div>
          </>
        ) : (
          <div className="flex flex-1 items-center justify-center">
            <div className="text-muted-foreground text-center">
              <svg
                className="mx-auto mb-4 h-16 w-16 opacity-50"
                fill="none"
                strokeWidth="2"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <rect width="18" height="18" x="3" y="3" rx="2" />
                <path d="M9 9h.01M15 9h.01M9 15h.01M15 15h.01" />
              </svg>
              <p className="text-sm">Select an agent to view details</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Bootstrap ─────────────────────────────────────────────────

const bridge = new LoomBridge({ loomUrl: 'http://localhost:5006' });

const root = document.getElementById('root');
if (root) {
  createRoot(root).render(
    <McpBridgeProvider bridge={bridge}>
      <ThemeWrapper
        showDemoNav={true}
        currentDemo="loom"
        showToggle={true}
      >
        <div className="-mx-4 -my-8">
          <LoomDashboard bridge={bridge} />
        </div>
      </ThemeWrapper>
    </McpBridgeProvider>,
  );
}
