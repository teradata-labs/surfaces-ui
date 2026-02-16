/**
 * SurfacesRenderer - Main entry point for rendering JSON specs
 *
 * Wraps json-render Renderer with ThemeProvider, StateProvider, and ActionProvider
 * to provide complete theming and state management context.
 */
import React from 'react';
import {
  Renderer,
  StateProvider,
  ActionProvider,
  type Spec,
} from '@json-render/react';

import { ThemeProvider, type ThemeMode } from '../theme/ThemeProvider';
import { registry } from './registry';

/* ── Types ─────────────────────────────────────────────────────────── */

export interface SurfacesRendererProps {
  /** The JSON spec to render */
  spec: Spec | null;
  /** Optional initial state for StateProvider */
  initialState?: Record<string, unknown>;
  /** Action handlers for ActionProvider */
  handlers?: Record<
    string,
    (params: Record<string, unknown>) => Promise<unknown> | unknown
  >;
  /** Theme mode (defaults to 'system') */
  theme?: ThemeMode;
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
  initialState = {},
  handlers = {},
  theme = 'system',
  tokenOverrides,
  loading = false,
  onStateChange,
}: SurfacesRendererProps) {
  return (
    <ThemeProvider theme={theme} tokenOverrides={tokenOverrides}>
      <StateProvider initialState={initialState} onStateChange={onStateChange}>
        <ActionProvider handlers={handlers}>
          <Renderer spec={spec} registry={registry} loading={loading} />
        </ActionProvider>
      </StateProvider>
    </ThemeProvider>
  );
}
