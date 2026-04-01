/**
 * FlowCanvas — Themed ReactFlow canvas wrapper
 *
 * Provides a consistent ReactFlow canvas with SurfacesUI theming.
 * Supports interactive (editable) and read-only modes.
 *
 * Level: Organism (~150 lines)
 */

import * as React from 'react';
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  MiniMap,
} from '@xyflow/react';
import type {
  Node,
  Edge,
  OnNodesChange,
  OnEdgesChange,
  OnConnect,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { cn } from '../../lib/utils';

export interface FlowCanvasProps {
  /** Array of ReactFlow nodes */
  nodes: Node[];
  /** Array of ReactFlow edges */
  edges: Edge[];
  /** Map of node type names to React components */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  nodeTypes: Record<string, React.ComponentType<any>>;
  /** Node change handler (drag, select, remove) */
  onNodesChange?: OnNodesChange;
  /** Edge change handler */
  onEdgesChange?: OnEdgesChange;
  /** New connection handler */
  onConnect?: OnConnect;
  /** Node click handler */
  onNodeClick?: (event: React.MouseEvent, node: Node) => void;
  /** Auto-fit view on mount */
  fitView?: boolean;
  /** Enable node dragging and edge creation (default: true) */
  interactive?: boolean;
  /** Show zoom/fit controls (default: true) */
  showControls?: boolean;
  /** Show dot grid background (default: true) */
  showBackground?: boolean;
  /** Show minimap overview (default: false) */
  showMiniMap?: boolean;
  /** Default edge options */
  defaultEdgeOptions?: Record<string, unknown>;
  /** Min zoom level */
  minZoom?: number;
  /** Max zoom level */
  maxZoom?: number;
  className?: string;
  children?: React.ReactNode;
}

const FlowCanvas = React.forwardRef<HTMLDivElement, FlowCanvasProps>(
  (
    {
      nodes,
      edges,
      nodeTypes,
      onNodesChange,
      onEdgesChange,
      onConnect,
      onNodeClick,
      fitView = true,
      interactive = true,
      showControls = true,
      showBackground = true,
      showMiniMap = false,
      defaultEdgeOptions,
      minZoom = 0.5,
      maxZoom = 1.5,
      className,
      children,
    },
    ref,
  ) => {
    return (
      <div ref={ref} className={cn('h-full bg-background', className)}>
        {/* Theme overrides for ReactFlow controls (hardcoded light-mode defaults) */}
        <style>{`
          .react-flow__controls {
            box-shadow: 0 0 2px 1px hsl(var(--muted-foreground) / 0.15);
            border-radius: 8px;
            overflow: hidden;
            border: 1px solid var(--color-su-outline-variant);
          }
          .react-flow__controls-button {
            background: hsl(var(--surface-container));
            border-bottom: 1px solid var(--color-su-outline-variant);
            fill: hsl(var(--foreground));
            color: hsl(var(--foreground));
            width: 28px;
            height: 28px;
          }
          .react-flow__controls-button:hover {
            background: hsl(var(--surface-container-high));
          }
          .react-flow__controls-button:last-child {
            border-bottom: none;
          }
          .react-flow__controls-button svg {
            fill: hsl(var(--foreground));
          }
        `}</style>
        <ReactFlowProvider>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={onNodeClick}
            fitView={fitView}
            minZoom={minZoom}
            maxZoom={maxZoom}
            nodesDraggable={interactive}
            nodesConnectable={interactive}
            elementsSelectable={interactive}
            defaultEdgeOptions={defaultEdgeOptions}
            proOptions={{ hideAttribution: true }}
          >
            {showBackground && (
              <Background
                gap={16}
                size={1}
                color="hsl(var(--muted-foreground))"
                style={{ opacity: 0.15 }}
              />
            )}
            {showControls && (
              <Controls showInteractive={false} />
            )}
            {showMiniMap && (
              <MiniMap
                nodeStrokeColor="hsl(var(--foreground))"
                nodeColor="hsl(var(--surface-container))"
                maskColor="hsl(var(--background))"
              />
            )}
            {children}
          </ReactFlow>
        </ReactFlowProvider>
      </div>
    );
  },
);
FlowCanvas.displayName = 'FlowCanvas';

export { FlowCanvas };
