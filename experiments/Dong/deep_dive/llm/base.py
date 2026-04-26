from __future__ import annotations

from dataclasses import dataclass
from typing import Protocol


@dataclass(frozen=True)
class LLMResult:
    text: str
    input_tokens: int
    cache_read_tokens: int       # 不支持 caching 的 backend 永远为 0
    cache_creation_tokens: int
    output_tokens: int
    model: str                   # 实际使用的模型名（每个 backend 自己决定）


class LLMClient(Protocol):
    """业务层只依赖这个 Protocol。

    - system / user 是普通字符串
    - cache_system: 仅 Anthropic backend 会显式启用 prompt caching；
      OpenAI 兼容协议忽略此参数（多数提供商有隐式 caching，token 账单上自然便宜）。
    """

    name: str

    def complete(
        self,
        *,
        system: str,
        user: str,
        max_tokens: int,
        cache_system: bool = True,
    ) -> LLMResult: ...
