# 网络安全每日 Brief — 2026-05-06

## 最关注的事

### 1. CISA 联合多国发布 Agentic AI 服务安全采用指南
CISA 与澳大利亚 ASD ACSC 等国际合作伙伴联合发布《谨慎采用 Agentic AI 服务》指南，这是全球首个针对自主决策型 AI 代理服务的系统性安全框架。指南重点阐述了 Agentic AI 的权限边界控制、数据隐私保护及供应链风险，直接回应了当前对 AI 系统安全与逻辑类漏洞防护的迫切需求。[原文](https://www.cisa.gov/resources-tools/resources/careful-adoption-agentic-ai-services)

### 2. Palo Alto 揭示前沿 AI 模型可自主发现零日漏洞
Unit 42 最新研究发现，前沿 AI 模型已能充当“全谱系安全研究员”，实现自主化的零日漏洞发现，并显著加速 N-day 补丁开发周期。该研究首次系统论证了 AI 在漏洞挖掘领域的实战能力，对理解 AI for 态势感知及防御范式转变具有里程碑意义。[原文](https://unit42.paloaltonetworks.com/ai-software-security-risks/)

### 3. Linux 内核“Copy Fail”漏洞：近年来最严重的 Linux 提权威胁
CVE-2026-31431 是一个影响数百万系统的 Linux 内核本地提权漏洞，允许攻击者隐蔽获取 root 权限。该漏洞已被列入 CISA KEV 目录，具有在野利用证据，且在云环境和 Kubernetes 集群中影响尤为严重，构成当前基础设施安全的重大威胁。[原文](https://unit42.paloaltonetworks.com/cve-2026-31431-copy-fail/)

## 值得一看的事

- **CISA 连续发布多条工控安全警报**：Hitachi Energy PCM600、ABB B&R Automation Studio、Johnson Controls CEM AC2000 等多个工控产品被曝高危漏洞，涉及提权与未授权访问，凸显关键基础设施防护形势严峻。[[1]](https://www.cisa.gov/news-events/ics-advisories/icsa-26-125-01) [[2]](https://www.cisa.gov/news-events/ics-advisories/icsa-26-125-04) [[3]](https://www.cisa.gov/news-events/ics-advisories/icsa-26-125-05)

- **DarkSword 恶意软件：疑似国家级 iOS 完整攻击链曝光**：Google GTIG 发现针对 iOS 的全链攻击恶意软件，利用多个漏洞实现完全控制，其复杂度暗示背后存在国家级攻击者，对移动终端安全防护提出新挑战。[原文](https://www.schneier.com/blog/archives/2026/05/darksword-malware.html)

- **微软披露大规模多阶段钓鱼活动：以“行为准则”为诱饵实施 AiTM 令牌窃取**：攻击者利用“行为准则”主题诱饵，结合合法邮件服务实施多步攻击链，最终通过 AiTM 技术窃取令牌绕过 MFA，展示社会工程学与高级技术手段的融合趋势。[原文](https://www.microsoft.com/en-us/security/blog/2026/05/04/breaking-the-code-multi-stage-code-of-conduct-phishing-campaign-leads-to-aitm-token-compromise/)

- **OWASP 基金会发布战略规划：迈向“无不安软件”的世界**：OWASP 宣布进入转型期，将从一个被认可的安全声音升级为行业真正的变革力量，战略聚焦于标准化工具、人才培养与全球协作，对整个应用安全生态具有深远影响。[原文](http://owasp.org/blog/2026/05/05/owasp-unveils-strategic-plan-world-without-insecure-software.html)

- **微软 Agent 365 正式 GA 上线，新增影子 AI 代理管理与本地 Agent 支持**：包括对 OpenClaw 和 Claude Code 等本地 AI 代理的发现与管理功能，标志着企业级 AI 安全管控从云端拓展至本地开发环境，与重点关注主题中的“AI 系统安全”高度关联。[原文](https://www.microsoft.com/en-us/security/blog/2026/05/01/microsoft-agent-365-now-generally-available-expands-capabilities-and-integrations/)

- **Trail of Bits 发布 C/C++ 安全编码挑战解析**：通过 Linux ping 程序与 Windows 驱动注册表两个实例，展示系统编程中常见的隐蔽漏洞，为 C/C++ 安全编码最佳实践提供实战案例。[原文](https://blog.trailofbits.com/2026/05/05/c/c-checklist-challenges-solved/)

- **Palo Alto 揭示 AI 多智能体系统可自主攻击云环境**：Unit 42 构建的自主云攻击多智能体系统成功实施攻击，为理解 AI 驱动的攻击技术及如何构建前瞻性防御策略提供关键洞察。[原文](https://unit42.paloaltonetworks.com/autonomous-ai-cloud-attacks/)

- **Claude Mythos 已发现 271 个 Firefox 零日漏洞**：自 2 月以来，Firefox 团队利用前沿 AI 模型持续挖掘并修复浏览器潜在安全漏洞，其产出规模前所未有，标志 AI 辅助漏洞挖掘已进入规模化应用阶段。[原文](https://www.schneier.com/blog/archives/2026/04/claude-mythos-has-found-271-zero-days-in-firefox.html)