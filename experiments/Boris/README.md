# Boris 的 Agentic SE 洞察工程

每日扫描 11 个信息源，筛选 agentic software engineering 领域最值得关注的事，附蓝军反驳。

## 快速开始

在 Claude Code 中输入：

```
/daily-report-boris
```

生成今天的日报。也可以指定日期：

```
/daily-report-boris 2026-05-01
```

产出文件：`daily-report/YYYY-MM-DD.md`

## 网站

push 到 main 后，GitHub Actions 自动部署到：

**https://boris-hbx.github.io/DeepDive/Boris/**

## 目录结构

```
experiments/Boris/
├── config/
│   └── sources.yaml           # 11 个 RSS 信息源配置
├── daily-report/              # 日报归档（Markdown）
│   └── YYYY-MM-DD.md
├── data/                      # 中间产物（调试用）
│   └── YYYY-MM-DD/
│       ├── raw.json
│       ├── deduped.json
│       └── ranked.json
├── radar/                     # Agentic SE 项目雷达
│   └── 2026-04-26-radar.md
├── scripts/
│   └── build-pages.sh         # pandoc 构建静态站点
├── site/                      # Next.js 站点（暂未启用）
├── spec/
│   └── 002-daily-brief-skill.md  # /daily-report-boris skill spec
├── prompts/                   # prompt 设计文档
├── spec.md                    # 原始 MVP spec（草稿）
├── spec-automation.md         # 自动化基础设施 spec（草稿）
└── README.md                  # 本文件
```

## 信息源（11 个）

| 类别 | 源 |
|------|-----|
| Vendor (5) | Anthropic Engineering, OpenAI Blog, GitHub Blog, Google AI Blog, Hugging Face Blog |
| Practitioner (4) | Simon Willison, Latent Space, Lilian Weng, Max Woolf |
| Community (2) | Hacker News Best, Lobsters |

配置文件：`config/sources.yaml`

## 流水线

```
fetch (WebFetch × 11 RSS) → dedup (URL+标题规则) → rank+summarize (一次性) → critique (蓝军) → render (md)
```

- 零外部依赖，全部在 Claude Code 会话内完成
- 预估 ~20-25K token/次
- 单源失败不阻塞，蓝军失败不阻塞

## 相关文档

- [Skill Spec](spec/002-daily-brief-skill.md) — `/daily-report-boris` 的详细设计
- [信息源配置](config/sources.yaml)
- [项目雷达](radar/2026-04-26-radar.md) — ~95 个 OSS repo + 11 个商业对照
- [自动化 Spec](spec-automation.md) — L1/L2/L3 自动化路线图（草稿）
