---
phase: 07-nl-generation
plan: 01
subsystem: ai-generation
tags: [anthropic, openai, aws-bedrock, claude, gpt-4, llm, natural-language, ui-generation]

# Dependency graph
requires:
  - phase: 02-catalog-definitions
    provides: Component catalog schema and prompts for AI generation
provides:
  - LLM provider abstraction supporting AWS Bedrock, Anthropic, and OpenAI
  - generate_ui MCP tool for natural language UI generation
  - HTTP streaming endpoint for progressive UI generation
  - Component catalog system prompt with json-render spec output
affects: [07-nl-generation, nl-editor, ai-assisted-workflows]

# Tech tracking
tech-stack:
  added: [anthropic>=0.40.0, openai>=1.0.0, boto3>=1.34.0]
  patterns: [provider-abstraction, structured-output, streaming-jsonl]

key-files:
  created:
    - server/src/llm/provider.py
    - server/src/llm/bedrock.py
    - server/src/llm/anthropic_provider.py
    - server/src/llm/openai_provider.py
    - server/src/tools/generate_ui.py
  modified:
    - server/requirements.txt
    - server/src/tools/__init__.py
    - server/src/main.py

key-decisions:
  - "Use provider abstraction pattern for multi-LLM support (Bedrock, Anthropic, OpenAI)"
  - "Default to AWS Bedrock with SSO support for enterprise auth workflows"
  - "Use structured output (tools/json_schema) to constrain LLM responses to valid json-render specs"
  - "Provide both MCP tool (call_tool) and HTTP streaming endpoint (/api/generate-ui)"
  - "Stream via JSONL for progressive UI updates in web interfaces"

patterns-established:
  - "LLMProvider abstract base class with generate/stream/is_configured methods"
  - "Factory function (get_llm_provider) reads LLM_PROVIDER env var"
  - "Structured output via tool calling for guaranteed valid JSON"
  - "HTTP streaming with NDJSON (application/x-ndjson) content type"

# Metrics
duration: 4min
completed: 2026-02-17
---

# Phase 7 Plan 1: LLM Provider Integration Summary

**Multi-provider LLM abstraction with AWS Bedrock (SSO), Anthropic, and OpenAI supporting structured json-render spec generation via MCP tool and streaming HTTP endpoint**

## Performance

- **Duration:** 4 minutes
- **Started:** 2026-02-17T13:57:19Z
- **Completed:** 2026-02-17T14:01:10Z
- **Tasks:** 3
- **Files modified:** 9 (6 created, 3 modified)

## Accomplishments
- Provider abstraction layer supporting three LLM providers with unified interface
- generate_ui MCP tool accepting natural language prompts and returning json-render specs
- HTTP streaming endpoint for progressive UI generation (/api/generate-ui)
- Component catalog system prompt listing all available primitives, molecules, and organisms
- Structured output enforcement using provider-specific mechanisms (Bedrock tools, Anthropic tools, OpenAI json_schema)

## Task Commits

Each task was committed atomically:

1. **Task 1: Create LLM provider abstraction layer** - `39ef249` (feat)
2. **Task 2: Create generate_ui tool using provider abstraction** - `e4c6295` (feat)
3. **Task 3: Register generate_ui tool and streaming endpoint in MCP server** - `a664bf2` (feat)

## Files Created/Modified

### Created
- `server/src/llm/__init__.py` - Module exports for provider abstraction
- `server/src/llm/provider.py` - Abstract base class LLMProvider with factory function
- `server/src/llm/bedrock.py` - AWS Bedrock provider using Converse API with SSO support
- `server/src/llm/anthropic_provider.py` - Anthropic direct API provider
- `server/src/llm/openai_provider.py` - OpenAI API provider with structured output
- `server/src/tools/generate_ui.py` - MCP tool for UI generation from natural language

### Modified
- `server/requirements.txt` - Added anthropic, openai, boto3 dependencies
- `server/src/tools/__init__.py` - Export generate_ui functions
- `server/src/main.py` - Register tool, add streaming endpoint, log provider status

## Decisions Made

1. **Provider abstraction pattern**: Enables switching between AWS Bedrock (primary for enterprise SSO), Anthropic direct API (simpler setup), and OpenAI (alternative) via LLM_PROVIDER env var
2. **Default to Bedrock**: Primary provider supports AWS SSO authentication for enterprise workflows without API key management
3. **Structured output enforcement**: Use provider-specific mechanisms (toolConfig for Bedrock, tools for Anthropic, response_format for OpenAI) to guarantee valid json-render specs
4. **Dual interface**: MCP tool for Claude Desktop integration, HTTP streaming endpoint for web UI progressive updates
5. **JSONL streaming**: application/x-ndjson for progressive rendering in web interfaces

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None - all provider implementations followed documented APIs successfully.

## User Setup Required

**External services require manual configuration.** Users must choose one provider and configure credentials:

### Option 1: AWS Bedrock (Recommended)
- Set `LLM_PROVIDER=bedrock` (default)
- Set `AWS_REGION=us-east-1` (or preferred region)
- Authenticate: `aws sso login --profile your-profile`
- Enable Bedrock model access in AWS Console

### Option 2: Anthropic Direct API
- Set `LLM_PROVIDER=anthropic`
- Set `ANTHROPIC_API_KEY=sk-...` from Anthropic Console

### Option 3: OpenAI API
- Set `LLM_PROVIDER=openai`
- Set `OPENAI_API_KEY=sk-...` from OpenAI Platform

**Verification:** Server logs "Provider configured: True" on startup if credentials are valid.

## Next Phase Readiness

- LLM provider infrastructure complete
- generate_ui tool ready for Phase 07-02 (NL editor UI)
- Component catalog system prompt integrated
- Streaming endpoint ready for progressive rendering
- No blockers for next plans

---
*Phase: 07-nl-generation*
*Completed: 2026-02-17*

## Self-Check: PASSED

All files verified:
- server/src/llm/__init__.py ✓
- server/src/llm/provider.py ✓
- server/src/llm/bedrock.py ✓
- server/src/llm/anthropic_provider.py ✓
- server/src/llm/openai_provider.py ✓
- server/src/tools/generate_ui.py ✓

All commits verified:
- 39ef249 ✓
- e4c6295 ✓
- a664bf2 ✓
