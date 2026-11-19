import { fileURLToPath } from "node:url";
import { McpServer } from "@modelcontextprotocol/server";
import { StdioServerTransport } from "@modelcontextprotocol/server/stdio";
import type { DataSource } from "@surfaces-ui/data";
import { createSurfacesServer, openSources, serverOptions } from "@surfaces-ui/dev-server";
import { registerSurfacesApps } from "@surfaces-ui/mcp";
import { readAppHtml } from "@surfaces-ui/mcp/node";

/**
 * An MCP server with the Surfaces tools and app page over any DataSource.
 * `appHtml` defaults to the page built into @surfaces-ui/mcp.
 */
export function buildServer(dataSource: DataSource, appHtml: string | (() => string) = readAppHtml): McpServer {
  const server = new McpServer({ name: "surfaces", version: "0.0.0" });
  registerSurfacesApps(server, { dataSource, appHtml });
  return server;
}

/** Runs over stdio with the six sample industry models. stdout carries the protocol, so logs go to stderr. */
export async function main() {
  const config = { seeds: true };
  const dir = process.cwd();
  const backend = await createSurfacesServer(await serverOptions(config, await openSources(config, dir), dir));
  await buildServer(backend.dataSource).connect(new StdioServerTransport());
  process.stderr.write("Surfaces MCP server ready.\n");
  const stop = () => void backend.close().then(() => process.exit(0));
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await main();
