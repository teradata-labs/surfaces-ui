/**
 * SurfacesRenderer - Main entry point for rendering JSON specs
 *
 * Wraps json-render Renderer with all required providers:
 * - ThemeProvider: Theme mode and CSS token management
 * - McpBridgeProvider: MCP Bridge context (when bridge prop provided)
 * - StateProvider: State management for json-render
 * - ActionProvider: Action handlers for interactive components
 * - VisibilityProvider: Visibility context for conditional rendering
 */
import React, { useMemo } from 'react';
import {
  Renderer,
  StateProvider,
  ActionProvider,
  VisibilityProvider,
  type Spec,
} from '@json-render/react';

import { ThemeProvider, type ThemeMode, type DensityMode } from '../theme/ThemeProvider';
import { McpBridgeProvider, type BridgeLike } from '../bridge';
import { registry } from './registry';
import { createMcpActionHandlers } from './actions';

/* ── Types ─────────────────────────────────────────────────────────── */

export interface SurfacesRendererProps {
  /** The JSON spec to render */
  spec: Spec | null;
  /** Optional MCP Bridge instance for tool calls (enables execute_sql, etc.) */
  bridge?: BridgeLike;
  /** Optional initial state for StateProvider */
  initialState?: Record<string, unknown>;
  /** Additional action handlers (merged with MCP handlers when bridge provided) */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  handlers?: Record<string, (...args: any[]) => Promise<unknown> | unknown>;
  /** Theme mode (defaults to 'system') */
  theme?: ThemeMode;
  /** Density mode (defaults to 'comfortable') */
  density?: DensityMode;
  /** CSS custom property overrides */
  tokenOverrides?: Record<string, string>;
  /** Whether the spec is currently streaming/loading */
  loading?: boolean;
  /** Callback fired when state changes */
  onStateChange?: (path: string, value: unknown) => void;
}

/* ── Component ─────────────────────────────────────────────────────── */

export function SurfacesRenderer({
  spec,
  bridge,
  initialState = {},
  handlers = {},
  theme = 'system',
  density = 'comfortable',
  tokenOverrides,
  loading = false,
  onStateChange,
}: SurfacesRendererProps) {
  // Create merged action handlers: MCP handlers + user handlers
  // MCP handlers take precedence for built-in actions (execute_sql, export_csv, copy_json)
  // User handlers can override or add additional actions
  const mergedHandlers = useMemo(() => {
    if (!bridge) {
      // No bridge - just use user-provided handlers
      return handlers;
    }

    // Bridge provided - create MCP handlers and merge
    const mcpHandlers = createMcpActionHandlers(bridge);
    return {
      ...handlers,        // User handlers as base
      ...mcpHandlers,     // MCP handlers override (execute_sql, export_csv, copy_json)
    };
  }, [bridge, handlers]);

  // Core renderer content (without McpBridgeProvider)
  const rendererContent = (
    <StateProvider initialState={initialState} onStateChange={onStateChange}>
      <ActionProvider handlers={mergedHandlers}>
        <VisibilityProvider>
          <Renderer spec={spec} registry={registry} loading={loading} />
        </VisibilityProvider>
      </ActionProvider>
    </StateProvider>
  );

  // Wrap with McpBridgeProvider when bridge is provided
  // This enables useMcpBridge() hook in registry components if needed
  const contentWithBridge = bridge ? (
    <McpBridgeProvider bridge={bridge}>
      {rendererContent}
    </McpBridgeProvider>
  ) : (
    rendererContent
  );

  return (
    <ThemeProvider theme={theme} density={density} tokenOverrides={tokenOverrides}>
      {contentWithBridge}
    </ThemeProvider>
  );
}
