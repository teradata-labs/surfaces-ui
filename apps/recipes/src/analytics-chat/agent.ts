import { type AgentBackend, type DescribesAgents, type ModelChunk, type ToolCallingAgentOptions, dataTools, toolCallingAgent } from "@surfaces-ui/agent";
import type { DataSource } from "@surfaces-ui/data";

/**
 * What a person may choose for this agent: two models, two skills and one
 * connector. The backend checks every turn against it; the client is never
 * trusted to turn on something not listed.
 */
export function analystAgent(dataSource: DataSource, complete: ToolCallingAgentOptions["complete"]): AgentBackend & DescribesAgents {
  const tools = dataTools(dataSource);
  return toolCallingAgent({
    system: "You answer questions about the person's data.",
    tools,
    complete,
    offer: {
      id: "analyst",
      name: "Analyst",
      models: [
        { id: "claude-sonnet-5-5", label: "Claude Sonnet 5.5" },
        { id: "claude-opus-5-5", label: "Claude Opus 5.5" },
      ],
      defaultModel: "claude-sonnet-5-5",
      skills: [
        { id: "charts", name: "Chart standards", text: "Bars start at zero. One y scale.", defaultOn: true },
        { id: "terse", name: "Short answers", text: "Answer in two sentences at most.", defaultOn: false },
      ],
      // Tools no connector names are always on; these are on only while the connector is.
      connectors: [{ id: "catalog", name: "Data catalog", description: "List and describe tables", tools: tools.map((t) => t.name) }],
    },
  });
}

/** A stand-in for a model, for the test: it says which model it was asked to be. */
export async function* echoModel({ model }: { model?: string }): AsyncIterable<ModelChunk> {
  yield { type: "text", delta: `Answered by ${model}.` };
  yield { type: "done", model: model ?? "" };
}
