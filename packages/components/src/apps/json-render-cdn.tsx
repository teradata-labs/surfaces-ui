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

// Generate sample data for demo purposes
function generateSampleData(rowCount = 50) {
  const categories = ['Electronics', 'Clothing', 'Food', 'Books', 'Sports', 'Home'];
  const regions = ['North', 'South', 'East', 'West', 'Central'];
  const statuses = ['Active', 'Pending', 'Completed', 'Cancelled'];

  return Array.from({ length: rowCount }, (_, i) => ({
    id: i + 1,
    name: `Item ${i + 1}`,
    category: categories[Math.floor(Math.random() * categories.length)],
    price: Math.floor(Math.random() * 1000) + 10,
    quantity: Math.floor(Math.random() * 100) + 1,
    revenue: Math.floor(Math.random() * 10000) + 100,
    region: regions[Math.floor(Math.random() * regions.length)],
    status: statuses[Math.floor(Math.random() * statuses.length)],
    date: new Date(2024, Math.floor(Math.random() * 12), Math.floor(Math.random() * 28) + 1).toISOString().split('T')[0],
  }));
}

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
                initialState={{
                  data: generateSampleData(50),
                }}
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
