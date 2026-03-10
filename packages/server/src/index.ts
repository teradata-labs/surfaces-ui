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

  throw new Error(`Unknown tool: ${name}`);
});

const transport = new StdioServerTransport();
await server.connect(transport);
