import { fileURLToPath } from "node:url";
import type Anthropic from "@anthropic-ai/sdk";
import { type SurfacesServer, type SurfacesServerOptions, createSurfacesServer, openSources, serverOptions } from "@surfaces-ui/dev-server";
import { claudeAgent } from "./agent.js";

/**
 * A dev server whose AgentService is Claude, with a `list_tables` tool over
 * the server's own sources: `agent` as a function is given the server's
 * DataSource.
 */
export function createClaudeChatServer(options: Omit<SurfacesServerOptions, "agent">, client?: Anthropic): Promise<SurfacesServer> {
  return createSurfacesServer({ ...options, agent: (dataSource) => claudeAgent(dataSource, client) });
}

/** Serves the six sample industry models with Claude on http://127.0.0.1:5220. */
export async function main() {
  const config = { seeds: true };
  const dir = process.cwd();
  const server = await createClaudeChatServer(await serverOptions(config, await openSources(config, dir), dir));
  const { url } = await server.listen(5220);
  console.log(`Chat with Claude at ${url}`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await main();
