# 网络安全每日 Brief — 2026-05-07

## 最关注的事

### 1. Microsoft 被评为 KuppingerCole 2026 新兴 AI SOC 报告领导者
微软在最新分析师报告中被列为“新兴 AI 安全运营中心”（AI SOC）整体与市场双料领导者，强调将自动化与 AI 内化为安全运营核心。这直接体现了“AI for 态势感知”从概念走向主流的趋势，表明以 AI 驱动的检测与响应正成为业界标准。 [原文](https://www.microsoft.com/en-us/security/blog/2026/05/06/microsoft-named-an-overall-leader-in-kuppingercole-analysts-2026-emerging-ai-security-operations-center-soc-report/)

### 2. 新 Rowhammer 攻击实现对 NVIDIA 芯片的完全控制
两支独立研究团队同时演示了对 NVIDIA Ampere 架构 GPU 的 Rowhammer 攻击，可无需依赖内存完整性漏洞即获得 CPU 完全控制权。鉴于 GPU 是 AI 训练与推理的核心基座，这类硬件攻击直指 AI 基础设施底层安全，凸显逻辑与物理层结合的防御挑战。 [原文](https://www.schneier.com/blog/archives/2026/05/rowhammer-attack-against-nvidia-chips.html)

### 3. Claude Mythos 已为 Firefox 挖出 271 个零日漏洞
Anthropic 透露，自 2 月以来其前沿模型 Claude Mythos 自主发现 Firefox 中潜伏的 271 个零日漏洞，并帮助团队加速修复。此规模再次证明 AI 在漏洞挖掘与武器化方面的颠覆性能力，与“AI 攻击”“AI for 态势感知”等核心关切深度吻合。 [原文](https://www.schneier.com/blog/archives/2026/04/claude-mythos-has-found-271-zero-days-in-firefox.html)

## 值得一看的事

- 恶意行动者利用伪造的 macOS 工具修复页面诱骗用户运行终端命令，绕过传统检测，窃取凭证和加密钱包。 [原文](https://www.microsoft.com/en-us/security/blog/2026/05/06/clickfix-campaign-uses-fake-macos-utilities-lures-deliver-infostealers/)
- Google 发现名为 DarkSword 的 iOS 全链攻击恶意软件，利用多个漏洞实现远程控制，怀疑由国家级情报组织开发。 [原文](https://www.schneier.com/blog/archives/2026/05/darksword-malware.html)
- Linux 高危提权漏洞 CVE-2026-31431 “Copy Fail” 已被在野利用，可使云环境和 Kubernetes 工作负载获得 root 权限。 [原文](https://www.microsoft.com/en-us/security/blog/2026/05/01/cve-2026-31431-copy-fail-vulnerability-enables-linux-root-privilege-escalation/)
- Microsoft Agent 365 正式 GA，新增对本地影子 AI 代理（如 OpenClaw、Claude Code）的发现与管理功能，帮助防止未经监管的 AI 代理扩散。 [原文](https://www.microsoft.com/en-us/security/blog/2026/05/01/microsoft-agent-365-now-generally-available-expands-capabilities-and-integrations/)
- OWASP 基金会公布新战略计划，目标从行业权威声音转变为彻底消除不安全软件的变革推动者。 [原文](http://owasp.org/blog/2026/05/05/owasp-unveils-strategic-plan-world-without-insecure-software.html)
- 多阶段“行为准则”钓鱼活动利用合法邮件服务和 Adversary-in-the-Middle 令牌窃取，大规模窃取身份凭证，微软已发布详细分析。 [原文](https://www.microsoft.com/en-us/security/blog/2026/05/04/breaking-the-code-multi-stage-code-of-conduct-phishing-campaign-leads-to-aitm-token-compromise/)
- Simon Willison 指出“氛围编程”与智能体工程正在趋同，开发者在未完全理解逻辑的情况下快速生成代码，可能放大软件供应链中的隐蔽风险。 [原文](https://simonwillison.net/2026/May/6/vibe-coding-and-agentic-engineering/#atom-everything)
- Trail of Bits 发布 C/C++ 安全检查清单及解答，通过 Linux ping 程序与 Windows 驱动示例揭露容易被忽视的安全漏洞。 [原文](https://blog.trailofbits.com/2026/05/05/c/c-checklist-challenges-solved/)