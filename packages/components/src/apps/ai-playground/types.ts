/**
 * Shared types for the AI Playground
 */

// ── LLM Provider Types ───────────────────────────────────────────────────────

export type ProviderType = 'openai' | 'anthropic' | 'loom';

export interface ProviderPreset {
  id: string;
  name: string;
  type: ProviderType;
  baseUrl: string;
  models: string[];
  defaultModel: string;
  description: string;
}

export interface LLMProviderConfig {
  type: ProviderType;
  apiKey: string;
  baseUrl: string;
  model: string;
  presetId?: string;
}

// ── Page Template Types ──────────────────────────────────────────────────────

export type PageType = 'dashboard' | 'landing' | 'form' | 'survey' | 'control-plane';

export interface PageTemplate {
  id: PageType;
  name: string;
  description: string;
  icon: string;
  examplePrompts: string[];
  systemPromptAddition: string;
  sampleSpec: Record<string, unknown>;
}

// ── Generation State ─────────────────────────────────────────────────────────

export interface GenerationState {
  status: 'idle' | 'generating' | 'validating' | 'complete' | 'error';
  /** Raw accumulated text from LLM response */
  rawText: string;
  /** Parsed and validated json-render spec */
  spec: Record<string, unknown> | null;
  /** Error message if generation or validation failed */
  error: string | null;
  /** Progress estimate (0-1) */
  progress: number;
  /** LLM's explanation of component choices */
  explanation: string | null;
}

// ── Provider Presets ─────────────────────────────────────────────────────────

export const PROVIDER_PRESETS: ProviderPreset[] = [
  {
    id: 'openai',
    name: 'OpenAI',
    type: 'openai',
    baseUrl: 'https://api.openai.com/v1',
    models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4.1', 'gpt-4.1-mini', 'o3-mini'],
    defaultModel: 'gpt-4o',
    description: 'OpenAI GPT models',
  },
  {
    id: 'anthropic',
    name: 'Anthropic',
    type: 'anthropic',
    baseUrl: 'https://api.anthropic.com',
    models: ['claude-sonnet-4-20250514', 'claude-haiku-4-20250514', 'claude-opus-4-20250514'],
    defaultModel: 'claude-sonnet-4-20250514',
    description: 'Anthropic Claude models (may require CORS proxy)',
  },
  {
    id: 'ollama',
    name: 'Ollama',
    type: 'openai',
    baseUrl: 'http://localhost:11434/v1',
    models: ['llama3.3', 'llama3.1', 'mistral', 'codellama', 'qwen2.5'],
    defaultModel: 'llama3.3',
    description: 'Local models via Ollama',
  },
  {
    id: 'groq',
    name: 'Groq',
    type: 'openai',
    baseUrl: 'https://api.groq.com/openai/v1',
    models: ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant', 'mixtral-8x7b-32768'],
    defaultModel: 'llama-3.3-70b-versatile',
    description: 'Fast inference via Groq Cloud',
  },
  {
    id: 'together',
    name: 'Together AI',
    type: 'openai',
    baseUrl: 'https://api.together.xyz/v1',
    models: ['meta-llama/Llama-3.3-70B-Instruct-Turbo', 'mistralai/Mixtral-8x7B-Instruct-v0.1'],
    defaultModel: 'meta-llama/Llama-3.3-70B-Instruct-Turbo',
    description: 'Open models via Together AI',
  },
  {
    id: 'loom',
    name: 'Loom (Bedrock)',
    type: 'loom',
    baseUrl: 'http://localhost:5006',
    models: ['ui-generator'],
    defaultModel: 'ui-generator',
    description: 'Dedicated UI generation agent — Claude Sonnet 4.5 on AWS Bedrock',
  },
  {
    id: 'custom',
    name: 'Custom (OpenAI-compatible)',
    type: 'openai',
    baseUrl: '',
    models: [],
    defaultModel: '',
    description: 'Any OpenAI-compatible API endpoint',
  },
];
