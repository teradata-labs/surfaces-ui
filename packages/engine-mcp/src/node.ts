import { StdioClientTransport } from "@modelcontextprotocol/client/stdio";
import type { Transport } from "@modelcontextprotocol/client";

/**
 * A database's MCP server started as a local program over stdio, e.g.
 * `stdioServer("uvx", ["teradata-mcp-server"], { env: ["DATABASE_URI"] })`.
 * Only the environment variables named in `env` are passed on, read from
 * this process, so a connection string stays in the environment and out of
 * configuration; nothing else of this process's environment reaches it.
 */
export function stdioServer(command: string, args: string[] = [], options: { env?: string[]; cwd?: string } = {}): () => Transport {
  return () => {
    const env: Record<string, string> = { PATH: process.env.PATH ?? "" };
    for (const name of ["HOME", ...(options.env ?? [])]) {
      const value = process.env[name];
      if (value !== undefined) env[name] = value;
    }
    return new StdioClientTransport({ command, args, env, stderr: "ignore", ...(options.cwd ? { cwd: options.cwd } : {}) });
  };
}
