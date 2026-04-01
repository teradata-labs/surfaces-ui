/**
 * SQL Visual EXPLAIN - MCP App
 *
 * Interactive Teradata EXPLAIN plan visualizer using ReactFlow canvas.
 * Shows execution plan as a visual flow diagram with detailed node panel.
 */

import * as React from 'react';
import { createRoot } from 'react-dom/client';
import { ReactFlow, ReactFlowProvider, Background, Controls, useReactFlow, type NodeTypes, type Node } from '@xyflow/react';
import { McpAppsBridge } from '../bridge/McpAppsBridge';
import { McpBridgeProvider } from '../bridge/McpBridgeProvider';
import { ThemeProvider } from '../theme/ThemeProvider';
import { ChartThemeProvider } from '../theme/ChartThemeProvider';
import { Button } from '../primitives/button';
import { EmptyState } from '../molecules/empty-state/EmptyState';
import { AlertCircle, Copy, Play, Network } from 'lucide-react';
import { TERADATA_SAMPLE_QUERIES } from './sql-visual-explain/teradata-sample-data';
import { executePromptAction, buildRunExplainPrompt } from './sql-visual-explain/send-prompt-utils';
import { ExplainPlanNode } from './sql-visual-explain/ExplainPlanNode';
import { NodeDetailPanel } from './sql-visual-explain/NodeDetailPanel';
import { SQLEditor } from './sql-visual-explain/SQLEditor';
import { AppHeader } from './sql-visual-explain/AppHeader';
import { teradataStepsToExplainNode } from './sql-visual-explain/teradata-to-flow';
import { planToNodes, planToEdges } from './sql-visual-explain/plan-to-flow';
import { classifyCost, findMaxCost } from './sql-visual-explain/cost-utils';
import type { TeradataQuery } from './sql-visual-explain/teradata-types';
import '@xyflow/react/dist/style.css';
import '../theme/tokens.css';

// Create the MCP Apps bridge instance
const bridge = new McpAppsBridge();
bridge.connect();

// ReactFlow node types - temporarily use default for testing
const nodeTypes: NodeTypes = {
  explainPlanNode: ExplainPlanNode,
};

function FlowVisualization({ query }: { query: TeradataQuery }) {
  const [selectedNodeId, setSelectedNodeId] = React.useState<string | null>(null);

  // Convert Teradata steps to ExplainNode tree
  const explainTree = React.useMemo(() => {
    return teradataStepsToExplainNode(query.steps, query.name);
  }, [query]);

  // Convert to ReactFlow nodes and edges - POSITION THEM HERE
  const { nodes, edges } = React.useMemo(() => {
    const flowNodes = planToNodes(explainTree);
    const flowEdges = planToEdges(explainTree);

    // Position nodes directly in useMemo (top-to-bottom layout)
    // Nodes are 260px wide with 3 metrics rows (~120px tall total)
    const positionedNodes = flowNodes.map((node, idx) => ({
      ...node,
      position: {
        x: 30,
        y: 10 + (idx * 140), // 140px spacing to account for increased padding
      },
      draggable: true, // Enable dragging per node
    }));

    // Make edges dashed and animated with neutral color
    const styledEdges = flowEdges.map(edge => ({
      ...edge,
      animated: true,
      style: {
        stroke: 'hsl(var(--muted-foreground))',
        strokeWidth: 1.5,
        strokeDasharray: '5,5',
      },
    }));

    console.log('[FlowVisualization] Created', positionedNodes.length, 'positioned nodes');
    console.log('[FlowVisualization] Created', styledEdges.length, 'styled edges');

    return { nodes: positionedNodes, edges: styledEdges };
  }, [explainTree]);

  // Fit view to show all nodes on mount
  const { fitView } = useReactFlow();

  React.useEffect(() => {
    if (nodes.length > 0) {
      // Delay to ensure nodes are rendered before fitting
      setTimeout(() => {
        fitView({ padding: 0.2, duration: 300 });
      }, 100);
    }
  }, [nodes.length, fitView]);

  // Get selected node data
  const selectedNode = React.useMemo(() => {
    if (!selectedNodeId) return null;
    const node = nodes.find((n) => n.id === selectedNodeId);
    return node?.data.explainNode || null;
  }, [selectedNodeId, nodes]);

  const selectedCostLevel = React.useMemo(() => {
    if (!selectedNode) return null;
    const maxCost = findMaxCost(explainTree);
    return classifyCost(selectedNode, maxCost);
  }, [selectedNode, explainTree]);

  const handleNodeClick = React.useCallback((_event: React.MouseEvent, node: Node) => {
    setSelectedNodeId(node.id);
  }, []);

  const handlePaneClick = React.useCallback(() => {
    setSelectedNodeId(null);
  }, []);

  return (
    <div className="flex-1 flex overflow-hidden">
      {/* ReactFlow Canvas - fixed 550px height for styled nodes with padding */}
      <div style={{ width: '100%', height: '550px' }}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          onNodeClick={handleNodeClick}
          onPaneClick={handlePaneClick}
          minZoom={0.3}
          maxZoom={1.5}
          panOnDrag={true} // Enable panning - ReactFlow handles node drag vs pane pan automatically
          zoomOnScroll={true}
          nodesDraggable={true}
          elementsSelectable={true}
          selectNodesOnDrag={false} // Don't select nodes while dragging for better UX
          proOptions={{ hideAttribution: true }}
          defaultEdgeOptions={{
            type: 'smoothstep',
          }}
        >
          <Background />
          <Controls />
        </ReactFlow>

        {/* Empty state if no nodes */}
        {nodes.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <EmptyState
              icon={<Network />}
              title="No execution plan"
              description="Load a query to see the visual EXPLAIN plan"
            />
          </div>
        )}
      </div>

      {/* Detail Panel */}
      {selectedNode && selectedCostLevel && (
        <NodeDetailPanel
          node={selectedNode}
          costLevel={selectedCostLevel}
          onClose={() => setSelectedNodeId(null)}
        />
      )}
    </div>
  );
}

function SqlVisualExplainCDN() {
  const [queries, setQueries] = React.useState<TeradataQuery[]>([]);
  const [currentQueryIndex, setCurrentQueryIndex] = React.useState(0);
  const [status, setStatus] = React.useState<'loading' | 'no-data' | 'ready'>('loading');
  const dataReceivedRef = React.useRef(false);

  // Panel visibility state with localStorage persistence
  const [showSQLEditor, setShowSQLEditor] = React.useState(() => {
    try {
      const saved = localStorage.getItem('sql-visual-explain:showSQLEditor');
      return saved !== null ? JSON.parse(saved) : false; // Default to hidden for more canvas space
    } catch {
      return false;
    }
  });

  const currentQuery = queries[currentQueryIndex];

  // Save panel visibility to localStorage
  React.useEffect(() => {
    localStorage.setItem('sql-visual-explain:showSQLEditor', JSON.stringify(showSQLEditor));
  }, [showSQLEditor]);

  // MCP message handling and data loading
  React.useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      // Listen for tool-input notification from Claude Desktop
      if (event.data?.method === 'ui/notifications/tool-input') {
        dataReceivedRef.current = true;
        const args = event.data.params.arguments;

        // Parse arguments - expecting sql + explainText
        if (args.sql && args.explainText) {
          // TODO: Parse args.explainText using parseExplain()
          setQueries(TERADATA_SAMPLE_QUERIES);
          setStatus('ready');
        }
      }
    };

    window.addEventListener('message', handleMessage);

    // Notify parent we're ready
    if (window.parent !== window) {
      window.parent.postMessage({ type: 'sql-visual-explain-ready' }, '*');
    }

    // Load sample data IMMEDIATELY
    setQueries(TERADATA_SAMPLE_QUERIES);
    setStatus('ready');

    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, []);

  // Handlers
  const handleQueryChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setCurrentQueryIndex(parseInt(e.target.value, 10));
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
    <ReactFlowProvider>
      <div className="min-h-screen bg-background text-foreground flex flex-col">

      {/* Header with Layout Menu */}
      <AppHeader
        onToggleSQLEditor={() => setShowSQLEditor(!showSQLEditor)}
        showSQLEditor={showSQLEditor}
      />

      {/* TopBar - Query selector and actions */}
      <div className="flex items-center gap-2.5 px-4 py-2.5 border-b border-border bg-card">
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-info" />
          <span className="text-sm font-medium text-foreground">Visual EXPLAIN</span>
        </div>

        <div className="w-px h-4 bg-border mx-1" />

        {/* Query selector */}
        <select
          value={currentQueryIndex}
          onChange={handleQueryChange}
          className="text-sm px-2.5 py-1 border border-border rounded-lg bg-muted text-foreground cursor-pointer hover:border-border-strong outline-none focus:ring-2 focus:ring-ring focus:border-transparent"
        >
          {queries.map((q, idx) => (
            <option key={idx} value={idx}>
              {q.name}
            </option>
          ))}
        </select>

        {/* Action buttons */}
        <div className="ml-auto flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleCopySQL}
          >
            <Copy className="h-3 w-3" />
            <span className="ml-1.5">Copy SQL</span>
          </Button>

          <Button
            variant="tonal"
            size="sm"
            onClick={handleRunExplain}
          >
            <Play className="h-3 w-3" />
            <span className="ml-1.5">Run EXPLAIN</span>
          </Button>
        </div>
      </div>

      {/* Main Content - ReactFlow Canvas */}
      <main className="flex-1 flex flex-col overflow-hidden" style={{ minHeight: 0 }}>
        {/* Canvas takes all available space */}
        <div className="flex-1 overflow-hidden" style={{ minHeight: 0 }}>
          {currentQuery && <FlowVisualization query={currentQuery} />}
        </div>

        {/* SQL Editor - Conditional, fixed height */}
        {showSQLEditor && currentQuery && (
          <div className="flex-shrink-0">
            <SQLEditor
              sql={currentQuery.sql}
              rawExplain={currentQuery.raw}
              highlights={currentQuery.highlights}
              activeStepType={undefined} // Not used in canvas view
              queryCount={queries.length}
            />
          </div>
        )}
      </main>
    </div>
    </ReactFlowProvider>
  );
}

// Render
const root = document.getElementById('root');
if (root) {
  createRoot(root).render(
    <McpBridgeProvider bridge={bridge}>
      <ThemeProvider persistTheme density="comfortable">
        <ChartThemeProvider persistTheme>
          <SqlVisualExplainCDN />
        </ChartThemeProvider>
      </ThemeProvider>
    </McpBridgeProvider>,
  );
} else {
  document.body.innerHTML =
    '<div style="color:red;padding:40px">ERROR: Root element not found</div>';
}
