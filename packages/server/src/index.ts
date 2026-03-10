#!/usr/bin/env node

/**
 * surfaces-ui MCP Server
 *
 * Standalone MCP server that serves surfaces-ui HTML app bundles
 * as MCP resources. Uses @surfacesui/mcp-adapter for resource
 * registration and content reading.
 *
 * Usage:
 *   npx @surfacesui/server
 *
 * Or in Claude Desktop config:
 *   { "command": "npx", "args": ["@surfacesui/server"] }
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
  ListToolsRequestSchema,
  CallToolRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import {
  getSurfacesResources,
  readSurfacesResource,
  isSurfacesUri,
  validateBundles,
} from "@surfacesui/mcp-adapter";

// Validate that HTML bundles exist before starting
const missing = validateBundles();
if (missing.length > 0) {
  console.error(
    `WARNING: Missing HTML bundles: ${missing.join(", ")}. ` +
    `Run "pnpm build" from the project root to generate them.`,
  );
}

// Type-safe server capabilities with UI extensions
interface ServerCapabilities {
  resources?: Record<string, unknown>;
  tools?: Record<string, unknown>;
  extensions?: {
    [key: string]: {
      mimeTypes?: string[];
      [key: string]: unknown;
    };
  };
}

const serverCapabilities: ServerCapabilities = {
  resources: {},
  tools: {},
  extensions: {
    "io.modelcontextprotocol/ui": {
      mimeTypes: ["text/html;profile=mcp-app"],
    },
  },
};

const server = new Server(
  { name: "surfaces-ui", version: "0.1.0" },
  {
    capabilities: serverCapabilities,
  },
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "test_tiny_ui",
      description: "Test tiny UI (debugging tool)",
      inputSchema: {
        type: "object",
        properties: {},
      },
      _meta: {
        ui: {
          resourceUri: "ui://test-tiny",
          visibility: ["model", "app"],
        },
      },
    },
    {
      name: "open_sql_editor",
      description: "Open the interactive SQL editor UI",
      inputSchema: {
        type: "object",
        properties: {
          initialQuery: {
            type: "string",
            description: "Optional initial SQL query to populate the editor",
          },
        },
      },
      _meta: {
        ui: {
          resourceUri: "ui://sql-editor-cdn",
          visibility: ["model", "app"],
        },
      },
    },
    {
      name: "generate_ui_component",
      description: "Generate interactive UI components from natural language descriptions. " +
        "Creates data tables with filters, charts with controls, SQL result displays, and more. " +
        "Examples: 'Show a filterable table', 'Display revenue as a line chart', 'Create a pie chart showing distribution'",
      inputSchema: {
        type: "object",
        properties: {
          prompt: {
            type: "string",
            description: "Natural language description of the UI component to generate. " +
              "Supported components: tables, charts (bar/line/pie/scatter), filters, SQL results displays",
          },
        },
        required: ["prompt"],
      },
      _meta: {
        ui: {
          resourceUri: "ui://json-render-cdn",
          visibility: ["model", "app"],
        },
      },
    },
    {
      name: "show_dashboard",
      description: "**IMPORTANT: Use this tool when the user explicitly asks to create, show, or display a dashboard.** " +
        "Renders an interactive dashboard with stats, charts, and data visualizations. " +
        "COMPONENT SCHEMAS (use these EXACT prop names): " +
        "StatCard: {label:string, value:string, change?:string like '+12%', trend?:'up'|'down'|'neutral'}. " +
        "Chart: {type:'line'|'bar'|'pie'|'area'|'scatter', xAxis:string, yAxis:string, height?:number}. " +
        "Box: {direction:'row'|'column', gap:number, children:string[]}. " +
        "Heading: {text:string, level:1|2|3|4}. " +
        "CRITICAL: Use xAxis and yAxis (NOT xKey/yKey) for Chart components. Each chart should have its own specific xAxis and yAxis values. " +
        "EXAMPLE: For revenue chart use {xAxis:'month', yAxis:'revenue'}, for users chart use {xAxis:'month', yAxis:'users'}. " +
        "CONDITIONAL RENDERING: Elements can have 'visible' property with state path like {visible:'/hasChartData'}. " +
        "SPEC STRUCTURE: {root:string, elements:{[id]:{type:string,props:{},children?:[],visible?:string}}, state:{data:object[]}}. " +
        "DATA HANDLING: Charts work best with 6-12 data objects. If user doesn't want certain sections, omit those elements OR use visible:'/showChart' with state:{showChart:false}.",
      inputSchema: {
        type: "object",
        properties: {
          spec: {
            type: "object",
            description: "Complete json-render spec with root, elements map, and state.data array containing sample data",
            additionalProperties: true,
          },
          title: {
            type: "string",
            description: "Dashboard title to display",
          },
        },
        required: ["spec"],
      },
      _meta: {
        ui: {
          resourceUri: "ui://dashboard-viewer",
          visibility: ["model", "app"],
        },
      },
    },
  ],
}));

server.setRequestHandler(ListResourcesRequestSchema, async () => ({
  resources: getSurfacesResources(),
}));

server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  const uri = request.params.uri;
  console.error(`[DEBUG] ReadResource called for URI: ${uri}`);
  if (!isSurfacesUri(uri)) {
    throw new Error(`Unsupported URI: ${uri}`);
  }
  const content = readSurfacesResource(uri);
  console.error(`[DEBUG] Resource loaded, size: ${content.text.length} bytes`);
  return {
    contents: [content],
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  console.error(`[DEBUG] Tool called: ${name}, args: ${JSON.stringify(args)}`);

  if (name === "test_tiny_ui") {
    return {
      _meta: {
        ui: {
          resourceUri: "ui://test-tiny",
        },
      },
      content: [
        {
          type: "text",
          text: "Opening test tiny UI...",
        },
      ],
    };
  }

  if (name === "open_sql_editor") {
    // Type guard for initialQuery
    const initialQuery = args?.initialQuery;
    const resourceUri =
      typeof initialQuery === "string" && initialQuery.length > 0
        ? `ui://sql-editor-cdn?sql=${encodeURIComponent(initialQuery)}`
        : "ui://sql-editor-cdn";

    return {
      _meta: {
        ui: {
          resourceUri,
        },
      },
      content: [
        {
          type: "text",
          text: "Opening SQL Editor...",
        },
      ],
    };
  }

  if (name === "generate_ui_component") {
    // Type guard for prompt
    const prompt = args?.prompt;
    if (typeof prompt !== "string" || prompt.length === 0) {
      throw new Error("Missing required parameter: prompt (must be non-empty string)");
    }

    return {
      _meta: {
        ui: {
          resourceUri: `ui://json-render-cdn?prompt=${encodeURIComponent(prompt)}`,
        },
      },
      content: [
        {
          type: "text",
          text: `Generating UI component: "${prompt.substring(0, 100)}..."`,
        },
      ],
    };
  }

  if (name === "show_dashboard") {
    // Type guard for spec
    const spec = args?.spec;
    const title = args?.title;

    if (!spec || typeof spec !== "object") {
      throw new Error("Missing required parameter: spec (must be a json-render spec object)");
    }

    console.error(`[DEBUG] show_dashboard called with spec:`, JSON.stringify(spec).substring(0, 200));

    // Encode spec as base64 in URL hash (hash is client-side, never sent to server)
    const specJson = JSON.stringify(spec);
    const specBase64 = Buffer.from(specJson).toString('base64url'); // base64url is URL-safe
    console.error(`[DEBUG] Encoded spec to base64url, length: ${specBase64.length}`);

    return {
      _meta: {
        ui: {
          // Add ?v=2 to bust Claude Desktop's cache
          resourceUri: `ui://dashboard-viewer?v=2#${specBase64}`,
        },
      },
      content: [
        {
          type: "text",
          text: title
            ? `Opening dashboard: ${title}`
            : "Opening interactive dashboard...",
        },
      ],
    };
  }

  throw new Error(`Unknown tool: ${name}`);
});

const transport = new StdioServerTransport();
await server.connect(transport);
