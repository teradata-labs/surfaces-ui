import Anthropic from "@anthropic-ai/sdk";
import type { AgentBackend, RunnableTool } from "@surfaces-ui/agent";
import { anthropicAgent } from "@surfaces-ui/agent-anthropic";
import type { DataSource } from "@surfaces-ui/data";
import { analyticsCatalog, catalogPrompt } from "@surfaces-ui/spec";

/** Lets Claude see which sources and tables exist, with their columns. Names and types only; no row values. */
export function listTablesTool(dataSource: DataSource): RunnableTool {
  return {
    name: "list_tables",
    description: "List the data sources and their tables, with column names and types. Call this before writing SQL.",
    inputSchema: { type: "object", properties: { sourceId: { type: "string", description: "Only this source" } }, additionalProperties: false },
    run: async (input) => {
      const only = (input as { sourceId?: string }).sourceId;
      const { sources } = await dataSource.listSources({});
      const out = [];
      for (const source of sources.filter((s) => !only || s.id === only)) {
        const { tables } = await dataSource.listTables({ sourceId: source.id, pageSize: 200 });
        const described = [];
        for (const t of tables) {
          const { table } = await dataSource.describeTable({ sourceId: source.id, ref: t.ref });
          described.push({ name: t.ref?.table, comment: t.comment, columns: table?.columns.map((c) => `${c.name} ${c.nativeType}`) ?? [] });
        }
        out.push({ sourceId: source.id, tables: described });
      }
      return out.length > 0 ? out : { note: "No data sources are configured on this server." };
    },
  };
}

const NOTES = `
You answer questions about the data on this server. Call list_tables first to see what exists.
Write SQL as a single read-only SELECT and let components run it: Metric for a headline number,
Chart with an aggregate for anything over many rows, DataGrid to show records.
Say what each view shows in one sentence.`;

/** Claude over your data. On a server, `new Anthropic()` reads ANTHROPIC_API_KEY from the environment. */
export function claudeAgent(dataSource: DataSource, client: Anthropic = new Anthropic()): AgentBackend {
  return anthropicAgent({
    client,
    // Defaults: model claude-sonnet-5-5, effort "high", refusal fallbacks on.
    // Pass `fallbacks: false` on Bedrock, Vertex or Foundry, which do not offer them.
    system: `${catalogPrompt(analyticsCatalog)}\n${NOTES}`,
    tools: [listTablesTool(dataSource)],
    // A surface with problems is not drawn; the problems go back to Claude to fix in the same turn.
    checkSurface: (message) => analyticsCatalog.validateMessage(message),
  });
}
