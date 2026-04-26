# Decisions

非显然决策的记录。每条一段，**最新的写在最上面**。

格式参考：

```
## YYYY-MM-DD — <主题>
**决定：** ...
**原因：** ...
**备选：** ...（可选）
```

---

<!-- 在此分隔线之上添加新条目 -->

## 2026-04-26 — Dong 子线：LLM 后端抽象层（多后端可切换）
**决定：** 在 `experiments/Dong/deep_dive/llm/` 引入一层 LLM client 抽象（`base.py` + `anthropic_backend.py` + `openai_backend.py` + `__init__.py` 工厂），通过 `LLM_BACKEND` env / `--backend` CLI 参数切换。Anthropic backend 直调 SDK；OpenAI backend 走 OpenAI 兼容协议，同一份代码可接 Gemini / DeepSeek / Kimi / OpenRouter / 自架代理。
**原因：** 实测 yibuapi.com 这类"Claude Code 共享池"代理与本流水线不兼容（注入工具集、替换 system prompt、忽略 tool_choice），客户端无法绕开。引入抽象层解决两件事：(1) 让"换 backend"从"重写代码"变成"改 env"，避免再次踩相同类型的坑；(2) 为团队后续评估其他模型（特别是国产 OpenAI 兼容厂）扫清障碍。
**备选：** (a) 继续找 yibuapi 平替——风险一样大；(b) 直接 hardcode 切换到某家——一次性方案，下次还要重写。

## 2026-04-25 — 仓库初始化与 spec-first 协作模式
**决定：** 项目以 spec-first 方式起步，初始仅包含 `CLAUDE.md`、`spec/`（产品一页纸 + 功能 spec 模板）、`docs/decisions.md`。技术栈、多 agent 协作等暂不决定。
**原因：** 8 人团队 + Claude Code 同时上手，先建立共享的产品定义和协作规则，避免每个人手里的 AI 走向不同方向。起步刻意从简，跑顺基础流程再引入高级模式。
**备选：** 直接选定技术栈并搭脚手架——放弃，因为产品定义还没收敛，过早选型容易返工。
