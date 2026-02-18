"""Anthropic direct API provider."""
import logging
import os
from typing import AsyncIterator, Optional

from anthropic import Anthropic

from .provider import LLMProvider, LLMResponse

logger = logging.getLogger(__name__)

class AnthropicProvider(LLMProvider):
    """Anthropic direct API provider."""

    MODEL = "claude-sonnet-4-5-20250514"

    def __init__(self):
        self._client = None

    @property
    def client(self):
        if self._client is None:
            api_key = os.environ.get("ANTHROPIC_API_KEY")
            if not api_key:
                raise ValueError("ANTHROPIC_API_KEY environment variable not set")
            self._client = Anthropic(api_key=api_key)
        return self._client

    def is_configured(self) -> bool:
        return bool(os.environ.get("ANTHROPIC_API_KEY"))

    async def generate(
        self,
        system_prompt: str,
        user_prompt: str,
        json_schema: Optional[dict] = None,
    ) -> LLMResponse:
        """Generate using Anthropic API with optional structured output."""
        messages = [{"role": "user", "content": user_prompt}]

        # Build request
        request = {
            "model": self.MODEL,
            "max_tokens": 4096,
            "system": system_prompt,
            "messages": messages,
        }

        # Add tool for structured output if schema provided
        if json_schema:
            request["tools"] = [{
                "name": "json_output",
                "description": "Output the result as structured JSON",
                "input_schema": json_schema
            }]
            request["tool_choice"] = {"type": "tool", "name": "json_output"}

        try:
            response = self.client.messages.create(**request)

            # Extract content
            result_text = ""
            for block in response.content:
                if block.type == "text":
                    result_text = block.text
                elif block.type == "tool_use":
                    import json
                    result_text = json.dumps(block.input)

            return LLMResponse(
                content=result_text,
                model=self.MODEL,
                provider="anthropic",
                usage={"input_tokens": response.usage.input_tokens, "output_tokens": response.usage.output_tokens},
            )
        except Exception as e:
            logger.error(f"Anthropic generation failed: {e}")
            raise

    async def stream(
        self,
        system_prompt: str,
        user_prompt: str,
    ) -> AsyncIterator[str]:
        """Stream using Anthropic streaming API."""
        try:
            with self.client.messages.stream(
                model=self.MODEL,
                max_tokens=4096,
                system=system_prompt,
                messages=[{"role": "user", "content": user_prompt}],
            ) as stream:
                for text in stream.text_stream:
                    yield text
        except Exception as e:
            logger.error(f"Anthropic streaming failed: {e}")
            raise
