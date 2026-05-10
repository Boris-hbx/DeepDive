# 网络安全每日 Brief — 2026-04-30

## 最关注的事

### 1. 前沿模型 Claude Mythos 自主发现 Firefox 271 个零日漏洞
Anthropic 披露其新模型 Claude Mythos Preview 在两个月内自主发现并武器化了 Firefox 中的 271 个零日漏洞，无需人工指导。这一数量级揭示了前沿 AI 已具备批量挖掘和利用未知漏洞的能力，将深刻改变漏洞攻防与软件安全评估的格局。 [原文](https://www.schneier.com/blog/archives/2026/04/claude-mythos-has-found-271-zero-days-in-firefox.html)

### 2. 多智能体 AI 系统实现自主云环境攻击
Unit 42 构建并演示了多智能体 AI 系统自主识别云基础设施弱点、执行复杂攻击链的过程，证明 AI 攻击者已能够脱离人类干预独立完成云环境渗透。该研究强烈警示云安全策略必须纳入对自主 AI 威胁的防御。 [原文](https://unit42.paloaltonetworks.com/autonomous-ai-cloud-attacks/)

### 3. 提示注入审计揭示 AI 浏览器大模型安全风险
Trail of Bits 在对 Perplexity 的 AI 浏览器 Comet 进行安全测试时，利用威胁建模与提示注入手法发现多处逻辑类漏洞，可导致越权操作。这一实践再次强调部署 AI 功能的产品必须将提示注入等大模型特有攻击面纳入安全左移流程。 [原文](https://blog.trailofbits.com/2026/02/20/using-threat-modeling-and-prompt-injection-to-audit-comet/)

## 值得一看的事

- Zig 项目强硬拒绝 AI 生成代码贡献，以政策明确划界引发开源社区对 AI 产物安全与可信的广泛讨论。 [原文](https://simonwillison.net/2026/Apr/30/zig-anti-ai/)
- CISA 联合多部门发布《将零信任原则应用于运营技术》指南，推动关键基础设施的零信任架构落地。 [原文](https://www.cisa.gov/resources-tools/resources/adapting-zero-trust-principles-operational-technology)
- Microsoft 为 CISO 总结风险审查的 8 项最佳实践，强调主动安全与持续评估在应对加速威胁中的核心作用。 [原文](https://www.microsoft.com/en-us/security/blog/2026/04/29/8-best-practices-for-cisos-conducting-risk-reviews/)
- Trail of Bits 将模糊测试工具 Ruzzy 与 LibAFL 集成，借助 Rust 性能优势提升漏洞挖掘效率与模块化水平。 [原文](https://blog.trailofbits.com/2026/04/29/extending-ruzzy-with-libafl/)
- Bruce Schneier 深度分析 Anthropic Mythos 对网络安全的冲击：AI 正从根本上改写漏洞发现与武器化的经济模型和攻防平衡。 [原文](https://www.schneier.com/blog/archives/2026/04/what-anthropics-mythos-means-for-the-future-of-cybersecurity.html)
- CISA 将 ConnectWise ScreenConnect 路径遍历等两个漏洞加入已知被利用漏洞目录，要求联邦机构及时修补。 [原文](https://www.cisa.gov/news-events/alerts/2026/04/28/cisa-adds-two-known-exploited-vulnerabilities-catalog)
- Unit 42 披露 TeamPCP 组织针对网络安全基础设施的多阶段供应链攻击，并发现其与 Vect 勒索软件团伙勾结。 [原文](https://unit42.paloaltonetworks.com/teampcp-supply-chain-attacks/)
- Microsoft Sentinel 通过 UEBA 行为分析帮助安全团队精准区分 AWS 环境中的正常活动与隐蔽攻击行为。 [原文](https://www.microsoft.com/en-us/security/blog/2026/04/28/simplifying-aws-defense-microsoft-sentinel-ueba/)