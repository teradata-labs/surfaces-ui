#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { CONFIG_FILES, type SurfacesConfig, loadConfig, openSources, serverOptions } from "./config.js";
import { ENV_FILE, loadEnvFile } from "./env.js";
import { createSurfacesServer } from "./server.js";

const args = process.argv.slice(2);
const flag = (name: string) => {
  const at = args.indexOf(name);
  return at === -1 ? undefined : args[at + 1];
};

const file = flag("--config") ?? CONFIG_FILES.find((f) => fs.existsSync(path.resolve(f)));

// Secrets (ANTHROPIC_API_KEY and the like) may sit in a git-ignored .env.local beside the config.
// Read it before the config loads, since the config reads the environment as it starts.
const secrets = loadEnvFile(path.dirname(path.resolve(file ?? CONFIG_FILES[0]!)));
if (secrets.names.length > 0) console.log(`Read ${secrets.names.join(", ")} from ${ENV_FILE}.`);

try {
  // With no config, serve the six sample industry models so there is something to explore.
  const { config, dir }: { config: SurfacesConfig; dir: string } = file ? await loadConfig(file) : { config: { seeds: true }, dir: process.cwd() };
  if (!file) console.log(`No ${CONFIG_FILES[0]} found: serving the sample industry models. Create one, or pass --config <file>, to use your own data.`);
  const sources = await openSources(config, dir);
  const server = await createSurfacesServer(await serverOptions(config, sources, dir));
  const { url } = await server.listen(Number(flag("--port") ?? config.port ?? 5220));
  console.log(`Surfaces dev server: ${url}`);
  for (const source of sources) {
    const tables = await source.engine.listTables({ catalog: "", schema: "", search: "" });
    const names = tables.map((t) => t.ref?.table);
    console.log(`  ${source.id}: ${names.length > 20 ? `${names.length}${names.length >= 1000 ? " or more" : ""} tables` : names.join(", ")}`);
  }
  console.log(`  search: ${config.discovery?.embedder === "local" ? "semantic and keyword (local model)" : "keyword"}`);
  // The index is built now, in the background, so the first search does not wait for it.
  const began = Date.now();
  void server.discovery?.warm().then(
    ({ objects }) => console.log(`  search index ready: ${objects} tables and columns, ${Math.round((Date.now() - began) / 1000)}s`),
    (error: unknown) => console.warn(`  search index could not be built: ${error instanceof Error ? error.message : String(error)}`),
  );
  const stop = () => void server.close().then(() => process.exit(0));
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
