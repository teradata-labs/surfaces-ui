"""AWS Bedrock provider for Claude models."""
import json
import logging
import os
from typing import AsyncIterator, Optional

import boto3
from botocore.config import Config

from .provider import LLMProvider, LLMResponse

logger = logging.getLogger(__name__)

class BedrockProvider(LLMProvider):
    """AWS Bedrock provider using Claude models via Converse API."""

    MODEL_ID = "anthropic.claude-sonnet-4-5-20250514-v1:0"

    def __init__(self):
        self._client = None
        self._region = os.environ.get("AWS_REGION", "us-east-1")

    @property
    def client(self):
        if self._client is None:
            config = Config(
                region_name=self._region,
                retries={"max_attempts": 3, "mode": "adaptive"}
            )
            self._client = boto3.client("bedrock-runtime", config=config)
        return self._client

    def is_configured(self) -> bool:
        """Check if AWS credentials are available (SSO or env vars)."""
        try:
            # This will use SSO credentials if configured
            sts = boto3.client("sts")
            sts.get_caller_identity()
            return True
        except Exception:
            return False

    async def generate(
        self,
        system_prompt: str,
        user_prompt: str,
        json_schema: Optional[dict] = None,
    ) -> LLMResponse:
        """Generate using Bedrock Converse API with optional structured output."""
        messages = [{"role": "user", "content": [{"text": user_prompt}]}]

        inference_config = {
            "maxTokens": 4096,
            "temperature": 0,
        }

        # Build request
        request = {
            "modelId": self.MODEL_ID,
            "messages": messages,
            "system": [{"text": system_prompt}],
            "inferenceConfig": inference_config,
        }

        # Add tool for structured output if schema provided
        if json_schema:
            request["toolConfig"] = {
                "tools": [{
                    "toolSpec": {
                        "name": "json_output",
                        "description": "Output the result as structured JSON",
                        "inputSchema": {"json": json_schema}
                    }
                }],
                "toolChoice": {"tool": {"name": "json_output"}}
            }

        try:
            response = self.client.converse(**request)

            # Extract content - check for tool use or text
            output = response.get("output", {})
            message = output.get("message", {})
            content_blocks = message.get("content", [])

            result_text = ""
            for block in content_blocks:
                if "text" in block:
                    result_text = block["text"]
                elif "toolUse" in block:
                    # Structured output via tool
                    result_text = json.dumps(block["toolUse"].get("input", {}))

            return LLMResponse(
                content=result_text,
                model=self.MODEL_ID,
                provider="bedrock",
                usage=response.get("usage"),
            )
        except Exception as e:
            logger.error(f"Bedrock generation failed: {e}")
            raise

    async def stream(
        self,
        system_prompt: str,
        user_prompt: str,
    ) -> AsyncIterator[str]:
        """Stream using Bedrock Converse Stream API."""
        messages = [{"role": "user", "content": [{"text": user_prompt}]}]

        try:
            response = self.client.converse_stream(
                modelId=self.MODEL_ID,
                messages=messages,
                system=[{"text": system_prompt}],
                inferenceConfig={"maxTokens": 4096, "temperature": 0},
            )

            for event in response.get("stream", []):
                if "contentBlockDelta" in event:
                    delta = event["contentBlockDelta"].get("delta", {})
                    if "text" in delta:
                        yield delta["text"]
        except Exception as e:
            logger.error(f"Bedrock streaming failed: {e}")
            raise
