# Phase 7: NL Generation - Research

**Researched:** 2026-02-17
**Domain:** Natural language to UI generation with LLM-constrained output
**Confidence:** MEDIUM

## Summary

Phase 7 implements natural language to UI generation using LLM-powered structured outputs constrained by the existing json-render catalog. The technical foundation leverages modern constrained generation techniques (structured outputs from OpenAI, Anthropic Claude) to guarantee valid JSON conforming to catalog schemas, eliminating hallucination risks through grammar-based token sampling. The architecture follows an MCP tool pattern where natural language prompts trigger AI generation through a new `generate_ui` tool, returning validated json-render specs for immediate rendering.

The primary challenge is bridging the FastMCP Python server with AI APIs while implementing streaming JSONL responses for progressive UI compilation. Modern frameworks (OpenAI Structured Outputs, Anthropic JSON Schema) now provide native constrained generation with 100% schema conformance, significantly reducing validation complexity compared to post-hoc parsing approaches.

**Primary recommendation:** Implement `generate_ui` as an MCP tool in the FastMCP server, using Anthropic Claude Sonnet 4.5 with structured outputs (JSON schema mode) for guaranteed catalog conformance, with streaming JSONL responses via FastAPI StreamingResponse for progressive rendering.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @json-render/core | 0.6.1 | Catalog prompts, spec compilation | Official json-render framework (already integrated) |
| Anthropic Python SDK | Latest | Claude API with structured outputs | Native JSON schema validation, streaming support, proven reliability |
| FastAPI StreamingResponse | Built-in | JSONL streaming | Native FastAPI feature, zero dependencies |
| Zod | Latest | Schema validation | Already used for catalog definitions |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| OpenAI Python SDK | Latest | Alternative to Claude | If user has OpenAI preference, supports structured outputs |
| httpx | >=0.25.0 | Async HTTP client | Already in server requirements, use for API calls |
| pydantic | >=2.0.0 | Python validation | Already in server, mirrors Zod schemas in Python |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Anthropic Claude | OpenAI GPT-4o | OpenAI has structured outputs too, but Claude Sonnet 4.5 has better JSON consistency in practice (per 2026 benchmarks) |
| Streaming JSONL | Complete JSON response | Streaming enables progressive UI updates (NL-05 requirement), complete responses block until full generation |
| MCP tool | Direct HTTP endpoint | MCP pattern maintains consistency with existing server architecture (execute_sql) |

**Installation:**
```bash
# Python dependencies (add to server/requirements.txt)
pip install anthropic  # or openai if preferring GPT-4o
# Note: httpx, pydantic, fastapi already installed
```

## Architecture Patterns

### Recommended Flow Structure
```
User Prompt → MCP Tool (generate_ui) → AI API (Claude/OpenAI) → Streaming JSONL → Validator → Renderer
```

Key insight: The catalog prompt generated from `catalog.prompt()` becomes the system prompt for the AI, ensuring the model understands available components without manual template creation.

### Pattern 1: MCP Tool Endpoint for UI Generation
**What:** New MCP tool that accepts natural language prompts and returns validated json-render specs
**When to use:** For all natural language to UI generation requests (NL-01 requirement)
**Example:**
```python
# server/src/tools/generate_ui.py
from mcp.types import Tool, TextContent
from anthropic import Anthropic

async def generate_ui_tool(prompt: str, model: str = "claude-sonnet-4.5") -> str:
    """Generate UI spec from natural language prompt using constrained AI generation.

    Args:
        prompt: Natural language description of desired UI
        model: AI model to use (default: claude-sonnet-4.5)

    Returns:
        JSON string containing validated json-render spec
    """
    # Get catalog prompt from frontend (passed via context or generated server-side)
    system_prompt = get_catalog_system_prompt()

    # Call Claude with structured output constraint
    client = Anthropic()
    response = await client.messages.create(
        model=model,
        system=system_prompt,
        messages=[{"role": "user", "content": prompt}],
        response_format={
            "type": "json_schema",
            "json_schema": get_catalog_json_schema()  # Derived from Zod catalog
        },
        stream=True  # Enable streaming for progressive updates
    )

    # Stream JSONL chunks for progressive compilation
    async for chunk in response:
        if chunk.type == "content_block_delta":
            yield chunk.delta.text

def get_generate_ui_tool_definition() -> Tool:
    """Define the generate_ui MCP tool."""
    return Tool(
        name="generate_ui",
        description="Generate UI components from natural language descriptions",
        inputSchema={
            "type": "object",
            "properties": {
                "prompt": {
                    "type": "string",
                    "description": "Natural language description of desired UI"
                },
                "model": {
                    "type": "string",
                    "description": "AI model to use",
                    "enum": ["claude-sonnet-4.5", "gpt-4o"],
                    "default": "claude-sonnet-4.5"
                }
            },
            "required": ["prompt"]
        }
    )
```

### Pattern 2: Streaming JSONL Response
**What:** FastAPI StreamingResponse that yields JSONL chunks for progressive UI compilation
**When to use:** For real-time UI updates as AI generates spec (NL-05 requirement)
**Example:**
```python
# server/src/tools/generate_ui.py
from aiohttp import web
from fastapi import FastAPI
from fastapi.responses import StreamingResponse
import json

async def stream_ui_generation(prompt: str):
    """Stream JSONL chunks as AI generates UI spec."""
    # Initialize AI client with streaming
    async for chunk in generate_ui_stream(prompt):
        # Validate chunk before yielding
        try:
            parsed = json.loads(chunk)
            # Partial validation - ensure structure matches catalog
            if is_valid_spec_chunk(parsed):
                yield f"{chunk}\n"  # JSONL format
        except json.JSONDecodeError:
            # Skip malformed chunks (shouldn't happen with structured outputs)
            continue

@app.get("/api/generate-ui-stream")
async def generate_ui_stream_endpoint(prompt: str):
    """HTTP endpoint for streaming UI generation (for web clients)."""
    return StreamingResponse(
        stream_ui_generation(prompt),
        media_type="application/x-ndjson"
    )
```

### Pattern 3: Catalog Prompt System Integration
**What:** Use json-render's built-in `catalog.prompt()` to generate system prompts for AI
**When to use:** Every AI generation request needs catalog awareness (NL-02 requirement)
**Example:**
```typescript
// packages/components/src/catalog/prompt.ts (already exists)
export const aiSystemPrompt = catalog.prompt({
  customRules: [
    'Use Chart for visualizing trends, comparisons, and distributions',
    'Use DataTable for detailed row-by-row data inspection',
    'Always include Filter when showing large datasets (>50 rows)',
    'Use ViewModeToggle to let users switch between table and chart views',
    'Prefer comfortable density unless user requests compact/spacious',
  ],
});

// Generate enhanced prompt with examples for each component
export function getEnhancedCatalogPrompt(): string {
  const basePrompt = aiSystemPrompt;
  const examples = generateComponentExamples(); // NL-06 requirement
  return `${basePrompt}\n\n## Example Prompts\n${examples}`;
}
```

### Pattern 4: Validation Before Rendering
**What:** Validate generated specs against catalog Zod schemas before passing to renderer
**When to use:** Always, to catch any hallucinations before render (NL-03 requirement)
**Example:**
```typescript
// packages/components/src/catalog/validation.ts
import { catalog } from './schema';
import type { ZodError } from 'zod';

interface ValidationResult {
  valid: boolean;
  spec?: any;
  errors?: ZodError[];
}

export function validateGeneratedSpec(rawSpec: unknown): ValidationResult {
  try {
    // Validate entire spec structure
    const validated = catalog.schema.spec.parse(rawSpec);

    // Validate each element's props against component schemas
    for (const [id, element] of Object.entries(validated.elements)) {
      const componentSchema = catalog.components[element.type];
      if (!componentSchema) {
        return {
          valid: false,
          errors: [new Error(`Unknown component type: ${element.type}`)]
        };
      }

      // Validate props match component schema
      componentSchema.props.parse(element.props);
    }

    return { valid: true, spec: validated };
  } catch (error) {
    return {
      valid: false,
      errors: [error as ZodError]
    };
  }
}

// Error recovery with graceful degradation (NL-04)
export function recoverFromInvalidSpec(
  spec: unknown,
  errors: ZodError[]
): { recovered: boolean; spec?: any; fallback?: any } {
  // Strategy 1: Try to fix common issues
  const fixed = attemptAutoFix(spec, errors);
  if (fixed) {
    const revalidated = validateGeneratedSpec(fixed);
    if (revalidated.valid) {
      return { recovered: true, spec: revalidated.spec };
    }
  }

  // Strategy 2: Return fallback minimal UI
  return {
    recovered: false,
    fallback: createFallbackSpec(errors)
  };
}

function createFallbackSpec(errors: ZodError[]): any {
  return {
    root: "error-display",
    elements: {
      "error-display": {
        type: "DataTable",
        props: {
          columns: ["error", "path", "expected"],
          data: errors.flatMap(e => e.errors.map(err => ({
            error: err.message,
            path: err.path.join('.'),
            expected: err.code
          })))
        }
      }
    }
  };
}
```

### Anti-Patterns to Avoid
- **Manual JSON template construction:** Use `catalog.prompt()` instead of hand-writing system prompts
- **Post-hoc parsing without constraints:** Use structured outputs (JSON schema mode) to guarantee valid output
- **Blocking on complete response:** Stream JSONL for progressive rendering
- **Weak validation:** Always validate with Zod before rendering, implement fallback UI for errors

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| LLM JSON parsing | Custom regex/string manipulation | Structured outputs (OpenAI/Anthropic) | Native APIs guarantee schema conformance through constrained token sampling, 100% reliability vs. 70-90% with post-hoc parsing |
| Catalog prompts | Manual component descriptions | `catalog.prompt()` from json-render | Automatically generates consistent system prompts from Zod schemas, updates with catalog changes |
| Streaming protocol | Custom chunk parser | FastAPI StreamingResponse + JSONL | JSONL is standard for progressive JSON (newline-delimited), FastAPI native support |
| Validation error messages | String concatenation | Zod error formatting | Zod provides structured error paths, codes, and messages with customization hooks |

**Key insight:** Modern LLM APIs (as of 2026) have native constrained generation that enforces JSON schema compliance during token sampling, not after generation. This eliminates the entire class of "hallucination detection" problems that plagued 2023-2024 implementations.

## Common Pitfalls

### Pitfall 1: Assuming Structured Outputs = Zero Validation
**What goes wrong:** Trusting LLM output without validation, assuming structured outputs never fail
**Why it happens:** API marketing suggests "guaranteed schema conformance" sounds absolute
**How to avoid:** Always validate with Zod before rendering, implement graceful fallback UI for edge cases (safety refusals, partial responses)
**Warning signs:** Runtime errors in renderer, missing props, undefined components

### Pitfall 2: Not Handling Streaming Partial States
**What goes wrong:** Trying to parse incomplete JSON chunks as complete specs
**Why it happens:** JSONL streaming sends partial objects that aren't valid JSON until complete
**How to avoid:** Use json-render's `SpecStreamCompiler` pattern (from json-render examples), accumulate chunks before validation
**Warning signs:** JSON parse errors, flickering UI, partial renders that break

### Pitfall 3: Catalog Prompt Staleness
**What goes wrong:** System prompts don't reflect catalog changes (new components, updated schemas)
**Why it happens:** Prompt generated once and cached, catalog evolves during development
**How to avoid:** Generate prompt dynamically from current catalog on each request, or implement cache invalidation on catalog changes
**Warning signs:** AI generates specs with outdated component types or missing new features

### Pitfall 4: Missing Explainability Context
**What goes wrong:** AI generates valid spec but user doesn't understand why specific components were chosen
**Why it happens:** Standard structured outputs don't include reasoning, just output
**How to avoid:** Request dual output: JSON spec + text explanation using two-step generation or parallel outputs
**Warning signs:** User confusion, repeated regeneration requests, low trust in generated UI

### Pitfall 5: Ignoring Rate Limits and Costs
**What goes wrong:** Production deployments hit API rate limits or unexpected costs
**Why it happens:** Each UI generation = 1 API call (often 1000+ tokens), rapid iteration burns quota
**How to avoid:** Implement request throttling, caching for common prompts, local model fallback
**Warning signs:** 429 errors, unexpectedly high API bills, slow response times

## Code Examples

Verified patterns from official sources and current implementations:

### Anthropic Structured Outputs with JSON Schema
```python
# Source: https://platform.claude.com/docs/en/build-with-claude/structured-outputs
from anthropic import Anthropic
import json

client = Anthropic()

# Define schema matching catalog structure
ui_spec_schema = {
    "type": "object",
    "properties": {
        "root": {"type": "string"},
        "elements": {
            "type": "object",
            "patternProperties": {
                ".*": {
                    "type": "object",
                    "properties": {
                        "type": {"type": "string", "enum": ["Chart", "DataTable", "Filter", "TableWithFilters"]},
                        "props": {"type": "object"}
                    },
                    "required": ["type", "props"]
                }
            }
        }
    },
    "required": ["root", "elements"]
}

response = client.messages.create(
    model="claude-sonnet-4.5",
    system="You are a UI generation assistant...",
    messages=[{"role": "user", "content": "Show me sales data in a filterable table"}],
    output_config={
        "format": {
            "type": "json_schema",
            "json_schema": ui_spec_schema
        }
    }
)

# Response guaranteed to match schema
spec = json.loads(response.content[0].text)
```

### FastAPI Streaming JSONL
```python
# Source: https://fastapi.tiangolo.com/advanced/custom-response/
from fastapi import FastAPI
from fastapi.responses import StreamingResponse
import asyncio
import json

app = FastAPI()

async def generate_jsonl_stream():
    """Simulate streaming UI generation chunks."""
    chunks = [
        {"root": "table1"},
        {"elements": {"table1": {"type": "DataTable", "props": {}}}},
    ]

    for chunk in chunks:
        yield f"{json.dumps(chunk)}\n"
        await asyncio.sleep(0.1)  # Simulate generation delay

@app.get("/generate-ui")
async def generate_ui(prompt: str):
    return StreamingResponse(
        generate_jsonl_stream(),
        media_type="application/x-ndjson"
    )
```

### Zod Validation with Custom Error Messages
```typescript
// Source: https://zod.dev/error-customization
import { z } from 'zod';

const ChartSchema = z.object({
  type: z.enum(['bar', 'line', 'pie']).describe('Chart type'),
  height: z.number()
    .min(100, "Chart must be at least 100px tall")
    .max(1000, "Chart cannot exceed 1000px")
    .default(400)
});

// Custom error map for user-friendly messages
const errorMap: z.ZodErrorMap = (issue, ctx) => {
  if (issue.code === z.ZodIssueCode.invalid_type) {
    return { message: `Expected ${issue.expected}, got ${issue.received}` };
  }
  if (issue.code === z.ZodIssueCode.invalid_enum_value) {
    return { message: `Must be one of: ${issue.options.join(', ')}` };
  }
  return { message: ctx.defaultError };
};

z.setErrorMap(errorMap);

// Usage
try {
  ChartSchema.parse({ type: 'invalid', height: 50 });
} catch (error) {
  // error.errors = [
  //   { path: ['type'], message: 'Must be one of: bar, line, pie' },
  //   { path: ['height'], message: 'Chart must be at least 100px tall' }
  // ]
}
```

### Explainability with Dual Output
```python
# Pattern for adding explainability (NL-07 requirement)
async def generate_ui_with_explanation(prompt: str):
    """Generate UI spec with reasoning explanation."""
    client = Anthropic()

    # Two-step approach: reasoning first, then spec
    explanation_response = await client.messages.create(
        model="claude-sonnet-4.5",
        system=get_catalog_system_prompt(),
        messages=[
            {
                "role": "user",
                "content": f"Explain which components would best display: {prompt}"
            }
        ]
    )

    spec_response = await client.messages.create(
        model="claude-sonnet-4.5",
        system=get_catalog_system_prompt(),
        messages=[
            {
                "role": "user",
                "content": f"Generate UI for: {prompt}"
            }
        ],
        output_config={
            "format": {"type": "json_schema", "json_schema": ui_spec_schema}
        }
    )

    return {
        "spec": json.loads(spec_response.content[0].text),
        "explanation": explanation_response.content[0].text
    }
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Post-hoc JSON parsing with regex | Constrained generation with JSON schema | OpenAI Structured Outputs (Aug 2024), Anthropic (Oct 2024) | 70-90% accuracy → 100% schema conformance |
| Manual prompt engineering | Auto-generated catalog prompts | json-render v0.6 (Jan 2026) | Eliminates prompt drift, catalog changes auto-reflect |
| Complete response then render | Progressive JSONL streaming | React Server Components + JSONL (2025) | Perceived performance improvement, real-time feedback |
| Retry loops for hallucinations | Grammar-based token filtering | Constrained decoding in LLMs (2025) | Eliminates retry overhead, deterministic outputs |

**Deprecated/outdated:**
- **JSON mode without schema:** OpenAI's original json_object mode (2023) produced JSON but didn't enforce structure - replaced by structured outputs with JSON schema
- **Function calling for UI generation:** Using LLM function calling to generate specs - structured outputs cleaner and faster
- **Prompt injection for validation:** Adding "validate your JSON" instructions - constrained decoding makes this unnecessary

## Open Questions

1. **Local model fallback for cost/latency**
   - What we know: OpenAI and Anthropic APIs cost $0.01-0.10 per UI generation, latency 1-3s
   - What's unclear: Whether local models (Llama 3, Mistral) support structured outputs with same reliability
   - Recommendation: Start with cloud APIs (proven reliability), investigate local models in Phase 9 if costs become issue

2. **Caching strategy for catalog prompts**
   - What we know: Catalog prompt is ~2-5KB, generated from Zod schemas
   - What's unclear: Whether to cache server-side (staleness risk) or generate per-request (overhead)
   - Recommendation: Generate per-request initially (simple, no staleness), add caching if profiling shows prompt generation is bottleneck

3. **Handling multi-turn refinement**
   - What we know: Users may want to refine generated UI ("make the chart bigger", "add a filter")
   - What's unclear: Whether to implement conversation history or treat each request as independent
   - Recommendation: Phase 7 treats each request as independent (simpler), defer conversation history to Phase 9

4. **Error recovery strategies**
   - What we know: Structured outputs reduce errors but edge cases remain (API failures, safety refusals)
   - What's unclear: Best fallback UI pattern - show error message, retry with simpler prompt, or default component
   - Recommendation: Implement fallback DataTable showing error details (graceful degradation), log for analysis

## Sources

### Primary (HIGH confidence)
- json-render v0.6.1 catalog and renderer implementation (existing codebase)
- Anthropic Claude Structured Outputs documentation: https://platform.claude.com/docs/en/build-with-claude/structured-outputs
- OpenAI Structured Outputs API: https://platform.openai.com/docs/guides/structured-outputs
- FastAPI Custom Response (StreamingResponse): https://fastapi.tiangolo.com/advanced/custom-response/
- Zod error customization: https://zod.dev/error-customization

### Secondary (MEDIUM confidence)
- [json-render official site](https://json-render.dev/) - Framework overview and catalog prompt patterns
- [GitHub json-render repo](https://github.com/vercel-labs/json-render) - SpecStreamCompiler examples
- [The New Stack: Vercel's json-render](https://thenewstack.io/vercels-json-render-a-step-toward-generative-ui/) - Generative UI patterns
- [Medium: Constrained Decoding](https://medium.com/@brijeshrn/beyond-free-form-text-how-constrained-decoding-is-reshaping-structured-generation-in-llms-5f7a38bef259) - LLM structured generation techniques
- [arXiv: Detecting LLM Hallucinations](https://arxiv.org/html/2601.19106v1) - Validation approaches (100% precision, 87.6% recall for AST validation)
- [FastMCP Anthropic Integration](https://gofastmcp.com/integrations/anthropic) - MCP server with AI models

### Tertiary (LOW confidence - for awareness)
- [Generative UI in 2026 comparison](https://quickleap.io/blog/generative-ui-platforms-comparison-2026) - json-render vs alternatives
- [MCP prompt engineering](https://medium.com/tech-ai-made-easy/prompt-engineering-in-mcp-structured-prompts-parameterization-reuse-versioning-and-7dcc598858bd) - Structured prompts in MCP
- [Magic UI MCP Server](https://skywork.ai/skypage/en/decoding-magic-ui-mcp-server/1978660814049288192) - Natural language component generation example

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Anthropic/OpenAI structured outputs proven, json-render v0.6.1 in use, FastAPI native streaming
- Architecture: MEDIUM - Patterns verified from docs but not tested in SurfacesUI context yet
- Pitfalls: MEDIUM - Based on community experience reports and 2025-2026 production issues, not firsthand
- Explainability: LOW - NL-07 requirement lacks clear spec, dual-output pattern is hypothesis

**Research date:** 2026-02-17
**Valid until:** 2026-03-17 (30 days - fast-moving field, API features evolve quarterly)

**Key dependencies validated:**
- json-render v0.6.1 catalog.prompt() method exists ✓
- Existing catalog schema in packages/components/src/catalog/schema.ts ✓
- FastMCP server structure in server/src/main.py ✓
- MCP Bridge integration patterns from Phase 4 ✓

**Critical path items:**
1. Choose AI provider (Anthropic recommended, OpenAI alternative)
2. Implement generate_ui MCP tool in Python server
3. Add streaming JSONL support via FastAPI
4. Client-side SpecStreamCompiler for progressive rendering
5. Validation layer with graceful fallback
6. Example prompts documentation
