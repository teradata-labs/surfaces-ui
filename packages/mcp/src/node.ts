import { StdioClientTransport } from "@modelcontextprotocol/client/stdio";
import type { Transport } from "@modelcontextprotocol/client";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/** Reads the built single-file app page that ships with this package. */
export function readAppHtml(): string {
  const file = path.join(path.dirname(fileURLToPath(import.meta.url)), "app.html");
  if (!fs.existsSync(file)) throw new Error("The Surfaces app page has not been built. Run the @surfaces-ui/mcp build.");
  return fs.readFileSync(file, "utf8");
}

export interface InstallOptions {
  /** Repository to install into. */
  dir: string;
  /** Config file the server should load, relative to `dir`. */
  config?: string;
  /** Name of the server entry. Defaults to "surfaces". */
  name?: string;
}

/**
 * Adds the Surfaces MCP server to a repository's `.mcp.json`, keeping any
 * servers already listed there. Returns the file path and whether an
 * existing entry was replaced.
 */
export function installMcpServer(options: InstallOptions): { file: string; replaced: boolean } {
  const file = path.join(path.resolve(options.dir), ".mcp.json");
  const name = options.name ?? "surfaces";
  let current: { mcpServers?: Record<string, unknown> } = {};
  if (fs.existsSync(file)) {
    try {
      current = JSON.parse(fs.readFileSync(file, "utf8")) as typeof current;
    } catch {
      throw new Error(`${file} is not valid JSON. Fix or remove it, then run install again.`);
    }
    if (current === null || typeof current !== "object" || Array.isArray(current)) throw new Error(`${file} must contain a JSON object.`);
  }
  const servers = current.mcpServers ?? {};
  const replaced = Object.hasOwn(servers, name);
  const next = {
    ...current,
    mcpServers: { ...servers, [name]: { command: "npx", args: ["-y", "@surfaces-ui/mcp", "--config", options.config ?? "surfaces.config.ts"] } },
  };
  fs.writeFileSync(file, `${JSON.stringify(next, null, 2)}\n`);
  return { file, replaced };
}

/**
 * A server started as a local program over stdio. Only the environment
 * variables named in `env` are passed on, read from this process; nothing
 * else of the server's environment reaches it.
 */
export function stdioTransport(command: string, args: string[] = [], options: { env?: string[]; cwd?: string } = {}): () => Transport {
  return () => {
    const env: Record<string, string> = { PATH: process.env.PATH ?? "" };
    for (const name of options.env ?? []) {
      const value = process.env[name];
      if (value !== undefined) env[name] = value;
    }
    return new StdioClientTransport({ command, args, env, ...(options.cwd ? { cwd: options.cwd } : {}) });
  };
}
