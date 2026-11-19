import Anthropic from "@anthropic-ai/sdk";
import { type AgentBackend, type DescribesAgents, type ModelChunk, type ModelMessage, type ToolCallingAgentOptions, type ToolDefinition, toolCallingAgent } from "@surfaces-ui/agent";

type MessageParam = Anthropic.Beta.Messages.BetaMessageParam;
type ContentBlockParam = Anthropic.Beta.Messages.BetaContentBlockParam;
type ToolParam = Anthropic.Beta.Messages.BetaTool;
type ToolResult = Anthropic.Beta.Messages.BetaToolResultBlockParam;

export type Effort = "low" | "medium" | "high" | "xhigh" | "max";

export interface AnthropicOptions {
  /**
   * A client you construct, so credentials stay yours: on a server,
   * `new Anthropic()` reads them from the environment. Never put an API key
   * in a browser bundle; in a browser, point `baseURL` at your own server,
   * which adds the key.
   */
  client: Anthropic;
  /** Default `claude-sonnet-5-5`. */
  model?: string;
  /** Default 64000; replies stream, so a high ceiling does not time out. */
  maxTokens?: number;
  /** How hard the model works. Default "high"; "low" suits quick chat. */
  effort?: Effort;
  /**
   * Server-side refusal fallback: when the model declines, the API re-runs
   * the request on a fallback model in the same call. "default" (the
   * default) lets the API choose by the kind of refusal; false turns it off.
   * Not available on Bedrock, Vertex or Foundry: pass false there.
   */
  fallbacks?: "default" | false;
  /** Cache the system prompt (the catalog prompt is long and does not change). Default true. */
  cacheSystem?: boolean;
}

/** Retries of one model call whose streamed tool input could not be parsed at all. */
const JSON_RETRIES = 2;

/**
 * `complete` for `toolCallingAgent` over Claude: maps the neutral messages
 * and tools onto the Messages API, streams text as it arrives, and returns
 * tool calls. Each assistant turn is kept as the API returned it (`raw`) and
 * sent back unchanged, as current models require. A refusal or a reply cut
 * off in the middle of a tool call stops the turn instead of running tools.
 */
export function anthropicComplete(options: AnthropicOptions): ToolCallingAgentOptions["complete"] {
  const { client, model = "claude-sonnet-5-5", maxTokens = 64000, effort = "high", fallbacks = "default", cacheSystem = true } = options;
  return async function* complete({ messages, tools, signal, model: chosen }): AsyncIterable<ModelChunk> {
    const { system, history } = toAnthropic(messages, cacheSystem);
    const params = {
      // A model the person chose for this turn, which the agent's offer allowed; otherwise the configured one.
      model: chosen || model,
      max_tokens: maxTokens,
      ...(system.length > 0 ? { system } : {}),
      messages: history,
      tools: tools.map(toTool),
      output_config: { effort },
      ...(fallbacks ? { betas: ["server-side-fallback-2026-07-01"], fallbacks } : {}),
    } as Anthropic.Beta.Messages.MessageCreateParamsStreaming;

    let message: Anthropic.Beta.Messages.BetaMessage | undefined;
    for (let attempt = 0; !message; attempt++) {
      const stream = client.beta.messages.stream(params, { signal });
      try {
        for await (const event of stream) {
          if (event.type === "content_block_delta" && event.delta.type === "text_delta") yield { type: "text", delta: event.delta.text };
        }
        message = await stream.finalMessage();
      } catch (error) {
        // Only an unparseable streamed tool input is retried; API errors go to the caller.
        if (error instanceof Anthropic.APIError || signal?.aborted || attempt >= JSON_RETRIES) throw error;
      }
    }

    yield { type: "usage", inputTokens: message.usage.input_tokens + (message.usage.cache_read_input_tokens ?? 0) + (message.usage.cache_creation_input_tokens ?? 0), outputTokens: message.usage.output_tokens };
    const raw = message.content;
    if (message.stop_reason === "refusal") {
      const details = message.stop_details as { explanation?: string | null } | null | undefined;
      yield { type: "error", code: "REFUSED", message: details?.explanation || "The model declined to answer this.", raw };
      return;
    }
    const calls = message.content.filter((b): b is Anthropic.Beta.Messages.BetaToolUseBlock => b.type === "tool_use");
    if (calls.length > 0 && message.stop_reason === "max_tokens") {
      yield { type: "error", code: "CUT_OFF", message: "The reply was cut off in the middle of a tool call. Raise maxTokens or ask for less at once.", raw };
      return;
    }
    for (const call of calls) yield { type: "tool_call", call: { id: call.id, name: call.name, input: call.input } };
    yield { type: "done", model: message.model, raw };
  };
}

/** An AgentBackend over Claude: `toolCallingAgent` with `anthropicComplete`. */
export function anthropicAgent(options: AnthropicOptions & Omit<ToolCallingAgentOptions, "complete">): AgentBackend & DescribesAgents {
  return toolCallingAgent({ ...options, generatedBy: options.generatedBy ?? options.model ?? "claude-sonnet-5-5", complete: anthropicComplete(options) });
}

function toTool(tool: ToolDefinition): ToolParam {
  return {
    name: tool.name,
    description: tool.description,
    input_schema: tool.inputSchema as ToolParam["input_schema"],
    // Large inputs (a page of A2UI) stream as they are written. The server then does not check them, so the agent does.
    eager_input_streaming: true,
  };
}

/** Neutral messages as the Messages API takes them: the system prompt apart, tool results grouped into one user message. */
export function toAnthropic(messages: ModelMessage[], cacheSystem = true): { system: Anthropic.Beta.Messages.BetaTextBlockParam[]; history: MessageParam[] } {
  const system: Anthropic.Beta.Messages.BetaTextBlockParam[] = [];
  const history: MessageParam[] = [];
  let results: ToolResult[] = [];
  const flush = () => {
    if (results.length > 0) history.push({ role: "user", content: results });
    results = [];
  };
  for (const m of messages) {
    if (m.role === "system") {
      system.push({ type: "text", text: m.content, ...(cacheSystem ? { cache_control: { type: "ephemeral" as const } } : {}) });
    } else if (m.role === "tool") {
      results.push({ type: "tool_result", tool_use_id: m.toolCallId ?? "", content: m.content, ...(m.isError ? { is_error: true } : {}) });
    } else if (m.role === "user") {
      flush();
      history.push({ role: "user", content: m.content });
    } else {
      flush();
      if (Array.isArray(m.raw)) {
        history.push({ role: "assistant", content: m.raw as ContentBlockParam[] });
        continue;
      }
      const content: ContentBlockParam[] = [];
      if (m.content) content.push({ type: "text", text: m.content });
      for (const call of m.toolCalls ?? []) content.push({ type: "tool_use", id: call.id, name: call.name, input: call.input as Record<string, unknown> });
      if (content.length > 0) history.push({ role: "assistant", content });
    }
  }
  flush();
  return { system, history };
}
