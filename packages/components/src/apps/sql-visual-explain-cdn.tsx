/**
 * SQL Visual EXPLAIN - MCP App
 *
 * Interactive Teradata EXPLAIN plan visualizer.
 * Direct React implementation (no json-render).
 */

// Script entry point
console.log('[SQL Visual EXPLAIN] ========== SCRIPT ENTRY POINT ==========');

import * as React from 'react';
import { createRoot } from 'react-dom/client';
import { McpAppsBridge } from '../bridge/McpAppsBridge';
import { McpBridgeProvider } from '../bridge/McpBridgeProvider';
import { ThemeProvider } from '../theme/ThemeProvider';
import { ChartThemeProvider } from '../theme/ChartThemeProvider';
import { ThemeToggle } from './ThemeToggle';
import { ChartThemeSelector } from './ChartThemeSelector';
import { Logo } from './Logo';
import { AlertCircle, Copy, Play } from 'lucide-react';
import { TERADATA_SAMPLE_QUERIES } from './sql-visual-explain/teradata-sample-data';
import { isSendPromptAvailable, executePromptAction, buildRunExplainPrompt } from './sql-visual-explain/send-prompt-utils';
import { WorkflowNode } from './sql-visual-explain/WorkflowNode';
import { StepAnalysisCard } from './sql-visual-explain/StepAnalysisCard';
import { SQLEditor } from './sql-visual-explain/SQLEditor';
import type { TeradataQuery } from './sql-visual-explain/teradata-types';
import { MCPDebugPanel } from './MCPDebugPanel';
import '../theme/tokens.css';

// Toggle debug panel for development
const ENABLE_DEBUG = false;

// Create the MCP Apps bridge instance
const bridge = new McpAppsBridge();
bridge.connect();

function SqlVisualExplainCDN() {
  const [queries, setQueries] = React.useState<TeradataQuery[]>([]);
  const [currentQueryIndex, setCurrentQueryIndex] = React.useState(0);
  const [activeStepIndex, setActiveStepIndex] = React.useState<number | null>(null);
  const [status, setStatus] = React.useState<'loading' | 'no-data' | 'ready'>('loading');
  const dataReceivedRef = React.useRef(false);

  const currentQuery = queries[currentQueryIndex];

  React.useEffect(() => {
    console.log('[SqlVisualExplainCDN] ===== COMPONENT MOUNTED =====');

    const handleMessage = (event: MessageEvent) => {
      console.log('[SqlVisualExplainCDN] Message received:', event.data?.method);

      // Listen for tool-input notification from Claude Desktop
      if (event.data?.method === 'ui/notifications/tool-input') {
        console.log('[SqlVisualExplainCDN] ✓ Tool-input notification received');
        dataReceivedRef.current = true;
        const args = event.data.params.arguments;

        // Parse arguments - expecting sql + explainText
        if (args.sql && args.explainText) {
          console.log('[SqlVisualExplainCDN] Received SQL and EXPLAIN text');
          // For now, just load sample data
          // TODO: Parse args.explainText using parseExplain()
          setQueries(TERADATA_SAMPLE_QUERIES);
          setStatus('ready');
        }
      }
    };

    window.addEventListener('message', handleMessage);
    console.log('[SqlVisualExplainCDN] ✓ Message listener attached');

    // Notify parent we're ready
    if (window.parent !== window) {
      console.log('[SqlVisualExplainCDN] Notifying parent: ready');
      window.parent.postMessage({ type: 'sql-visual-explain-ready' }, '*');
    }

    // Load sample data IMMEDIATELY
    console.log('[SqlVisualExplainCDN] Loading sample Teradata queries IMMEDIATELY...');
    setQueries(TERADATA_SAMPLE_QUERIES);
    setStatus('ready');
    console.log('[SqlVisualExplainCDN] ✓ Sample data loaded');

    return () => {
      console.log('[SqlVisualExplainCDN] Cleanup: removing listeners');
      window.removeEventListener('message', handleMessage);
    };
  }, []);

  // Handlers
  const handleQueryChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setCurrentQueryIndex(parseInt(e.target.value, 10));
    setActiveStepIndex(null);
  };

  const handleStepClick = (index: number) => {
    setActiveStepIndex(index);
  };

  const handleCopySQL = async () => {
    if (currentQuery) {
      try {
        await navigator.clipboard.writeText(currentQuery.sql);
      } catch (err) {
        console.error('Copy failed:', err);
      }
    }
  };

  const handleRunExplain = () => {
    if (currentQuery) {
      executePromptAction(buildRunExplainPrompt(currentQuery.sql));
    }
  };

  // Loading state
  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-border border-t-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Loading EXPLAIN plan...</p>
        </div>
      </div>
    );
  }

  // No data state
  if (status === 'no-data' || queries.length === 0) {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-6">
        <div className="text-center">
          <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h2 className="text-xl font-semibold mb-2">No EXPLAIN plan provided</h2>
          <p className="text-muted-foreground">This app visualizes Teradata EXPLAIN plans. Call the show_sql_visual_explain MCP tool with your query data.</p>
        </div>
      </div>
    );
  }

  // Ready - render UI
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">

      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Logo height={32} />
            <div className="text-sm text-muted-foreground">SQL Visual EXPLAIN</div>
          </div>
          <div className="flex items-center gap-2">
            <ChartThemeSelector />
            <ThemeToggle />
          </div>
        </div>
      </header>

      {/* TopBar - Query selector */}
      <div className="flex items-center gap-2.5 px-4 py-2.5 border-b border-border bg-card">
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-info" />
          <span className="text-sm font-medium text-foreground">Visual EXPLAIN</span>
        </div>
        <div className="w-px h-4 bg-border mx-1" />
        <select
          value={currentQueryIndex}
          onChange={handleQueryChange}
          className="text-sm px-2.5 py-1 border border-border rounded-lg bg-muted text-foreground cursor-pointer hover:border-border-strong outline-none"
        >
          {queries.map((q, idx) => (
            <option key={idx} value={idx}>
              {q.name}
            </option>
          ))}
        </select>
        <div className="ml-auto flex gap-2">
          <button
            onClick={handleCopySQL}
            className="text-xs px-3 py-1.5 border border-border bg-card rounded-lg hover:bg-muted transition-colors flex items-center gap-1.5"
          >
            <Copy className="h-3 w-3" />
            Copy SQL
          </button>
          <button
            onClick={handleRunExplain}
            className="text-xs px-3 py-1.5 border border-info bg-info-light text-info-foreground rounded-lg hover:opacity-90 transition-opacity flex items-center gap-1.5"
          >
            <Play className="h-3 w-3" />
            Run EXPLAIN
          </button>
        </div>
      </div>

      {/* Main Content */}
      <main className="flex-1 flex overflow-hidden">

        {/* Left: Workflow Column */}
        <div className="w-[210px] border-r border-border bg-muted p-3 overflow-y-auto">
          <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-3 px-0.5">
            Execution plan
          </div>
          <div className="flex flex-col items-center space-y-0">
            {currentQuery?.steps.map((step, idx) => (
              <WorkflowNode
                key={idx}
                type={step.type}
                label={step.label}
                sub={step.sub}
                active={activeStepIndex === idx}
                onClick={() => handleStepClick(idx)}
                showConnector={idx < currentQuery.steps.length - 1}
              />
            ))}
          </div>
        </div>

        {/* Right: Main Column */}
        <div className="flex-1 flex flex-col overflow-hidden">

          {/* Analysis Panel */}
          <div className="flex-1 p-4 overflow-y-auto">
            {activeStepIndex === null || !currentQuery ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-center text-muted-foreground">
                  <div className="text-3xl mb-2 opacity-40">←</div>
                  <div className="text-sm">Select a step to see analysis</div>
                </div>
              </div>
            ) : currentQuery.steps[activeStepIndex] ? (
              <StepAnalysisCard
                step={currentQuery.steps[activeStepIndex]!}
                stepIndex={activeStepIndex}
                rawExplain={currentQuery.raw}
                sql={currentQuery.sql}
                onCompareAll={() => {}}
              />
            ) : null}
          </div>

          {/* SQL Editor */}
          {currentQuery && (
            <SQLEditor
              sql={currentQuery.sql}
              rawExplain={currentQuery.raw}
              highlights={currentQuery.highlights}
              activeStepType={activeStepIndex !== null && currentQuery.steps[activeStepIndex] ? currentQuery.steps[activeStepIndex].type : undefined}
              queryCount={queries.length}
            />
          )}
        </div>
      </main>
    </div>
  );
}

// Render
const root = document.getElementById('root');
if (root) {
  console.log('[SQL Visual EXPLAIN] Starting React render...');

  createRoot(root).render(
    <>
      {ENABLE_DEBUG && <MCPDebugPanel />}
      <McpBridgeProvider bridge={bridge}>
        <ThemeProvider persistTheme density="comfortable">
          <ChartThemeProvider persistTheme>
            <SqlVisualExplainCDN />
          </ChartThemeProvider>
        </ThemeProvider>
      </McpBridgeProvider>
    </>,
  );

  console.log('[SQL Visual EXPLAIN] React render initiated successfully');
} else {
  document.body.innerHTML =
    '<div style="color:red;padding:40px">ERROR: Root element not found</div>';
}
