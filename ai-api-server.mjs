#!/usr/bin/env node

/**
 * Multi-Provider AI API Server for json-render testing
 *
 * Supports:
 * - AWS Bedrock (Claude via Bedrock)
 * - Anthropic API (Direct Claude API)
 * - OpenAI API (GPT-4)
 * - Google Gemini API
 *
 * Configure via .env file or environment variables
 */

import { createServer } from 'http';
import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3457;
const AI_PROVIDER = process.env.AI_PROVIDER || 'bedrock';

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

// ============================================================================
// Provider Implementations
// ============================================================================

/**
 * AWS Bedrock Provider
 */
async function callBedrock(prompt, explain) {
  const { BedrockRuntimeClient, InvokeModelWithResponseStreamCommand } = await import('@aws-sdk/client-bedrock-runtime');

  const client = new BedrockRuntimeClient({
    region: process.env.AWS_REGION || 'us-east-1'
  });

  const model = process.env.BEDROCK_MODEL || 'us.anthropic.claude-3-5-sonnet-20241022-v2:0';

  const userMessage = explain
    ? `${prompt}\n\nAfter the JSON spec, provide a brief explanation of your component choice.`
    : prompt;

  const command = new InvokeModelWithResponseStreamCommand({
    modelId: model,
    contentType: 'application/json',
    accept: 'application/json',
    body: JSON.stringify({
      anthropic_version: 'bedrock-2023-05-31',
      max_tokens: 2000,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userMessage }],
    }),
  });

  const response = await client.send(command);
  let fullText = '';

  return {
    stream: async function* () {
      for await (const event of response.body) {
        if (event.chunk?.bytes) {
          const chunk = JSON.parse(new TextDecoder().decode(event.chunk.bytes));
          if (chunk.type === 'content_block_delta' && chunk.delta?.text) {
            const text = chunk.delta.text;
            fullText += text;
            yield { chunk: text, fullText };
          }
        }
      }
    }
  };
}

/**
 * Anthropic API Provider
 */
async function callAnthropic(prompt, explain) {
  const Anthropic = (await import('@anthropic-ai/sdk')).default;

  const client = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
  });

  const model = process.env.ANTHROPIC_MODEL || 'claude-3-5-sonnet-20241022';

  const userMessage = explain
    ? `${prompt}\n\nAfter the JSON spec, provide a brief explanation of your component choice.`
    : prompt;

  const stream = await client.messages.stream({
    model,
    max_tokens: 2000,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: userMessage }],
  });

  let fullText = '';

  return {
    stream: async function* () {
      for await (const event of stream) {
        if (event.type === 'content_block_delta' && event.delta?.text) {
          const text = event.delta.text;
          fullText += text;
          yield { chunk: text, fullText };
        }
      }
    }
  };
}

/**
 * OpenAI API Provider
 */
async function callOpenAI(prompt, explain) {
  const OpenAI = (await import('openai')).default;

  const client = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });

  const model = process.env.OPENAI_MODEL || 'gpt-4o';

  const userMessage = explain
    ? `${prompt}\n\nAfter the JSON spec, provide a brief explanation of your component choice.`
    : prompt;

  const stream = await client.chat.completions.create({
    model,
    max_tokens: 2000,
    stream: true,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: userMessage }
    ],
  });

  let fullText = '';

  return {
    stream: async function* () {
      for await (const chunk of stream) {
        const text = chunk.choices[0]?.delta?.content || '';
        if (text) {
          fullText += text;
          yield { chunk: text, fullText };
        }
      }
    }
  };
}

/**
 * Google Gemini API Provider
 */
async function callGemini(prompt, explain) {
  const { GoogleGenerativeAI } = await import('@google/generative-ai');

  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  const model = genAI.getGenerativeModel({
    model: process.env.GEMINI_MODEL || 'gemini-2.0-flash-exp'
  });

  const userMessage = explain
    ? `${SYSTEM_PROMPT}\n\nUser request: ${prompt}\n\nAfter the JSON spec, provide a brief explanation of your component choice.`
    : `${SYSTEM_PROMPT}\n\nUser request: ${prompt}`;

  const result = await model.generateContentStream(userMessage);
  let fullText = '';

  return {
    stream: async function* () {
      for await (const chunk of result.stream) {
        const text = chunk.text();
        if (text) {
          fullText += text;
          yield { chunk: text, fullText };
        }
      }
    }
  };
}

/**
 * Get the appropriate AI provider function
 */
function getProvider() {
  switch (AI_PROVIDER.toLowerCase()) {
    case 'bedrock':
      return { name: 'AWS Bedrock', fn: callBedrock };
    case 'anthropic':
      return { name: 'Anthropic API', fn: callAnthropic };
    case 'openai':
      return { name: 'OpenAI API', fn: callOpenAI };
    case 'gemini':
      return { name: 'Google Gemini', fn: callGemini };
    default:
      throw new Error(`Unknown AI provider: ${AI_PROVIDER}`);
  }
}

// ============================================================================
// HTTP Server
// ============================================================================

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
    console.log(`  → Using provider: ${getProvider().name}`);

    try {
      // Set up streaming response
      res.writeHead(200, {
        'Content-Type': 'application/x-ndjson',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      });

      const provider = getProvider();
      const { stream } = await provider.fn(prompt, explain);

      let specExtracted = false;

      // Stream chunks back to client
      for await (const { chunk, fullText } of stream()) {
        // Send chunk to frontend
        res.write(JSON.stringify({ chunk }) + '\n');

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
                res.write(JSON.stringify({ spec, explanation }) + '\n');
                console.log(`  ✅ Generated spec with root: ${spec.root}`);
              }
            }
          } catch (e) {
            // Still accumulating...
          }
        }
      }

      // If we didn't extract a spec during streaming, try one final time
      if (!specExtracted) {
        const fullText = await getFullText(stream);
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
          res.write(JSON.stringify({ error: 'Failed to generate valid UI spec' }) + '\n');
        }
      }

      res.end();
    } catch (error) {
      console.error(`  ❌ Provider error:`, error.message);
      res.write(JSON.stringify({ error: `AI provider error: ${error.message}` }) + '\n');
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

// ============================================================================
// Startup
// ============================================================================

server.listen(PORT, () => {
  console.log(`\n🚀 SurfacesUI Multi-Provider AI Server`);
  console.log(`   http://localhost:${PORT}\n`);

  try {
    const provider = getProvider();
    console.log(`✅ Active Provider: ${provider.name}`);

    // Show current config
    switch (AI_PROVIDER.toLowerCase()) {
      case 'bedrock':
        console.log(`   Model: ${process.env.BEDROCK_MODEL || 'us.anthropic.claude-3-5-sonnet-20241022-v2:0'}`);
        console.log(`   Region: ${process.env.AWS_REGION || 'us-east-1'}`);
        break;
      case 'anthropic':
        console.log(`   Model: ${process.env.ANTHROPIC_MODEL || 'claude-3-5-sonnet-20241022'}`);
        console.log(`   API Key: ${process.env.ANTHROPIC_API_KEY ? '✓ Set' : '✗ Missing'}`);
        break;
      case 'openai':
        console.log(`   Model: ${process.env.OPENAI_MODEL || 'gpt-4o'}`);
        console.log(`   API Key: ${process.env.OPENAI_API_KEY ? '✓ Set' : '✗ Missing'}`);
        break;
      case 'gemini':
        console.log(`   Model: ${process.env.GEMINI_MODEL || 'gemini-2.0-flash-exp'}`);
        console.log(`   API Key: ${process.env.GEMINI_API_KEY ? '✓ Set' : '✗ Missing'}`);
        break;
    }
  } catch (err) {
    console.error(`\n❌ Error: ${err.message}`);
    console.log('\nℹ️  Check your .env file configuration\n');
  }

  console.log(`\n🎨 Test at: http://localhost:${PORT}/json-render\n`);
});
