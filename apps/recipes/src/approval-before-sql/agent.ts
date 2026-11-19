import Anthropic from "@anthropic-ai/sdk";
import type { AgentBackend } from "@surfaces-ui/agent";
import { anthropicAgent } from "@surfaces-ui/agent-anthropic";
import type { DataSource } from "@surfaces-ui/data";
import { analyticsCatalog, catalogPrompt } from "@surfaces-ui/spec";
import { approvedQueryTool } from "./tools.js";

/** On the server: Claude with a query tool that waits for a person. The key comes from ANTHROPIC_API_KEY. */
export function analystAgent(dataSource: DataSource): AgentBackend {
  return anthropicAgent({
    client: new Anthropic(),
    system: `${catalogPrompt(analyticsCatalog)}\n\nAnswer questions about the "retail" source. Use run_query to look at data; say what each query is for.`,
    tools: [approvedQueryTool(dataSource, "retail")],
    checkSurface: (message) => analyticsCatalog.validateMessage(message),
    // Your rule for who may allow a query, checked on the server.
    mayDecide: (actor) => Boolean(actor?.id),
  });
}
