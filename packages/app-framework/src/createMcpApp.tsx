import * as React from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { McpAppsBridge, McpBridgeProvider, ThemeProvider } from '@surfacesui/components';

import type { McpAppOptions, McpAppHandle } from './types.js';

/**
 * Bootstrap a React component as an MCP App with bridge + theme wiring.
 *
 * Replaces ~50 lines of boilerplate with a single call:
 *
 * ```tsx
 * import { createMcpApp } from '@surfacesui/app-framework';
 * import { OrgChart } from './OrgChart';
 * createMcpApp(OrgChart, { name: 'Org Chart' });
 * ```
 */
export function createMcpApp(
  Component: React.ComponentType,
  options: McpAppOptions = {},
): McpAppHandle {
  const {
    rootId = 'root',
    theme: themeOpts = {},
    bridge: externalBridge,
  } = options;

  // Create or reuse bridge
  const bridge = externalBridge ?? new McpAppsBridge();

  // Find root element
  const container = document.getElementById(rootId);
  if (!container) {
    throw new Error(
      `[createMcpApp] Element #${rootId} not found. ` +
        'Ensure your HTML has <div id="root"></div>.',
    );
  }

  let root: Root | null = createRoot(container);

  root.render(
    <McpBridgeProvider bridge={bridge}>
      <ThemeProvider
        theme={themeOpts.mode ?? 'system'}
        persistTheme={themeOpts.persistTheme ?? false}
        density={themeOpts.density}
        tokenOverrides={themeOpts.tokenOverrides}
      >
        <Component />
      </ThemeProvider>
    </McpBridgeProvider>,
  );

  return {
    unmount() {
      if (root) {
        root.unmount();
        root = null;
      }
      if (!externalBridge) {
        bridge.disconnect();
      }
    },
  };
}
