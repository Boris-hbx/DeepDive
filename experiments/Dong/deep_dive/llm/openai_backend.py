from __future__ import annotations

import os

from openai import OpenAI

from .base import LLMResult


class OpenAIBackend:
    """OpenAI 兼容协议后端。同一份代码可以接：
    - Gemini AI Studio:  base_url=https://generativelanguage.googleapis.com/v1beta/openai/
    - DeepSeek:          base_url=https://api.deepseek.com/v1
    - Kimi (Moonshot):   base_url=https://api.moonshot.cn/v1
    - OpenRouter:        base_url=https://openrouter.ai/api/v1
    - OpenAI 自家:       base_url=https://api.openai.com/v1（默认）
    - 自架 LiteLLM:      base_url=http://your-vps:4000/v1

    env：
      OPENAI_API_KEY   必填
      OPENAI_BASE_URL  必填（不同提供商不同；OpenAI 自家可省略）
      OPENAI_MODEL     必填（每家命名不同，例如 gemini-2.5-flash / deepseek-chat）
    """

    name = "openai"

    def __init__(self) -> None:
        api_key = os.environ.get("OPENAI_API_KEY")
        base_url = os.environ.get("OPENAI_BASE_URL")
        model = os.environ.get("OPENAI_MODEL", "").strip()

        if not api_key:
            raise SystemExit("OPENAI_API_KEY 未设置")
        if not model:
            raise SystemExit(
                "OPENAI_MODEL 未设置（每家 OpenAI 兼容服务命名不同，"
                "例如 gemini-2.5-flash / deepseek-chat / kimi-latest）"
            )

        self.model = model
        # base_url=None 时 OpenAI SDK 用官方默认（api.openai.com）
        self._client = OpenAI(api_key=api_key, base_url=base_url or None)

    def complete(
        self,
        *,
        system: str,
        user: str,
        max_tokens: int,
        cache_system: bool = True,  # noqa: ARG002 — OpenAI 兼容协议无显式 cache
    ) -> LLMResult:
        response = self._client.chat.completions.create(
            model=self.model,
            max_tokens=max_tokens,
            messages=[
                {"role": "system", "content": system},
                {"role": "user", "content": user},
            ],
        )

        choice = response.choices[0]
        text = choice.message.content or ""
        if not text:
            raise RuntimeError(
                f"OpenAI 后端返回空文本（finish_reason={choice.finish_reason}）"
            )

        usage = response.usage
        # 兼容多家：OpenAI 自家有 prompt_tokens_details.cached_tokens，
        # DeepSeek 有 prompt_cache_hit_tokens 自定义字段。能拿到就拿。
        cache_read = 0
        details = getattr(usage, "prompt_tokens_details", None)
        if details is not None:
            cache_read = getattr(details, "cached_tokens", 0) or 0
        deepseek_hit = getattr(usage, "prompt_cache_hit_tokens", None)
        if deepseek_hit is not None:
            cache_read = max(cache_read, deepseek_hit or 0)

        return LLMResult(
            text=text,
            input_tokens=usage.prompt_tokens,
            cache_read_tokens=cache_read,
            cache_creation_tokens=0,  # OpenAI 兼容协议无对应概念
            output_tokens=usage.completion_tokens,
            model=self.model,
        )
