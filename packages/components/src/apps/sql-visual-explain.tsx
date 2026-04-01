/**
 * SQL Visual Explain — Interactive query plan visualization
 *
 * Standalone demo app that renders a PostgreSQL EXPLAIN ANALYZE plan
 * as a top-to-bottom flow diagram. Click any node to see details
 * in an inline right panel.
 *
 * DEV-ONLY: Access at http://localhost:5180/src/apps/sql-visual-explain.html
 */

import * as React from 'react';
import { createRoot } from 'react-dom/client';
import type { Node } from '@xyflow/react';
import { ThemeWrapper } from './ThemeWrapper';
import { FlowCanvas } from '../organisms/flow-canvas';
import { Badge } from '../primitives/badge';
import { useAutoLayout } from '../hooks/use-auto-layout';
import { ExplainPlanNode } from './sql-visual-explain/ExplainPlanNode';
import { NodeDetailPanel } from './sql-visual-explain/NodeDetailPanel';
import { planToNodes, planToEdges } from './sql-visual-explain/plan-to-flow';
import type { ExplainNodeData } from './sql-visual-explain/plan-to-flow';
import type { ExplainNode } from './sql-visual-explain/types';
import type { CostLevel } from './sql-visual-explain/types';
import { SAMPLE_SQL, SAMPLE_PLAN } from './sql-visual-explain/sample-data';
import '../theme/tokens.css';

// ── Node type registry ────────────────────────────────────────────────────

const nodeTypes = { explainPlanNode: ExplainPlanNode };

// ── App ───────────────────────────────────────────────────────────────────

function SqlVisualExplainApp() {
  return (
    <ThemeWrapper
      title="SQL Visual Explain"
      description="Interactive query plan visualization"
      showDemoNav={true}
      currentDemo="sql-visual-explain"
    >
      <SqlVisualExplainContent />
    </ThemeWrapper>
  );
}

function SqlVisualExplainContent() {
  const [selectedNode, setSelectedNode] = React.useState<ExplainNode | null>(null);
  const [selectedCostLevel, setSelectedCostLevel] = React.useState<CostLevel>('low');
  const [showQuery, setShowQuery] = React.useState(true);

  // Convert plan tree → ReactFlow elements
  const rawNodes = React.useMemo(() => planToNodes(SAMPLE_PLAN), []);
  const rawEdges = React.useMemo(() => planToEdges(SAMPLE_PLAN), []);

  // Auto-layout TB direction
  const { nodes, edges } = useAutoLayout(rawNodes, rawEdges, {
    direction: 'TB',
    nodeWidth: 280,
    nodeHeight: 140,
    nodeSpacing: 60,
    rankSpacing: 100,
  });

  // Handle node click → open detail panel
  const handleNodeClick = React.useCallback(
    (_event: React.MouseEvent, node: Node) => {
      const data = node.data as ExplainNodeData;
      setSelectedNode(data.explainNode);
      setSelectedCostLevel(data.costLevel);
    },
    [],
  );

  const handleCloseDetail = React.useCallback(() => {
    setSelectedNode(null);
  }, []);

  return (
    <div className="-mx-4 -mt-8 flex flex-col" style={{ height: 'calc(100vh - 64px)' }}>
      {/* SQL Query Bar */}
      <div className="px-4 py-3 border-b border-su-outline-variant bg-surface-container/30">
        <div className="flex items-center gap-2 mb-1">
          <Badge variant="outline" className="text-xs font-mono">
            SQL
          </Badge>
          <span className="text-xs text-muted-foreground flex-1">
            Sample EXPLAIN ANALYZE Query
          </span>
          <button
            onClick={() => setShowQuery(!showQuery)}
            className="text-xs text-primary hover:text-primary/80 transition-colors"
          >
            {showQuery ? 'Hide' : 'Show'} Query
          </button>
        </div>
        {showQuery && (
          <pre className="text-xs font-mono text-foreground bg-muted/30 rounded-lg p-3 overflow-x-auto max-h-28 leading-relaxed">
            {SAMPLE_SQL}
          </pre>
        )}
      </div>

      {/* Canvas + Detail Panel */}
      <div className="flex-1 min-h-0 flex">
        {/* Flow Canvas */}
        <div className="flex-1 min-w-0">
          <FlowCanvas
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            onNodeClick={handleNodeClick}
            interactive={false}
            fitView
            showControls
            showBackground
            showMiniMap={false}
            defaultEdgeOptions={{
              type: 'smoothstep',
              animated: false,
            }}
          />
        </div>

        {/* Inline Detail Panel */}
        {selectedNode && (
          <NodeDetailPanel
            node={selectedNode}
            costLevel={selectedCostLevel}
            onClose={handleCloseDetail}
          />
        )}
      </div>
    </div>
  );
}

// ── Mount ──────────────────────────────────────────────────────────────────

const root = document.getElementById('root');
if (root) {
  createRoot(root).render(<SqlVisualExplainApp />);
}
