/**
 * FlowEditor — Palette + Canvas workflow editor
 *
 * Combines NodePalette with FlowCanvas in a sidebar + canvas layout.
 * Manages internal node/edge state. Generic equivalent of AIMLWorkflowEditor
 * without domain-specific logic.
 *
 * Level: Organism (~180 lines)
 */

import * as React from 'react';
import {
  useNodesState,
  useEdgesState,
  addEdge,
  MarkerType,
} from '@xyflow/react';
import type { Node, Edge, Connection } from '@xyflow/react';
import { cn } from '../../lib/utils';
import { FlowCanvas } from '../flow-canvas';
import { FlowNode } from '../../primitives/flow-node';
import { NodePalette } from '../../molecules/node-palette';
import type { PaletteCategory, PaletteItem } from '../../molecules/node-palette';

// ── Default node type using FlowNode ──────────────────────────────────────

function DefaultFlowNode({ data }: { data: Record<string, unknown> }) {
  return (
    <FlowNode
      icon={data.icon as React.ReactNode}
      label={data.label as string}
      description={data.description as string}
      variant={(data.variant as any) || 'default'}
      status={data.status as React.ReactNode}
    />
  );
}

const DEFAULT_NODE_TYPES = {
  flowNode: DefaultFlowNode,
};

// ── FlowEditor ────────────────────────────────────────────────────────────

export interface FlowEditorProps {
  /** Node palette categories */
  categories: PaletteCategory[];
  /** Palette header title */
  paletteTitle?: string;
  /** Palette header description */
  paletteDescription?: string;
  /** Initial nodes */
  initialNodes?: Node[];
  /** Initial edges */
  initialEdges?: Edge[];
  /** Custom node type components (merged with defaults) */
  nodeTypes?: Record<string, React.ComponentType<any>>;
  /** Called when a palette item generates a new node */
  onNodeAdd?: (item: PaletteItem, node: Node) => void;
  /** Called when a node is clicked */
  onNodeClick?: (event: React.MouseEvent, node: Node) => void;
  /** Called when nodes or edges change */
  onWorkflowChange?: (nodes: Node[], edges: Edge[]) => void;
  /** Footer content for the palette panel */
  footer?: React.ReactNode;
  className?: string;
}

const FlowEditor = React.forwardRef<HTMLDivElement, FlowEditorProps>(
  (
    {
      categories,
      paletteTitle,
      paletteDescription,
      initialNodes = [],
      initialEdges = [],
      nodeTypes,
      onNodeAdd,
      onNodeClick,
      onWorkflowChange,
      footer,
      className,
    },
    ref,
  ) => {
    const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
    const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

    // Merge node types
    const mergedNodeTypes = React.useMemo(
      () => ({ ...DEFAULT_NODE_TYPES, ...nodeTypes }),
      [nodeTypes],
    );

    // Notify parent of changes
    React.useEffect(() => {
      onWorkflowChange?.(nodes, edges);
    }, [nodes, edges, onWorkflowChange]);

    // Handle new connection
    const handleConnect = React.useCallback(
      (params: Connection) => {
        setEdges((eds) =>
          addEdge(
            {
              ...params,
              type: 'smoothstep',
              animated: true,
              style: { stroke: 'hsl(var(--muted-foreground))', strokeWidth: 2 },
              markerEnd: {
                type: MarkerType.ArrowClosed,
                color: 'hsl(var(--muted-foreground))',
              },
            },
            eds,
          ),
        );
      },
      [setEdges],
    );

    // Handle palette item click — add a new node
    const handleItemClick = React.useCallback(
      (item: PaletteItem) => {
        const newNode: Node = {
          id: `${item.id}-${Date.now()}`,
          type: 'flowNode',
          position: {
            x: Math.random() * 400 + 50,
            y: Math.random() * 300 + 50,
          },
          data: {
            label: item.label,
            description: item.description || '',
            icon: item.icon,
            variant: item.variant || 'default',
          },
        };

        setNodes((nds) => [...nds, newNode]);
        onNodeAdd?.(item, newNode);
      },
      [setNodes, onNodeAdd],
    );

    return (
      <div ref={ref} className={cn('h-full flex', className)}>
        {/* Palette Sidebar */}
        <NodePalette
          title={paletteTitle}
          description={paletteDescription}
          categories={categories}
          onItemClick={handleItemClick}
          footer={footer}
        />

        {/* Canvas */}
        <div className="flex-1 min-w-0">
          <FlowCanvas
            nodes={nodes}
            edges={edges}
            nodeTypes={mergedNodeTypes}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={handleConnect}
            onNodeClick={onNodeClick}
            interactive
          />
        </div>
      </div>
    );
  },
);
FlowEditor.displayName = 'FlowEditor';

export { FlowEditor };
