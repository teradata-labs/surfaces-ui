import { Client } from "@modelcontextprotocol/client";
import type { Transport } from "@modelcontextprotocol/client";
import { EngineError } from "@surfaces-ui/engine";
import { type SqlRows, type ToolAnswer, readRows, toolError } from "./parse.js";

export interface McpSqlOptions {
  /** How to reach the database's MCP server. Opened once, on first use. `stdioServer` and `httpServer` build one. */
  transport(): Transport | Promise<Transport>;
  /** The server's tool that runs a query. Found by its shape when left out. */
  tool?: string;
  /** The tool's argument that takes the SQL. Found from the tool's schema when left out. */
  argument?: string;
  /** Other arguments sent with every query, such as a project id or a row limit. Never a credential. */
  arguments?: Record<string, unknown>;
  /** Give up connecting, or waiting for one query, after this long. Default 60 seconds. */
  timeoutMs?: number;
}

/** A database's MCP server, used for one thing: running a statement and reading its rows. */
export interface McpSql {
  query(sql: string, options?: { signal?: AbortSignal }): Promise<SqlRows>;
  /** The query tool in use and the other tools the server lists, once connected. */
  describe(): Promise<{ tool: string; argument: string; tools: string[]; server: string }>;
  close(): Promise<void>;
}

interface ListedTool {
  name: string;
  inputSchema?: { properties?: Record<string, { type?: unknown }> };
}

const SQL_ARGUMENTS = ["sql", "query", "statement"];
/** Query tools of the servers this was written against, most specific first; a read-only form is preferred where a server has both. */
const KNOWN = ["base_readQuery", "execute_sql_read_only", "execute_sql_readonly", "execute_query", "execute_sql", "run_snowflake_query", "mysql_query", "read_query", "query", "run-sql"];

/**
 * Picks the tool that runs SQL: one with a text argument named `sql`,
 * `query` or `statement`. The argument is not required to be marked
 * required, since several servers leave that out.
 */
export function findQueryTool(tools: ListedTool[], wanted?: { tool?: string; argument?: string }): { tool: string; argument: string } {
  const argumentOf = (tool: ListedTool) => {
    const properties = tool.inputSchema?.properties ?? {};
    return wanted?.argument ?? SQL_ARGUMENTS.find((name) => name in properties);
  };
  if (wanted?.tool) {
    const tool = tools.find((t) => t.name === wanted.tool);
    if (!tool) throw new EngineError("UNSUPPORTED", `The data server has no tool named ${wanted.tool}. It lists: ${tools.map((t) => t.name).join(", ") || "none"}.`);
    return { tool: tool.name, argument: argumentOf(tool) ?? "sql" };
  }
  const candidates = tools.filter((tool) => argumentOf(tool) !== undefined);
  const rank = (tool: ListedTool) => {
    const known = KNOWN.indexOf(tool.name);
    if (known !== -1) return known;
    if (/read[_-]?only/i.test(tool.name)) return KNOWN.length;
    return /(sql|query)/i.test(tool.name) ? KNOWN.length + 1 : KNOWN.length + 2;
  };
  const best = candidates.sort((a, b) => rank(a) - rank(b))[0];
  if (!best) {
    throw new EngineError("UNSUPPORTED", `The data server lists no tool that takes SQL (an argument named sql, query or statement). Name one with "tool". It lists: ${tools.map((t) => t.name).join(", ") || "none"}.`);
  }
  return { tool: best.name, argument: argumentOf(best)! };
}

/** Connects to a database's MCP server and runs statements through its query tool. */
export function mcpSql(options: McpSqlOptions): McpSql {
  const timeout = options.timeoutMs ?? 60_000;
  let opened: Promise<{ client: Client; tool: string; argument: string; tools: string[]; server: string }> | undefined;
  const open = () => {
    opened ??= (async () => {
      const client = new Client({ name: "surfaces-ui", version: "0" });
      try {
        await client.connect(await options.transport(), { timeout });
        const tools = (await client.listTools()).tools as ListedTool[];
        const found = findQueryTool(tools, options);
        return { client, ...found, tools: tools.map((t) => t.name), server: client.getServerVersion()?.name ?? "" };
      } catch (error) {
        await client.close().catch(() => {});
        opened = undefined;
        if (error instanceof EngineError) throw error;
        // A transport's message can repeat the command it ran or the address it called, credentials included, so it is not passed on.
        throw new EngineError("ENGINE", "The data server could not be reached. Check that it is running and that its address or command is right.");
      }
    })();
    return opened;
  };
  return {
    async query(sql, queryOptions = {}) {
      const { client, tool, argument } = await open();
      let answer: ToolAnswer;
      try {
        answer = (await client.callTool({ name: tool, arguments: { ...options.arguments, [argument]: sql } }, { signal: queryOptions.signal, timeout })) as ToolAnswer;
      } catch (error) {
        if (queryOptions.signal?.aborted) throw new EngineError("CANCELLED", "The query was cancelled.");
        // A server that reports a failed query as a protocol error: its message is the database's.
        throw databaseError(error instanceof Error ? error.message : String(error));
      }
      const failed = toolError(answer);
      if (failed !== undefined) throw databaseError(failed);
      try {
        return readRows(answer);
      } catch (error) {
        throw new EngineError("UNSUPPORTED", error instanceof Error ? error.message : String(error));
      }
    },
    async describe() {
      const { tool, argument, tools, server } = await open();
      return { tool, argument, tools, server };
    },
    async close() {
      const current = opened;
      opened = undefined;
      if (current) await current.then(({ client }) => client.close()).catch(() => {});
    },
  };
}

/** A database's error message as an EngineError with a code the UI understands. */
export function databaseError(message: string): EngineError {
  // A driver's message can run on into a stack trace; the first line is the database's own.
  const clean = (message.split("\n")[0] ?? "")
    .replace(/^MCP error -?\d+:\s*/i, "")
    .replace(/^Internal error:\s*/i, "")
    .replace(/^\([\w.]+\)\s*/, "")
    .replace(/^(Error|Binder Error|Catalog Error|Parser Error|Conversion Error):\s*/i, "")
    .trim();
  const code = /timed? ?out/i.test(message)
    ? "TIMEOUT"
    : /syntax error|parser error|parse error|\b3706\b/i.test(message)
      ? "SYNTAX"
      : /column .* (does not exist|not found)|unknown column|referenced column|\b3810\b/i.test(message)
        ? "UNKNOWN_COLUMN"
        : /(relation|table|object) .* (does not exist|not found)|table with name .* does not exist|doesn't exist|\b3807\b/i.test(message)
          ? "UNKNOWN_TABLE"
          : "ENGINE";
  return new EngineError(code, clean || "The data server reported an error.");
}
