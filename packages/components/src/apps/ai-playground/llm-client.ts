/**
 * Generic LLM Client with Streaming
 *
 * Supports multiple provider types:
 * - OpenAI-compatible (covers OpenAI, Ollama, Together, Groq, vLLM, etc.)
 * - Anthropic (direct Messages API)
 * - Loom (routes to any backend including AWS Bedrock)
 *
 * All streaming is done via async generators for consistent consumption.
 */
import type { LLMProviderConfig } from './types';

/**
 * Stream text generation from any supported LLM provider.
 *
 * Yields text chunks as they arrive from the LLM.
 * The caller accumulates chunks and parses JSON when complete.
 */
export async function* streamGenerate(
  config: LLMProviderConfig,
  systemPrompt: string,
  userPrompt: string,
  signal?: AbortSignal,
): AsyncGenerator<string> {
  switch (config.type) {
    case 'openai':
      yield* streamOpenAI(config, systemPrompt, userPrompt, signal);
      break;
    case 'anthropic':
      yield* streamAnthropic(config, systemPrompt, userPrompt, signal);
      break;
    case 'loom':
      yield* streamLoom(config, systemPrompt, userPrompt, signal);
      break;
    default:
      throw new Error(`Unknown provider type: ${config.type}`);
  }
}

/**
 * Test connection to the configured provider.
 * Returns true if the provider is reachable and the API key is valid.
 */
export async function testConnection(config: LLMProviderConfig): Promise<{ ok: boolean; error?: string }> {
  try {
    switch (config.type) {
      case 'openai': {
        const resp = await fetch(`${config.baseUrl}/models`, {
          headers: { 'Authorization': `Bearer ${config.apiKey}` },
        });
        if (!resp.ok) {
          const text = await resp.text();
          return { ok: false, error: `${resp.status}: ${text.slice(0, 200)}` };
        }
        return { ok: true };
      }
      case 'anthropic': {
        // Anthropic doesn't have a models endpoint, so we send a minimal request
        const resp = await fetch(`${config.baseUrl}/v1/messages`, {
          method: 'POST',
          headers: {
            'x-api-key': config.apiKey,
            'content-type': 'application/json',
            'anthropic-version': '2023-06-01',
            'anthropic-dangerous-direct-browser-access': 'true',
          },
          body: JSON.stringify({
            model: config.model,
            max_tokens: 1,
            messages: [{ role: 'user', content: 'Hi' }],
          }),
        });
        if (!resp.ok) {
          const text = await resp.text();
          return { ok: false, error: `${resp.status}: ${text.slice(0, 200)}` };
        }
        return { ok: true };
      }
      case 'loom': {
        const resp = await fetch(`${config.baseUrl}/health`);
        if (!resp.ok) {
          return { ok: false, error: `Loom server returned ${resp.status}` };
        }
        return { ok: true };
      }
      default:
        return { ok: false, error: `Unknown provider type: ${config.type}` };
    }
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Connection failed',
    };
  }
}

// ── OpenAI-Compatible Streaming ──────────────────────────────────────────────

async function* streamOpenAI(
  config: LLMProviderConfig,
  systemPrompt: string,
  userPrompt: string,
  signal?: AbortSignal,
): AsyncGenerator<string> {
  const response = await fetch(`${config.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model: config.model,
      stream: true,
      temperature: 0.3,
      max_tokens: 8192,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
    }),
    signal,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`OpenAI API error ${response.status}: ${text.slice(0, 500)}`);
  }

  if (!response.body) {
    throw new Error('Response body is null');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed === 'data: [DONE]') continue;
      if (!trimmed.startsWith('data: ')) continue;

      try {
        const json = JSON.parse(trimmed.slice(6));
        const content = json.choices?.[0]?.delta?.content;
        if (content) {
          yield content;
        }
      } catch {
        // Skip malformed JSON chunks
      }
    }
  }
}

// ── Anthropic Messages API Streaming ─────────────────────────────────────────

async function* streamAnthropic(
  config: LLMProviderConfig,
  systemPrompt: string,
  userPrompt: string,
  signal?: AbortSignal,
): AsyncGenerator<string> {
  const response = await fetch(`${config.baseUrl}/v1/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': config.apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: config.model,
      stream: true,
      max_tokens: 8192,
      temperature: 0.3,
      system: systemPrompt,
      messages: [
        { role: 'user', content: userPrompt },
      ],
    }),
    signal,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Anthropic API error ${response.status}: ${text.slice(0, 500)}`);
  }

  if (!response.body) {
    throw new Error('Response body is null');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      if (trimmed.startsWith('data: ')) {
        try {
          const json = JSON.parse(trimmed.slice(6));
          if (json.type === 'content_block_delta' && json.delta?.text) {
            yield json.delta.text;
          }
        } catch {
          // Skip malformed JSON chunks
        }
      }
    }
  }
}

// ── Loom Bridge (Non-Streaming) ──────────────────────────────────────────────

/** Dedicated Loom agent for UI generation (Bedrock Claude Sonnet 4.5) */
const LOOM_UI_AGENT_ID = 'ui-generator';

/** Track Loom session per browser session — reuse until user resets */
let loomSessionId = '';

/**
 * Reset the Loom session (e.g., when user starts over).
 * Next generation will create a fresh session.
 */
export function resetLoomSession(): void {
  loomSessionId = '';
}

async function* streamLoom(
  config: LLMProviderConfig,
  systemPrompt: string,
  userPrompt: string,
  signal?: AbortSignal,
): AsyncGenerator<string> {
  // Loom processes the full prompt via its agent system
  // The system prompt is embedded in the query context
  const query = `${systemPrompt}\n\n---\n\nUser request: ${userPrompt}\n\nIMPORTANT: Respond ONLY with a valid JSON object in the json-render spec format. Do not include any explanation, markdown, or other text.`;

  // Use dedicated ui-generator agent, fall back to model name or default
  const agentId = config.model === 'default' || config.model === LOOM_UI_AGENT_ID
    ? LOOM_UI_AGENT_ID
    : config.model;

  const response = await fetch(`${config.baseUrl}/v1/weave`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query,
      session_id: loomSessionId,
      agent_id: agentId,
      timeout_seconds: 300,
    }),
    signal,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Loom API error ${response.status}: ${text.slice(0, 500)}`);
  }

  const data = await response.json();

  // Capture session ID from response for reuse in subsequent generations
  if (data?.sessionId) {
    loomSessionId = data.sessionId;
  }

  // Extract the text content from Loom's response
  // Loom weave returns { text, sessionId, cost, agentId } — the spec is in the `text` field
  const content = data?.text || data?.response || data?.result || data?.content;
  if (!content) {
    throw new Error(
      `Unexpected Loom response format. Expected a "text" field but got keys: ${JSON.stringify(Object.keys(data))}`
    );
  }
  const text = typeof content === 'string' ? content : JSON.stringify(content);

  // Yield the full response at once (non-streaming)
  yield text;
}
