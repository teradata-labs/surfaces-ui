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
  * Required props: columns (array of column name strings), height (number)
  * Optional props: initialDensity, showFilter, showDensityToggle
- ChartWithControls: Chart (bar/line/pie/scatter) with axis configuration
  * Required props: columns (array of column name strings), height (number), initialChartType, initialXAxis, initialYAxis
  * Optional props: showControls
- SQLResultsDisplay: Combined table and chart views for SQL results
  * Required props: sql (string), context (MUST be "web" or "mcp-apps"), initialViewMode, tableHeight, chartHeight
- DataTable: Simple virtualized table
  * Required props: columns (array of column name strings), height (number)
  * Optional props: density, virtualScrolling
- Chart: Basic chart without controls
  * Required props: type, xAxis (column name string), yAxis (column name string), height
  * Optional props: showDataLabels
- Filter: Search filter component
- DensityToggle: Density mode toggle
- ViewModeToggle: Table/chart view toggle

Response format:
{
  "root": "elementId",
  "elements": {
    "elementId": {
      "type": "ComponentName",
      "props": {
        "columns": ["name", "email", "department", "salary"],
        "height": 400
      }
    }
  }
}

CRITICAL Rules:
1. Always use "root" and "elements" structure
2. columns MUST be an array of STRING column names (e.g., ["id", "name", "email"]), NEVER numbers or indices
3. The sample data has these columns available: ["id", "name", "product", "category", "value", "amount", "region", "status", "date"]
   - Use "amount" or "value" for numeric Y-axis values
   - Use "product" or "category" for categorical data
   - Use "date" for time-series X-axis
   - Use "name" for customer/item names
   - Use "region" for geographical grouping
4. height MUST be a number (e.g., 400, not "400")
5. Chart axis props (xAxis, yAxis) MUST be single column name strings (e.g., "name", not ["name"])
6. Only use column names from the available list above - invalid columns will cause errors
7. Return ONLY valid JSON, no markdown, no explanation, no code blocks

Good Examples:
- "Filterable table" → {"root":"table","elements":{"table":{"type":"TableWithFilters","props":{"columns":["id","name","product","amount","region"],"height":400}}}}
- "Bar chart of sales" → {"root":"chart","elements":{"chart":{"type":"ChartWithControls","props":{"columns":["product","amount"],"height":400,"initialChartType":"bar","initialXAxis":"product","initialYAxis":"amount"}}}}
- "Full SQL results" → {"root":"results","elements":{"results":{"type":"SQLResultsDisplay","props":{"sql":"SELECT * FROM data","context":"web","initialViewMode":"table","tableHeight":400,"chartHeight":400}}}}`;


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

/**
 * Fix common AI mistakes in generated specs
 */
function fixSpec(spec) {
  const defaultColumns = {
    employee: ['id', 'name', 'email', 'department', 'salary', 'hireDate'],
    sales: ['id', 'product', 'amount', 'date', 'region'],
    default: ['id', 'name', 'category', 'value', 'status', 'date']
  };

  // Helper to detect data type from element type or prompt context
  function getDefaultColumns(type, length) {
    const columns = type?.toLowerCase().includes('sql') || type?.toLowerCase().includes('employee')
      ? defaultColumns.employee
      : defaultColumns.default;
    return columns.slice(0, length || 5);
  }

  // Recursively fix all elements
  function fixElement(element, elementId) {
    if (!element || typeof element !== 'object') return;

    const { type, props } = element;

    // Fix SQLResultsDisplay required props
    if (type === 'SQLResultsDisplay') {
      if (!props.sql || typeof props.sql !== 'string') {
        props.sql = 'SELECT * FROM data';
        console.log(`  🔧 Fixed ${elementId}.sql: "${props.sql}"`);
      }
      // context MUST be 'web' or 'mcp-apps' - fix if invalid
      if (!props.context || (props.context !== 'web' && props.context !== 'mcp-apps')) {
        props.context = 'web';
        console.log(`  🔧 Fixed ${elementId}.context: "web" (was: "${props.context}")`);
      }
      if (!props.initialViewMode) {
        props.initialViewMode = 'table';
        console.log(`  🔧 Fixed ${elementId}.initialViewMode: "table"`);
      }
      if (!props.tableHeight || typeof props.tableHeight !== 'number') {
        props.tableHeight = 400;
        console.log(`  🔧 Fixed ${elementId}.tableHeight: 400`);
      }
      if (!props.chartHeight || typeof props.chartHeight !== 'number') {
        props.chartHeight = 400;
        console.log(`  🔧 Fixed ${elementId}.chartHeight: 400`);
      }
    }

    // Fix columns if it's an array of numbers
    if (props?.columns && Array.isArray(props.columns)) {
      const hasNumericColumns = props.columns.some(col => typeof col === 'number');
      if (hasNumericColumns) {
        const columnCount = props.columns.length;
        props.columns = getDefaultColumns(type || elementId, columnCount);
        console.log(`  🔧 Fixed ${elementId}.columns: [${props.columns.join(', ')}]`);
      }
    }

    // Fix xAxis/yAxis if they're numbers
    if (props?.xAxis !== undefined && typeof props.xAxis === 'number') {
      const cols = getDefaultColumns(type, 5);
      props.xAxis = cols[props.xAxis] || cols[0];
      console.log(`  🔧 Fixed ${elementId}.xAxis: "${props.xAxis}"`);
    }
    if (props?.yAxis !== undefined && typeof props.yAxis === 'number') {
      const cols = getDefaultColumns(type, 5);
      props.yAxis = cols[props.yAxis] || cols[1];
      console.log(`  🔧 Fixed ${elementId}.yAxis: "${props.yAxis}"`);
    }
  }

  // Fix all elements in spec
  if (spec.elements) {
    Object.entries(spec.elements).forEach(([id, element]) => {
      fixElement(element, id);
    });
  }

  return spec;
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
              let spec = JSON.parse(jsonMatch[0]);

              // Validate it's a proper spec
              if (spec.root && spec.elements) {
                specExtracted = true;

                // Fix common AI mistakes
                spec = fixSpec(spec);

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
            let spec = JSON.parse(jsonMatch[0]);
            if (spec.root && spec.elements) {
              // Fix common AI mistakes
              spec = fixSpec(spec);

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
