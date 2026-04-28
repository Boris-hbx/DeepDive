import os
from .base import LLMClient
from .anthropic_backend import AnthropicClient
from .openai_backend import OpenAIClient

_BACKENDS = {
    "anthropic": AnthropicClient,
    "openai": OpenAIClient,
}

def get_llm_client(backend: str = None) -> LLMClient:
    if backend is None:
        backend = os.getenv("LLM_BACKEND", "anthropic")
    backend_class = _BACKENDS.get(backend)
    if backend_class is None:
        raise ValueError(f"Unknown backend: {backend}")
    return backend_class()

__all__ = ["LLMClient", "get_llm_client"]