from __future__ import annotations

import os

from .base import LLMClient, LLMResult


def get_client(backend: str | None = None) -> LLMClient:
    """工厂：按 backend 名（或 LLM_BACKEND env）返回对应客户端。

    backend ∈ {"anthropic", "openai"}；默认 "anthropic"。
    "openai" 表示 OpenAI 兼容协议（Gemini / DeepSeek / Kimi / OpenRouter / 自架等都用这条）。
    """
    name = (backend or os.environ.get("LLM_BACKEND", "anthropic")).strip().lower()
    if name == "anthropic":
        from .anthropic_backend import AnthropicBackend
        return AnthropicBackend()
    if name == "openai":
        from .openai_backend import OpenAIBackend
        return OpenAIBackend()
    raise ValueError(f"未知的 LLM_BACKEND: {name!r}（支持：anthropic / openai）")


__all__ = ["LLMClient", "LLMResult", "get_client"]
