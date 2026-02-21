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
  { capabilities: { resources: {} } },
);

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

const transport = new StdioServerTransport();
await server.connect(transport);
