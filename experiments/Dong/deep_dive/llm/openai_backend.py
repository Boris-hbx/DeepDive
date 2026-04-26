from __future__ import annotations

import logging
import os
import re
import time

from openai import OpenAI, RateLimitError

from .base import LLMResult

log = logging.getLogger(__name__)

# 从 RateLimitError 错误信息里提取 retry_delay（秒）。Gemini 的 retryDelay 字段格式 '47s'。
_RETRY_DELAY_RE = re.compile(r"retryDelay['\"]?\s*[:=]\s*['\"]?(\d+)s")


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
        # 主动节流：每次请求间至少间隔 N 秒。
        # Gemini AI Studio Free Tier 5 RPM → 设 13 秒（留点 margin）。
        # 付费档 / 其他厂商一般不限速 → 默认 0。
        self.min_interval = float(os.environ.get("OPENAI_MIN_REQUEST_INTERVAL", "0"))
        # 推理深度。OpenAI 标准参数，Gemini 2.5 系列也支持。
        # 我们的 rank/summarize 都是简单分类/摘要任务，none/minimal 即可，避免 thinking 吃光 max_tokens。
        # 不支持此参数的厂商：留空（默认）即可。
        self.reasoning_effort = os.environ.get("OPENAI_REASONING_EFFORT", "").strip() or None

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
        self._last_request_at: float = 0.0

    def _throttle(self) -> None:
        if self.min_interval <= 0:
            return
        elapsed = time.monotonic() - self._last_request_at
        wait = self.min_interval - elapsed
        if wait > 0:
            time.sleep(wait)
        self._last_request_at = time.monotonic()

    def _create_with_long_retry(self, **kwargs):
        """SDK 默认 backoff 太短（< 1s），手动加一层针对 429 的长 sleep + 重试。"""
        for attempt in range(3):
            self._throttle()
            try:
                return self._client.chat.completions.create(**kwargs)
            except RateLimitError as e:
                msg = str(e)
                m = _RETRY_DELAY_RE.search(msg)
                wait = (int(m.group(1)) + 2) if m else 30
                if attempt == 2:
                    raise
                log.warning("429 rate limit，等待 %ds 后重试（%d/3）", wait, attempt + 2)
                time.sleep(wait)

    def complete(
        self,
        *,
        system: str,
        user: str,
        max_tokens: int,
        cache_system: bool = True,  # noqa: ARG002 — OpenAI 兼容协议无显式 cache
    ) -> LLMResult:
        kwargs = {
            "model": self.model,
            "max_tokens": max_tokens,
            "messages": [
                {"role": "system", "content": system},
                {"role": "user", "content": user},
            ],
        }
        if self.reasoning_effort:
            kwargs["reasoning_effort"] = self.reasoning_effort
        response = self._create_with_long_retry(**kwargs)

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
