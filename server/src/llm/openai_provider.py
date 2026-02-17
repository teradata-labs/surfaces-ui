"""OpenAI API provider."""
import json
import logging
import os
from typing import AsyncIterator, Optional

from openai import OpenAI

from .provider import LLMProvider, LLMResponse

logger = logging.getLogger(__name__)

class OpenAIProvider(LLMProvider):
    """OpenAI API provider using GPT-4."""

    MODEL = "gpt-4o"

    def __init__(self):
        self._client = None

    @property
    def client(self):
        if self._client is None:
            api_key = os.environ.get("OPENAI_API_KEY")
            if not api_key:
                raise ValueError("OPENAI_API_KEY environment variable not set")
            self._client = OpenAI(api_key=api_key)
        return self._client

    def is_configured(self) -> bool:
        return bool(os.environ.get("OPENAI_API_KEY"))

    async def generate(
        self,
        system_prompt: str,
        user_prompt: str,
        json_schema: Optional[dict] = None,
    ) -> LLMResponse:
        """Generate using OpenAI API with optional structured output."""
        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ]

        # Build request
        request = {
            "model": self.MODEL,
            "messages": messages,
            "max_tokens": 4096,
            "temperature": 0,
        }

        # Use response_format for structured output if schema provided
        if json_schema:
            request["response_format"] = {
                "type": "json_schema",
                "json_schema": {
                    "name": "ui_spec",
                    "schema": json_schema,
                    "strict": True
                }
            }

        try:
            response = self.client.chat.completions.create(**request)

            result_text = response.choices[0].message.content or ""

            return LLMResponse(
                content=result_text,
                model=self.MODEL,
                provider="openai",
                usage={
                    "input_tokens": response.usage.prompt_tokens,
                    "output_tokens": response.usage.completion_tokens
                } if response.usage else None,
            )
        except Exception as e:
            logger.error(f"OpenAI generation failed: {e}")
            raise

    async def stream(
        self,
        system_prompt: str,
        user_prompt: str,
    ) -> AsyncIterator[str]:
        """Stream using OpenAI streaming API."""
        try:
            stream = self.client.chat.completions.create(
                model=self.MODEL,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt},
                ],
                max_tokens=4096,
                temperature=0,
                stream=True,
            )

            for chunk in stream:
                if chunk.choices[0].delta.content:
                    yield chunk.choices[0].delta.content
        except Exception as e:
            logger.error(f"OpenAI streaming failed: {e}")
            raise
