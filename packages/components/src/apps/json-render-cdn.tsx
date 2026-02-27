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
import { ThemeToggle } from './ThemeToggle';
import { NLGenerator } from '../catalog/NLGenerator';
import { SurfacesRenderer } from '../catalog/renderer';
import type { Spec } from '@json-render/react';
import '../theme/tokens.css';

// Create the MCP Apps bridge instance
const bridge = new McpAppsBridge();

// Generate sample data for demo purposes
// Columns match AI system prompt expectations for better compatibility
function generateSampleData(rowCount = 50) {
  const products = ['Laptop', 'Phone', 'Tablet', 'Monitor', 'Keyboard', 'Mouse', 'Headphones', 'Camera'];
  const regions = ['North', 'South', 'East', 'West', 'Central'];
  const statuses = ['Active', 'Pending', 'Completed', 'Cancelled'];

  return Array.from({ length: rowCount }, (_, i) => ({
    id: i + 1,
    name: `Customer ${i + 1}`,
    product: products[Math.floor(Math.random() * products.length)],
    category: products[Math.floor(Math.random() * products.length)],
    value: Math.floor(Math.random() * 10000) + 100,
    amount: Math.floor(Math.random() * 10000) + 100,
    region: regions[Math.floor(Math.random() * regions.length)],
    status: statuses[Math.floor(Math.random() * statuses.length)],
    date: new Date(2024, Math.floor(Math.random() * 12), Math.floor(Math.random() * 28) + 1).toISOString().split('T')[0],
  }));
}

// Check if we're in standalone mode (no backend API available)
// Allow localhost:3457 for local Bedrock testing
const isStandalone = !window.location.pathname.includes('/mcp-apps/') &&
                     window.location.port !== '3457';

// Render the application
const root = document.getElementById('root');
if (root) {
  createRoot(root).render(
    <McpBridgeProvider bridge={bridge}>
      <ThemeProvider persistTheme density="comfortable">
        <div className="min-h-screen bg-background text-foreground">
          <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
            <div className="container mx-auto px-4 py-4 flex items-center justify-between">
              <h1 className="text-2xl font-bold">JSON Render UI Generator</h1>
              <ThemeToggle />
            </div>
          </header>
          <main className="p-4 max-w-4xl mx-auto">

          {isStandalone && (
            <div className="mb-4 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg text-sm">
              <p className="font-semibold text-yellow-800 dark:text-yellow-200 mb-1">⚠️ Standalone Mode</p>
              <p className="text-yellow-700 dark:text-yellow-300">
                This app requires a backend API at <code className="px-1 py-0.5 bg-yellow-100 dark:bg-yellow-900 rounded">/api/generate-ui</code> to generate specs.
                In production, this is provided by Claude Desktop via MCP or by a vantage-mcp backend.
              </p>
              <p className="text-yellow-700 dark:text-yellow-300 mt-2">
                For testing, use the example prompts below or manually provide JSON specs.
              </p>
            </div>
          )}

          <NLGenerator
            baseUrl={isStandalone ? undefined : window.location.origin}
            layout="horizontal"
            showRawJson={true}
            renderSpec={(spec) => (
              <SurfacesRenderer
                spec={spec as unknown as Spec}
                bridge={bridge}
                theme="system"
                density="comfortable"
                initialState={{
                  data: generateSampleData(50),
                }}
              />
            )}
            showExamples={true}
            includeExplanation={false}
          />
          </main>
        </div>
      </ThemeProvider>
    </McpBridgeProvider>
  );
}
