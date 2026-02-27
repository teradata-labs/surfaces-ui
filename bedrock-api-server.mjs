#!/usr/bin/env node

/**
 * AWS Bedrock API Server for json-render testing
 *
 * Provides /api/generate-ui endpoint that:
 * 1. Takes a natural language prompt
 * 2. Calls AWS Bedrock (Claude) to generate a UI spec
 * 3. Streams the response back to the frontend
 */

import { createServer } from 'http';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

// AWS Bedrock SDK
import {
  BedrockRuntimeClient,
  InvokeModelWithResponseStreamCommand,
} from '@aws-sdk/client-bedrock-runtime';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = 3457;

// Initialize Bedrock client (uses AWS credentials from environment/profile)
const bedrock = new BedrockRuntimeClient({ region: 'us-east-1' });

// System prompt for UI generation
const SYSTEM_PROMPT = `You are a UI specification generator. Given a natural language description, generate a JSON specification for a UI component using the SurfacesUI catalog format.

Available components:
- TableWithFilters: Filterable data table with density controls
- ChartWithControls: Chart (bar/line/pie/scatter) with axis configuration
- SQLResultsDisplay: Combined table and chart views for SQL results
- DataTable: Simple virtualized table
- Chart: Basic chart without controls
- Filter: Search filter component
- DensityToggle: Density mode toggle
- ViewModeToggle: Table/chart view toggle

Response format:
{
  "root": "elementId",
  "elements": {
    "elementId": {
      "type": "ComponentName",
      "props": { ... }
    }
  }
}

Rules:
1. Always use "root" and "elements" structure
2. Choose the most appropriate component for the request
3. Include all required props for the component
4. Use realistic column names and properties
5. Return ONLY valid JSON, no markdown or explanation

Examples:
- "Show a filterable table" → TableWithFilters
- "Display as a bar chart" → ChartWithControls
- "SQL results with table and chart" → SQLResultsDisplay`;

const apps = {
  '/': resolve(__dirname, 'packages/mcp-adapter/apps/json-render-cdn.html'),
  '/json-render': resolve(__dirname, 'packages/mcp-adapter/apps/json-render-cdn.html'),
};

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  console.log(`${new Date().toISOString()} - ${req.method} ${url.pathname}`);

  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  // API endpoint for UI generation
  if (url.pathname === '/api/generate-ui') {
    const prompt = url.searchParams.get('prompt');
    const explain = url.searchParams.get('explain') === 'true';

    if (!prompt) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Missing prompt parameter' }));
      return;
    }

    console.log(`  → Generating UI for: "${prompt.substring(0, 60)}..."`);

    try {
      // Set up streaming response
      res.writeHead(200, {
        'Content-Type': 'application/x-ndjson',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      });

      // Build messages for Claude
      const userMessage = explain
        ? `${prompt}\n\nAfter the JSON spec, provide a brief explanation of your component choice.`
        : prompt;

      // Call Bedrock
      const command = new InvokeModelWithResponseStreamCommand({
        modelId: 'us.anthropic.claude-3-5-sonnet-20241022-v2:0',
        contentType: 'application/json',
        accept: 'application/json',
        body: JSON.stringify({
          anthropic_version: 'bedrock-2023-05-31',
          max_tokens: 2000,
          system: SYSTEM_PROMPT,
          messages: [
            {
              role: 'user',
              content: userMessage,
            },
          ],
        }),
      });

      const response = await bedrock.send(command);
      let fullText = '';
      let specExtracted = false;

      // Stream chunks back to client
      for await (const event of response.body) {
        if (event.chunk?.bytes) {
          const chunk = JSON.parse(new TextDecoder().decode(event.chunk.bytes));

          if (chunk.type === 'content_block_delta' && chunk.delta?.text) {
            const text = chunk.delta.text;
            fullText += text;

            // Send chunk to frontend
            res.write(JSON.stringify({ chunk: text }) + '\n');

            // Try to extract spec when we have enough text
            if (!specExtracted && fullText.includes('}')) {
              try {
                // Extract JSON from response (handles both raw JSON and markdown)
                const jsonMatch = fullText.match(/\{[\s\S]*\}/);
                if (jsonMatch) {
                  const spec = JSON.parse(jsonMatch[0]);

                  // Validate it's a proper spec
                  if (spec.root && spec.elements) {
                    specExtracted = true;

                    // Extract explanation if present
                    const explanation = explain
                      ? fullText.split(jsonMatch[0])[1]?.trim() || null
                      : null;

                    // Send final spec
                    res.write(JSON.stringify({
                      spec,
                      explanation
                    }) + '\n');

                    console.log(`  ✅ Generated spec with root: ${spec.root}`);
                  }
                }
              } catch (e) {
                // Still accumulating...
              }
            }
          }
        }
      }

      // If we didn't extract a spec during streaming, try one final time
      if (!specExtracted) {
        try {
          const jsonMatch = fullText.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            const spec = JSON.parse(jsonMatch[0]);
            if (spec.root && spec.elements) {
              const explanation = explain
                ? fullText.split(jsonMatch[0])[1]?.trim() || null
                : null;

              res.write(JSON.stringify({ spec, explanation }) + '\n');
              console.log(`  ✅ Generated spec with root: ${spec.root}`);
            }
          }
        } catch (e) {
          console.error('  ❌ Failed to parse spec:', e.message);
          res.write(JSON.stringify({
            error: 'Failed to generate valid UI spec'
          }) + '\n');
        }
      }

      res.end();
    } catch (error) {
      console.error(`  ❌ Bedrock error:`, error.message);
      res.write(JSON.stringify({
        error: `Bedrock API error: ${error.message}`
      }) + '\n');
      res.end();
    }
    return;
  }

  // Serve HTML app
  const appPath = apps[url.pathname];
  if (appPath) {
    try {
      const html = readFileSync(appPath, 'utf-8');
      res.writeHead(200, {
        'Content-Type': 'text/html',
        'Cache-Control': 'no-cache',
      });
      res.end(html);
      console.log(`  ✅ Served ${url.pathname}`);
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'text/plain' });
      res.end(`Error: ${err.message}`);
    }
    return;
  }

  // 404
  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('Not found');
});

server.listen(PORT, () => {
  console.log(`\n🚀 SurfacesUI Bedrock API Server`);
  console.log(`   http://localhost:${PORT}\n`);
  console.log(`Ready to generate UIs with AWS Bedrock!`);
  console.log(`Using model: anthropic.claude-3-5-sonnet-20241022-v2:0\n`);
  console.log(`Test it at:`);
  console.log(`   http://localhost:${PORT}/json-render\n`);
});
