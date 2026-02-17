/**
 * JSON Render MCP App
 *
 * Single-file HTML bundle with natural language UI generation.
 * Works in Claude Desktop's sandboxed MCP Apps environment.
 */

import * as React from 'react';
import { createRoot } from 'react-dom/client';
import { McpAppsBridge } from '../bridge/McpAppsBridge';
import { McpBridgeProvider } from '../bridge/McpBridgeProvider';
import { ThemeProvider } from '../theme/ThemeProvider';
import { NLGenerator } from '../catalog/NLGenerator';
import { SurfacesRenderer } from '../catalog/renderer';
import '../theme/tokens.css';

// Create the MCP Apps bridge instance
const bridge = new McpAppsBridge();

// Render the application
const root = document.getElementById('root');
if (root) {
  createRoot(root).render(
    <McpBridgeProvider bridge={bridge}>
      <ThemeProvider theme="system" density="comfortable">
        <div className="p-4 max-w-4xl mx-auto">
          <h1 className="text-2xl font-bold mb-4">JSON Render UI Generator</h1>
          <NLGenerator
            baseUrl={window.location.origin}
            renderSpec={(spec) => (
              <SurfacesRenderer
                spec={spec}
                bridge={bridge}
                theme="system"
                density="comfortable"
              />
            )}
            showExamples={true}
            includeExplanation={false}
          />
        </div>
      </ThemeProvider>
    </McpBridgeProvider>
  );
}
