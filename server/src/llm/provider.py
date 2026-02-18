"""LLM provider abstraction for UI generation."""
import os
from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import AsyncIterator, Optional

@dataclass
class LLMResponse:
    """Response from LLM provider."""
    content: str
    model: str
    provider: str
    usage: Optional[dict] = None

class LLMProvider(ABC):
    """Abstract base class for LLM providers."""

    @abstractmethod
    async def generate(
        self,
        system_prompt: str,
        user_prompt: str,
        json_schema: Optional[dict] = None,
    ) -> LLMResponse:
        """Generate a response from the LLM."""
        pass

    @abstractmethod
    async def stream(
        self,
        system_prompt: str,
        user_prompt: str,
    ) -> AsyncIterator[str]:
        """Stream response chunks from the LLM."""
        pass

    @abstractmethod
    def is_configured(self) -> bool:
        """Check if provider has required credentials."""
        pass

def get_llm_provider() -> LLMProvider:
    """Factory function to get configured LLM provider.

    Uses LLM_PROVIDER env var: 'bedrock' | 'anthropic' | 'openai'
    Defaults to 'bedrock' if not set.
    """
    provider_name = os.environ.get("LLM_PROVIDER", "bedrock").lower()

    if provider_name == "bedrock":
        from .bedrock import BedrockProvider
        return BedrockProvider()
    elif provider_name == "anthropic":
        from .anthropic_provider import AnthropicProvider
        return AnthropicProvider()
    elif provider_name == "openai":
        from .openai_provider import OpenAIProvider
        return OpenAIProvider()
    else:
        raise ValueError(f"Unknown LLM provider: {provider_name}. Use 'bedrock', 'anthropic', or 'openai'")
