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

const server = new Server(
  { name: "surfaces-ui", version: "0.1.0" },
  {
    capabilities: {
      resources: {},
      tools: {},
      extensions: {
        "io.modelcontextprotocol/ui": {
          mimeTypes: ["text/html;profile=mcp-app"],
        },
      },
    } as any,
  },
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
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
          resourceUri: "surfaces-ui/apps/sql-editor-cdn",
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
          resourceUri: "surfaces-ui/apps/json-render-cdn",
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
  if (!isSurfacesUri(uri)) {
    throw new Error(`Unsupported URI: ${uri}`);
  }
  const content = readSurfacesResource(uri);
  return {
    contents: [content],
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  if (name === "open_sql_editor") {
    return {
      _meta: {
        ui: {
          resourceUri: args?.initialQuery
            ? `surfaces-ui/apps/sql-editor-cdn?sql=${encodeURIComponent(args.initialQuery as string)}`
            : "surfaces-ui/apps/sql-editor-cdn",
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
    const prompt = args?.prompt as string;
    if (!prompt) {
      throw new Error("Missing required parameter: prompt");
    }

    return {
      _meta: {
        ui: {
          resourceUri: `surfaces-ui/apps/json-render-cdn?prompt=${encodeURIComponent(prompt)}`,
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
