#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { McpServer } from "@modelcontextprotocol/server";
import { StdioServerTransport } from "@modelcontextprotocol/server/stdio";
import { CONFIG_FILES, configFromEnv, findConfig, createSurfacesServer, loadConfig, loadEnvFile, openSources, serverOptions } from "@surfaces-ui/dev-server";
import { installMcpServer, readAppHtml } from "./node.js";
import { registerSurfacesApps } from "./server.js";

const args = process.argv.slice(2);
const flag = (name: string) => {
  const at = args.indexOf(name);
  return at === -1 ? undefined : args[at + 1];
};
// stdout carries the MCP protocol, so everything a person should read goes to stderr.
const say = (text: string) => process.stderr.write(`${text}\n`);

try {
  if (args[0] === "install") {
    const dir = flag("--dir") ?? process.cwd();
    const config = flag("--config") ?? CONFIG_FILES.find((f) => fs.existsSync(path.resolve(dir, f)));
    const { file, replaced } = installMcpServer({ dir, config, name: flag("--name") });
    say(`${replaced ? "Updated" : "Added"} the Surfaces server in ${file}.`);
    if (!config) say(`No config found in ${dir}. Create ${CONFIG_FILES[0]} with your data sources before starting the server.`);
  } else {
    // A project's config in the working directory, or a person's own in ~/.surfaces, for a host with no project folder.
    const file = flag("--config") ?? findConfig();
    // Secrets (a warehouse's host and password, a model key) come from the git-ignored .env.local beside the config, as on the dev server.
    const secrets = loadEnvFile(path.dirname(path.resolve(file ?? CONFIG_FILES[0]!)));
    if (secrets.names.length > 0) say(`Read ${secrets.names.join(", ")} from ${secrets.file}.`);
    // With no config file, a source named in the environment (a plugin's settings); with neither, the six sample industry models.
    const fromEnv = file ? undefined : configFromEnv();
    const { config, dir } = file ? await loadConfig(file) : { config: fromEnv ?? { seeds: true }, dir: process.cwd() };
    const sources = await openSources(config, dir);
    const backend = await createSurfacesServer(await serverOptions(config, sources, dir));
    const server = new McpServer({ name: "surfaces", version: "0.0.0" });
    registerSurfacesApps(server, { dataSource: backend.dataSource, discovery: backend.discovery, ...(backend.pipelines ? { pipelines: backend.pipelines } : {}), appHtml: readAppHtml });
    await server.connect(new StdioServerTransport());
    say(`Surfaces MCP server ready (${sources.map((s) => s.id).join(", ")}${file ? "" : fromEnv ? "; from this plugin's settings" : "; sample data, no config found"}).`);
    const stop = () => void backend.close().then(() => process.exit(0));
    process.on("SIGINT", stop);
    process.on("SIGTERM", stop);
  }
} catch (error) {
  say(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
