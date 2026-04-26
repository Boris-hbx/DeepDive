from __future__ import annotations

import os

from anthropic import Anthropic

from .base import LLMResult

DEFAULT_MODEL = "claude-sonnet-4-6"


class AnthropicBackend:
    """直接走 Anthropic 官方 API（或兼容代理，通过 ANTHROPIC_BASE_URL）。

    env：
      ANTHROPIC_API_KEY  必填
      ANTHROPIC_BASE_URL 可选（走代理时设置）
      ANTHROPIC_MODEL    可选，默认 claude-sonnet-4-6
    """

    name = "anthropic"

    def __init__(self) -> None:
        self.model = os.environ.get("ANTHROPIC_MODEL", DEFAULT_MODEL).strip()
        # SDK 自动从 env 读 KEY/BASE_URL
        self._client = Anthropic()

    def complete(
        self,
        *,
        system: str,
        user: str,
        max_tokens: int,
        cache_system: bool = True,
    ) -> LLMResult:
        if cache_system:
            system_param = [
                {
                    "type": "text",
                    "text": system,
                    "cache_control": {"type": "ephemeral"},
                }
            ]
        else:
            system_param = system

        response = self._client.messages.create(
            model=self.model,
            max_tokens=max_tokens,
            system=system_param,
            messages=[{"role": "user", "content": user}],
            # 防 Claude Code 风格代理强行注入工具集（如 yibuapi.com）。
            # 直访 Anthropic 也接受这个参数，无副作用。
            tool_choice={"type": "none"},
        )

        try:
            text = next(b.text for b in response.content if b.type == "text")
        except StopIteration as e:
            raise RuntimeError(
                f"Anthropic 后端无 text 块响应（content={response.content!r}）。"
                f"如使用代理，确认它是 API 转发而非 Claude Code 共享。"
            ) from e

        usage = response.usage
        return LLMResult(
            text=text,
            input_tokens=usage.input_tokens,
            cache_read_tokens=getattr(usage, "cache_read_input_tokens", 0) or 0,
            cache_creation_tokens=getattr(usage, "cache_creation_input_tokens", 0) or 0,
            output_tokens=usage.output_tokens,
            model=self.model,
        )
