import { type AgentBackend, type DescribesAgents, type ModelChunk, type ModelMessage, type ToolCall, type ToolCallingAgentOptions, toolCallingAgent } from "@surfaces-ui/agent";

export interface OpenAiCompatibleOptions {
  /** The API's base URL, ending before `/chat/completions`: `https://api.openai.com/v1`, `http://localhost:11434/v1` (Ollama), a vLLM or LM Studio server. */
  baseUrl: string;
  model: string;
  /**
   * Headers for each request, such as `{ Authorization: "Bearer …" }`.
   * Read the key on a server; never put one in a browser bundle. In a
   * browser, point `baseUrl` at your own server, which adds it.
   */
  headers?: () => Record<string, string> | Promise<Record<string, string>>;
  /** Most tokens per reply. Leave unset to use the server's default. */
  maxTokens?: number;
  /** Fields the server understands beyond the standard ones, sent as they are. */
  extraBody?: Record<string, unknown>;
  /** The transport, for tests or a host's own fetch. */
  fetch?: typeof globalThis.fetch;
}

interface StreamDelta {
  content?: string | null;
  tool_calls?: { index: number; id?: string; function?: { name?: string; arguments?: string } }[];
}
interface StreamChunk {
  model?: string;
  choices?: { delta?: StreamDelta; finish_reason?: string | null }[];
  usage?: { prompt_tokens?: number; completion_tokens?: number } | null;
}

/**
 * `complete` for `toolCallingAgent` over any server that speaks the OpenAI
 * chat completions API with streaming and function calling. Uses `fetch`
 * only, so it runs in Node, workers and browsers.
 */
export function openAiCompatibleComplete(options: OpenAiCompatibleOptions): ToolCallingAgentOptions["complete"] {
  const send = options.fetch ?? globalThis.fetch;
  const url = `${options.baseUrl.replace(/\/+$/, "")}/chat/completions`;
  return async function* complete({ messages, tools, signal, model: chosen }): AsyncIterable<ModelChunk> {
    const response = await send(url, {
      method: "POST",
      signal,
      headers: { "content-type": "application/json", accept: "text/event-stream", ...(await options.headers?.()) },
      body: JSON.stringify({
        ...options.extraBody,
        model: chosen || options.model,
        stream: true,
        stream_options: { include_usage: true },
        ...(options.maxTokens ? { max_tokens: options.maxTokens } : {}),
        messages: toOpenAi(messages),
        ...(tools.length > 0 ? { tools: tools.map((t) => ({ type: "function", function: { name: t.name, description: t.description, parameters: t.inputSchema } })) } : {}),
      }),
    });
    if (!response.ok || !response.body) {
      const detail = await response.text().catch(() => "");
      // The server's own message, without echoing request headers.
      throw new Error(`The model server answered ${response.status}${detail ? `: ${detail.slice(0, 300)}` : ""}`);
    }

    const calls = new Map<number, { id: string; name: string; args: string }>();
    let finish = "";
    let model = options.model;
    for await (const chunk of events(response.body)) {
      if (chunk.model) model = chunk.model;
      if (chunk.usage) yield { type: "usage", inputTokens: chunk.usage.prompt_tokens ?? 0, outputTokens: chunk.usage.completion_tokens ?? 0 };
      for (const choice of chunk.choices ?? []) {
        if (choice.delta?.content) yield { type: "text", delta: choice.delta.content };
        for (const part of choice.delta?.tool_calls ?? []) {
          const call = calls.get(part.index) ?? { id: "", name: "", args: "" };
          call.id ||= part.id ?? "";
          call.name ||= part.function?.name ?? "";
          call.args += part.function?.arguments ?? "";
          calls.set(part.index, call);
        }
        if (choice.finish_reason) finish = choice.finish_reason;
      }
    }

    const made: ToolCall[] = [...calls.entries()].sort(([a], [b]) => a - b).map(([index, c]) => ({ id: c.id || `call_${index}`, name: c.name, input: parseArgs(c.args) }));
    if (finish === "content_filter") {
      yield { type: "error", code: "REFUSED", message: "The model's server filtered this reply." };
      return;
    }
    if (finish === "length" && made.length > 0) {
      yield { type: "error", code: "CUT_OFF", message: "The reply was cut off in the middle of a tool call. Raise maxTokens or ask for less at once." };
      return;
    }
    for (const call of made) yield { type: "tool_call", call };
    yield { type: "done", model };
  };
}

/** An AgentBackend over an OpenAI-compatible server: `toolCallingAgent` with `openAiCompatibleComplete`. */
export function openAiCompatibleAgent(options: OpenAiCompatibleOptions & Omit<ToolCallingAgentOptions, "complete">): AgentBackend & DescribesAgents {
  return toolCallingAgent({ ...options, generatedBy: options.generatedBy ?? options.model, complete: openAiCompatibleComplete(options) });
}

/** Arguments that are not JSON reach the tool as null, which `render_surface` refuses and reports back to the model. */
function parseArgs(text: string): unknown {
  if (!text.trim()) return {};
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export function toOpenAi(messages: ModelMessage[]): Record<string, unknown>[] {
  return messages.map((m) => {
    if (m.role === "tool") return { role: "tool", tool_call_id: m.toolCallId ?? "", content: m.content };
    if (m.role === "assistant" && m.toolCalls?.length) {
      return {
        role: "assistant",
        content: m.content || null,
        tool_calls: m.toolCalls.map((c) => ({ id: c.id, type: "function", function: { name: c.name, arguments: JSON.stringify(c.input ?? {}) } })),
      };
    }
    return { role: m.role, content: m.content };
  });
}

/** The JSON chunks of a server-sent event stream, up to `[DONE]`. */
async function* events(body: ReadableStream<Uint8Array>): AsyncIterable<StreamChunk> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let end = buffer.indexOf("\n");
      while (end >= 0) {
        const line = buffer.slice(0, end).trim();
        buffer = buffer.slice(end + 1);
        end = buffer.indexOf("\n");
        if (!line.startsWith("data:")) continue;
        const data = line.slice(5).trim();
        if (data === "[DONE]") return;
        try {
          yield JSON.parse(data) as StreamChunk;
        } catch {
          // A line that is not JSON (a keep-alive comment) is skipped.
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}
