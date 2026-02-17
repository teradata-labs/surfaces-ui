"""Generate UI tool for MCP server."""
import json
import logging
from typing import AsyncIterator, Optional

from mcp.types import Tool

from ..llm import get_llm_provider, LLMProvider

logger = logging.getLogger(__name__)

def get_generate_ui_tool_definition() -> Tool:
    """Return the MCP tool definition for generate_ui."""
    return Tool(
        name="generate_ui",
        description="Generate UI components from natural language descriptions. Returns a json-render specification that can be rendered directly.",
        inputSchema={
            "type": "object",
            "properties": {
                "prompt": {
                    "type": "string",
                    "description": "Natural language description of desired UI"
                },
                "include_explanation": {
                    "type": "boolean",
                    "description": "Include reasoning about component choices",
                    "default": False
                }
            },
            "required": ["prompt"]
        }
    )

def get_catalog_system_prompt() -> str:
    """Return the system prompt for UI generation."""
    return '''You are a UI generation assistant. Generate json-render specifications for SurfacesUI components.

## Available Components

### Primitives
- **Chart**: Data visualization (bar, line, pie, scatter, area, heatmap)
  Props: type, xAxis, yAxis, height, showDataLabels, colors
- **DataTable**: Tabular data display with virtual scrolling
  Props: columns, height, density (compact|comfortable|spacious), virtualScrolling, showRowNumbers
- **Filter**: Search input for filtering data
  Props: placeholder, debounceMs
- **DensityToggle**: Row density selector
  Props: showLabels
- **ViewModeToggle**: Table/chart view switcher
  Props: initialMode (table|chart)

### Molecules
- **TableWithFilters**: DataTable + Filter + DensityToggle combined
  Props: columns, height, initialDensity, showFilter, showDensityToggle, virtualScrolling
- **ChartWithControls**: Chart with type/axis configuration panel
  Props: height, initialChartType, showControls, controlsCollapsed

### Organisms
- **SQLResultsDisplay**: Complete SQL results viewer with table, chart, export
  Props: sql, context (web|mcp), initialViewMode, tableHeight, chartHeight

## Output Format

Return ONLY valid JSON matching this structure:
{
  "root": "<element-id>",
  "elements": {
    "<element-id>": {
      "type": "<ComponentName>",
      "props": { ... }
    }
  }
}

## Rules
1. Use TableWithFilters for interactive data tables (not separate DataTable + Filter)
2. Use SQLResultsDisplay for complete data exploration interfaces
3. Use Chart for simple visualizations, ChartWithControls when users need options
4. Default height is 400px unless specified
5. Enable virtualScrolling for tables with potentially large datasets
'''

def get_ui_spec_json_schema() -> dict:
    """Return JSON schema for structured output."""
    return {
        "type": "object",
        "properties": {
            "root": {
                "type": "string",
                "description": "ID of the root element"
            },
            "elements": {
                "type": "object",
                "additionalProperties": {
                    "type": "object",
                    "properties": {
                        "type": {
                            "type": "string",
                            "enum": ["Chart", "DataTable", "Filter", "DensityToggle", "ViewModeToggle", "TableWithFilters", "ChartWithControls", "SQLResultsDisplay"]
                        },
                        "props": {
                            "type": "object"
                        }
                    },
                    "required": ["type", "props"]
                }
            }
        },
        "required": ["root", "elements"]
    }

async def generate_ui_tool(
    prompt: str,
    include_explanation: bool = False,
    streaming: bool = False,
) -> str:
    """Generate UI spec from natural language prompt.

    Args:
        prompt: Natural language description of desired UI
        include_explanation: Include reasoning about component choices
        streaming: Not used in MCP call_tool (streaming handled separately)

    Returns:
        JSON string with: success, spec, explanation (if requested), provider
    """
    try:
        provider = get_llm_provider()

        if not provider.is_configured():
            return json.dumps({
                "success": False,
                "error": f"LLM provider not configured. Set required environment variables for {type(provider).__name__}."
            })

        system_prompt = get_catalog_system_prompt()

        if include_explanation:
            # First call for reasoning
            explain_prompt = f"Explain your component choices for this UI request, then provide the json-render spec:\n\n{prompt}"
            response = await provider.generate(system_prompt, explain_prompt)

            # Parse explanation and spec from response
            # The response may contain both explanation and JSON
            content = response.content

            # Try to extract JSON from the response
            import re
            json_match = re.search(r'\{[\s\S]*"root"[\s\S]*"elements"[\s\S]*\}', content)
            if json_match:
                spec_str = json_match.group()
                explanation = content[:json_match.start()].strip()
                spec = json.loads(spec_str)
            else:
                # If no JSON found, make second call with structured output
                spec_response = await provider.generate(
                    system_prompt,
                    prompt,
                    json_schema=get_ui_spec_json_schema()
                )
                spec = json.loads(spec_response.content)
                explanation = content

            return json.dumps({
                "success": True,
                "spec": spec,
                "explanation": explanation,
                "provider": response.provider,
                "model": response.model,
            })
        else:
            # Single call with structured output
            response = await provider.generate(
                system_prompt,
                prompt,
                json_schema=get_ui_spec_json_schema()
            )

            spec = json.loads(response.content)

            return json.dumps({
                "success": True,
                "spec": spec,
                "provider": response.provider,
                "model": response.model,
            })

    except json.JSONDecodeError as e:
        logger.error(f"Failed to parse LLM response as JSON: {e}")
        return json.dumps({
            "success": False,
            "error": f"Invalid JSON in LLM response: {str(e)}"
        })
    except Exception as e:
        logger.error(f"generate_ui_tool failed: {e}")
        return json.dumps({
            "success": False,
            "error": str(e)
        })

async def stream_ui_generation(
    prompt: str,
    include_explanation: bool = False,
) -> AsyncIterator[str]:
    """Stream UI generation for HTTP endpoint.

    Yields JSONL chunks for progressive updates.
    """
    try:
        provider = get_llm_provider()

        if not provider.is_configured():
            yield json.dumps({"error": "LLM provider not configured"}) + "\n"
            return

        system_prompt = get_catalog_system_prompt()

        # Stream the response
        full_content = ""
        async for chunk in provider.stream(system_prompt, prompt):
            full_content += chunk
            yield json.dumps({"chunk": chunk}) + "\n"

        # Parse final result
        import re
        json_match = re.search(r'\{[\s\S]*"root"[\s\S]*"elements"[\s\S]*\}', full_content)
        if json_match:
            spec = json.loads(json_match.group())
            yield json.dumps({
                "done": True,
                "success": True,
                "spec": spec,
            }) + "\n"
        else:
            yield json.dumps({
                "done": True,
                "success": False,
                "error": "Could not parse UI spec from response"
            }) + "\n"

    except Exception as e:
        logger.error(f"stream_ui_generation failed: {e}")
        yield json.dumps({"error": str(e)}) + "\n"
