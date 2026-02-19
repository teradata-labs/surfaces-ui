/**
 * Loom Integration Test App
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
import { LoomBridge } from '../bridge/LoomBridge';
import { McpBridgeProvider } from '../bridge/McpBridgeProvider';
import { ThemeProvider } from '../theme/ThemeProvider';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../primitives/card';
import { Badge } from '../primitives/badge';
import { Button } from '../primitives/button';
import { ConversationViewer } from '../components/conversation-viewer';
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
  const [error, setError] = useState<string | null>(null);

  // Chat state
  const [chatInput, setChatInput] = useState('');
  const [chatMessages, setChatMessages] = useState<Array<{ role: 'user' | 'assistant'; text: string; cost?: number }>>([]);
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
      // Auto-select first agent for chat
      const agentList = agentsResult.data.agents ?? [];
      const firstAgent = agentList[0];
      if (firstAgent && !selectedAgent) {
        setSelectedAgent(firstAgent.id);
      }
    }

    if (appsResult.success && appsResult.data) {
      setApps(appsResult.data.apps ?? []);
    }

    setLoading(false);
  }, [bridge, selectedAgent]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleChat = async () => {
    if (!chatInput.trim() || chatLoading) return;

    const userMessage = chatInput.trim();
    setChatInput('');
    setChatMessages(prev => [...prev, { role: 'user', text: userMessage }]);
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
      setChatMessages(prev => [...prev, {
        role: 'assistant',
        text: resp.text,
        cost: resp.cost?.totalCostUsd,
      }]);
      if (resp.sessionId) {
        bridge.setSessionId(resp.sessionId);
      }
      // Refresh data after chat (agent may have created apps, etc.)
      loadData();
    } else {
      setChatMessages(prev => [...prev, {
        role: 'assistant',
        text: `Error: ${result.error}`,
      }]);
    }

    setChatLoading(false);
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <div className="border-b bg-card px-6 py-4">
        <div className="flex items-center justify-between max-w-6xl mx-auto">
          <div>
            <h1 className="text-2xl font-bold">Loom + SurfacesUI</h1>
            <p className="text-sm text-muted-foreground">Integration test dashboard</p>
          </div>
          <div className="flex items-center gap-3">
            <Badge variant={health === 'healthy' ? 'default' : 'destructive'}>
              {health}
            </Badge>
            <Button variant="outline" size="sm" onClick={loadData} disabled={loading}>
              {loading ? 'Loading...' : 'Refresh'}
            </Button>
          </div>
        </div>
      </div>

      {error && (
        <div className="max-w-6xl mx-auto px-6 pt-4">
          <div className="bg-destructive/10 text-destructive border border-destructive/20 rounded-md p-3 text-sm">
            {error}
          </div>
        </div>
      )}

      <div className="max-w-6xl mx-auto px-6 py-6 space-y-6">
        {/* Agents */}
        <section>
          <h2 className="text-lg font-semibold mb-3">Agents</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {agents.map(agent => (
              <Card key={agent.id} className={selectedAgent === agent.id ? 'ring-2 ring-primary' : ''}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">{agent.name}</CardTitle>
                    <Badge variant={agent.status === 'running' ? 'default' : 'secondary'}>
                      {agent.status}
                    </Badge>
                  </div>
                  <CardDescription className="text-xs">
                    {agent.metadata?.description ?? 'No description'}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>Sessions: {agent.activeSessions ?? 0}</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => setSelectedAgent(agent.id)}
                    >
                      {selectedAgent === agent.id ? 'Selected' : 'Select for chat'}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
            {agents.length === 0 && !loading && (
              <p className="text-sm text-muted-foreground col-span-full">No agents running</p>
            )}
          </div>
        </section>

        {/* Chat with Agent */}
        <section>
          <h2 className="text-lg font-semibold mb-3">
            Chat with {agents.find(a => a.id === selectedAgent)?.name ?? 'Agent'}
          </h2>
          <Card>
            <CardContent className="pt-4">
              {/* Messages */}
              <div className="space-y-3 mb-4 max-h-96 overflow-y-auto">
                {chatMessages.length === 0 && (
                  <p className="text-sm text-muted-foreground py-8 text-center">
                    Send a message to test the Weave integration
                  </p>
                )}
                {chatMessages.map((msg, i) => (
                  <div
                    key={i}
                    className={`rounded-lg p-3 text-sm ${
                      msg.role === 'user'
                        ? 'bg-primary/10 ml-12'
                        : 'bg-muted mr-12'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-xs uppercase">
                        {msg.role}
                      </span>
                      {msg.cost !== undefined && (
                        <Badge variant="secondary" className="text-[10px]">
                          ${msg.cost.toFixed(4)}
                        </Badge>
                      )}
                    </div>
                    <div className="whitespace-pre-wrap">{msg.text}</div>
                  </div>
                ))}
                {chatLoading && (
                  <div className="bg-muted rounded-lg p-3 text-sm mr-12 animate-pulse">
                    Thinking...
                  </div>
                )}
              </div>

              {/* Input */}
              <div className="flex gap-2">
                <input
                  type="text"
                  value={chatInput}
                  onChange={e => setChatInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleChat()}
                  placeholder="Ask the agent something..."
                  className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
          <h2 className="text-lg font-semibold mb-3">Conversation Viewer</h2>
          <ConversationViewer />
        </section>

        {/* UI Apps */}
        <section>
          <h2 className="text-lg font-semibold mb-3">UI Apps</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {apps.map(app => (
              <Card key={app.name}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">{app.displayName}</CardTitle>
                    {app.dynamic && <Badge variant="secondary">dynamic</Badge>}
                  </div>
                  <CardDescription className="text-xs">{app.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <code className="text-xs text-muted-foreground">{app.uri}</code>
                </CardContent>
              </Card>
            ))}
            {apps.length === 0 && !loading && (
              <p className="text-sm text-muted-foreground">No UI apps registered</p>
            )}
          </div>
        </section>
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
      <ThemeProvider theme="system" density="comfortable">
        <LoomDashboard bridge={bridge} />
      </ThemeProvider>
    </McpBridgeProvider>
  );
}
