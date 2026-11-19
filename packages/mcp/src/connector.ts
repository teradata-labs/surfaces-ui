import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client";
import type { Transport } from "@modelcontextprotocol/client";
import type { AgentConnector, RunnableTool } from "@surfaces-ui/agent";
import { ApprovalRisk } from "@surfaces-ui/proto";

export interface McpConnectorOptions {
  /** The connector's id in a chat's Connectors menu, e.g. "github". Tool names start with it. */
  id: string;
  name: string;
  description?: string;
  /** How to reach the server: stdio (`stdioTransport` in `@surfaces-ui/mcp/node`) or Streamable HTTP. Opened once, when first connected. */
  transport(): Transport | Promise<Transport>;
  /** Ask a person before every tool, not only the ones that may change things. */
  approveAll?: boolean;
  /** Give up connecting after this long. Default 10 seconds. */
  timeoutMs?: number;
}

export interface McpConnection {
  /** For `AgentOffer.connectors`: unavailable, with the reason, when the server could not be reached. */
  connector: AgentConnector;
  /** For `toolCallingAgent`'s `tools`. Empty when the server could not be reached. */
  tools: RunnableTool[];
  close(): Promise<void>;
}

/** A tool name a model accepts: letters, digits, `_` and `-`, at most 64 characters. */
const toolName = (id: string, name: string) => `${id}__${name}`.replace(/[^A-Za-z0-9_-]/g, "_").slice(0, 64);

type ToolContent = { type: string; text?: string };
const textOf = (content: unknown) =>
  (Array.isArray(content) ? (content as ToolContent[]) : [])
    .map((c) => (c.type === "text" ? (c.text ?? "") : `[${c.type}]`))
    .join("\n")
    .trim();

/**
 * An MCP server's tools as one connector an agent can be given. The server's
 * tools become runnable tools named `<id>__<tool>`; one the server does not
 * mark read-only (`readOnlyHint`) asks a person before it runs, and so does
 * every tool with `approveAll`. Nothing here holds a credential: the
 * transport carries whatever the host gave it. A server that cannot be
 * reached gives a connector marked unavailable with the reason, and no tools,
 * so the agent still starts.
 */
export async function mcpConnector(options: McpConnectorOptions): Promise<McpConnection> {
  const base = { id: options.id, name: options.name, ...(options.description ? { description: options.description } : {}) };
  const client = new Client({ name: "surfaces-agent", version: "0" });
  try {
    const transport = await options.transport();
    const timeout = options.timeoutMs ?? 10_000;
    await Promise.race([client.connect(transport), new Promise((_, reject) => setTimeout(() => reject(new Error(`no answer within ${timeout / 1000} seconds`)), timeout))]);
    // A tool an MCP App keeps for its own page (`visibility` without "model") is not offered to a model.
    const forModel = (tool: { _meta?: Record<string, unknown> }) => {
      const visibility = (tool._meta?.ui as { visibility?: string[] } | undefined)?.visibility;
      return !visibility || visibility.includes("model");
    };
    const listed = (await client.listTools()).tools.filter(forModel);
    const asks = (readOnly: boolean | undefined) => options.approveAll || readOnly !== true;
    const tools: RunnableTool[] = listed.map((tool) => {
      const name = toolName(options.id, tool.name);
      const label = tool.annotations?.title || tool.title || tool.name;
      return {
        name,
        description: `${tool.description ?? label} (from ${options.name})`,
        inputSchema: (tool.inputSchema ?? { type: "object" }) as Record<string, unknown>,
        ...(asks(tool.annotations?.readOnlyHint)
          ? {
              approval: (input: unknown) => ({
                title: `${label} in ${options.name}`,
                detail: tool.annotations?.destructiveHint === false ? `${options.name} may change something; nothing is removed.` : `${options.name} may change or remove something. Check what it is sent before allowing it.`,
                subject: { tool: tool.name, arguments: (input ?? {}) as Record<string, never> },
                risk: tool.annotations?.destructiveHint === false ? ApprovalRisk.LOW : ApprovalRisk.HIGH,
                basis: options.name,
              }),
            }
          : {}),
        run: async (input, signal, approved) => {
          // A tool that asked runs only what the person allowed.
          const args = approved ? ((approved.subject as { arguments?: Record<string, unknown> }).arguments ?? {}) : ((input ?? {}) as Record<string, unknown>);
          const result = await client.callTool({ name: tool.name, arguments: args }, { signal });
          const text = textOf(result.content);
          if (result.isError) throw new Error(text || `${options.name} reported an error.`);
          return result.structuredContent ?? text;
        },
      };
    });
    return { connector: { ...base, tools: tools.map((t) => t.name), requiresApproval: tools.some((t) => t.approval) }, tools, close: () => client.close() };
  } catch (error) {
    await client.close().catch(() => {});
    const reason = error instanceof Error ? error.message : String(error);
    return { connector: { ...base, tools: [], status: "unavailable", reason: `Could not reach ${options.name}: ${reason}` }, tools: [], close: async () => {} };
  }
}

/**
 * A server over Streamable HTTP. `token` is called per connection and its
 * value sent as a bearer token; the host reads it from its own environment
 * or vault, never from config.
 */
export function httpTransport(url: string, options: { token?(): string | undefined; headers?: Record<string, string> } = {}): () => Transport {
  return () => {
    const token = options.token?.();
    return new StreamableHTTPClientTransport(new URL(url), { requestInit: { headers: { ...options.headers, ...(token ? { Authorization: `Bearer ${token}` } : {}) } } });
  };
}
