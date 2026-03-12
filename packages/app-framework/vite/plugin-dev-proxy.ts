import type { Plugin, ViteDevServer } from 'vite';
import { spawn, type ChildProcess } from 'node:child_process';

export interface DevProxyOptions {
  /** Shell command to spawn the MCP server (e.g. 'go run ./cmd/server'). */
  command?: string;
  /** URL of an already-running MCP server. */
  mcpUrl?: string;
  /** Transport type. Default: 'stdio' */
  transport?: 'stdio' | 'sse' | 'streamable-http';
}

/**
 * Vite plugin that proxies MCP tool calls from the browser to a real MCP server
 * during development.
 *
 * Architecture:
 *   Browser (DevBridge via WebSocket)
 *       ↕ WebSocket (/__mcp_proxy)
 *   Vite Dev Server (this plugin)
 *       ↕ stdio or HTTP
 *   Real MCP Server (e.g. Go binary)
 *
 * This is a basic implementation that handles callServerTool forwarding.
 * Streaming/push support can be added later.
 */
export function pluginDevProxy(options: DevProxyOptions): Plugin {
  let childProcess: ChildProcess | null = null;
  let server: ViteDevServer | null = null;

  return {
    name: 'surfacesui:dev-proxy',
    apply: 'serve', // only active during dev

    configureServer(devServer) {
      server = devServer;

      // Spawn MCP server if command is provided
      if (options.command) {
        const [cmd, ...args] = options.command.split(' ');
        if (cmd) {
          childProcess = spawn(cmd, args, {
            stdio: ['pipe', 'pipe', 'inherit'],
            shell: true,
          });

          childProcess.on('error', (err) => {
            devServer.config.logger.error(
              `[dev-proxy] Failed to spawn MCP server: ${err.message}`,
            );
          });

          childProcess.on('exit', (code) => {
            if (code !== null && code !== 0) {
              devServer.config.logger.warn(
                `[dev-proxy] MCP server exited with code ${code}`,
              );
            }
          });

          devServer.config.logger.info(
            `[dev-proxy] Spawned MCP server: ${options.command}`,
          );
        }
      }

      // Install WebSocket endpoint at /__mcp_proxy
      devServer.ws.on('mcp:callTool', async (data: { name: string; arguments: Record<string, unknown> }, client) => {
        try {
          const result = await forwardToolCall(data, options, childProcess);
          client.send('mcp:toolResult', result);
        } catch (err) {
          client.send('mcp:toolResult', {
            isError: true,
            content: [
              {
                type: 'text',
                text: err instanceof Error ? err.message : 'Dev proxy error',
              },
            ],
          });
        }
      });
    },

    buildEnd() {
      // Cleanup child process
      if (childProcess) {
        childProcess.kill('SIGTERM');
        childProcess = null;
      }
    },
  };
}

/**
 * Forward a tool call to the MCP server via stdio JSON-RPC.
 */
async function forwardToolCall(
  data: { name: string; arguments: Record<string, unknown> },
  options: DevProxyOptions,
  child: ChildProcess | null,
): Promise<unknown> {
  const transport = options.transport ?? 'stdio';

  if (transport === 'stdio' && child?.stdin && child?.stdout) {
    return forwardViaStdio(data, child);
  }

  if ((transport === 'sse' || transport === 'streamable-http') && options.mcpUrl) {
    return forwardViaHttp(data, options.mcpUrl);
  }

  throw new Error(
    '[dev-proxy] No MCP server available. Provide either command (for stdio) or mcpUrl (for HTTP).',
  );
}

function forwardViaStdio(
  data: { name: string; arguments: Record<string, unknown> },
  child: ChildProcess,
): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const id = Date.now();
    const request = JSON.stringify({
      jsonrpc: '2.0',
      id,
      method: 'tools/call',
      params: { name: data.name, arguments: data.arguments },
    });

    const handler = (chunk: Buffer) => {
      try {
        const lines = chunk.toString().split('\n').filter(Boolean);
        for (const line of lines) {
          const response = JSON.parse(line) as { id?: number; result?: unknown; error?: unknown };
          if (response.id === id) {
            child.stdout!.removeListener('data', handler);
            if (response.error) {
              reject(new Error(JSON.stringify(response.error)));
            } else {
              resolve(response.result);
            }
            return;
          }
        }
      } catch {
        // Partial JSON — wait for more data
      }
    };

    child.stdout!.on('data', handler);
    child.stdin!.write(request + '\n');

    // Timeout after 30 seconds
    setTimeout(() => {
      child.stdout!.removeListener('data', handler);
      reject(new Error('[dev-proxy] Stdio tool call timed out after 30s'));
    }, 30_000);
  });
}

async function forwardViaHttp(
  data: { name: string; arguments: Record<string, unknown> },
  mcpUrl: string,
): Promise<unknown> {
  const response = await fetch(mcpUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: Date.now(),
      method: 'tools/call',
      params: { name: data.name, arguments: data.arguments },
    }),
  });

  if (!response.ok) {
    throw new Error(`[dev-proxy] HTTP ${response.status}: ${response.statusText}`);
  }

  const json = (await response.json()) as { result?: unknown; error?: unknown };
  if (json.error) {
    throw new Error(JSON.stringify(json.error));
  }
  return json.result;
}
