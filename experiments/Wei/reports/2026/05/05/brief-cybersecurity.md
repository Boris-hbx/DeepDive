# 网络安全每日 Brief — 2026-05-05

## 最关注的事

### 1. Anthropic Claude Mythos 自主发现 Firefox 271 个零日漏洞  
前沿 AI 模型 Claude Mythos 在 Firefox 中自主挖掘出 271 个安全漏洞，并已实现武器化利用，标志着大模型在漏洞发现与攻击上的能力跃升，对“AI 攻击”和“AI for 态势感知”均构成重大影响，安全态势面临根本性变化。  
[原文](https://www.schneier.com/blog/archives/2026/04/claude-mythos-has-found-271-zero-days-in-firefox.html)

### 2. CISA 联合多国发布《谨慎采用智能体 AI 服务》指南  
该指南针对组织在引入 Agentic AI（智能体 AI）服务时的安全风险，提出系统化防护建议，直接回应“大模型安全”“AI 系统安全”及“逻辑类漏洞防护”主题，是当前 AI 安全治理的重要政策信号。  
[原文](https://www.cisa.gov/resources-tools/resources/careful-adoption-agentic-ai-services)

### 3. Unit 42 展示多智能体 AI 系统自主攻击云环境  
Palo Alto Networks Unit 42 构建了全自主的多智能体 AI 系统，成功在未授权情况下攻击云环境，证明了“AI 攻击”已从概念走向实战，对云基础设施和 AI 系统自身安全提出严峻挑战。  
[原文](https://unit42.paloaltonetworks.com/autonomous-ai-cloud-attacks/)

## 值得一看的事

- **DarkSword 恶意软件**：Google 发现针对 iOS 的全链利用恶意软件，推测为国家级攻击，威胁极高。 [原文](https://www.schneier.com/blog/archives/2026/05/darksword-malware.html)  
- **Copy Fail 提权漏洞 (CVE-2026-31431) 正被利用**：Linux 内核特权提升漏洞已出现野在外利用，影响云与 Kubernetes 环境，CISA 已加入已知被利用漏洞目录。 [原文](https://www.microsoft.com/en-us/security/blog/2026/05/01/cve-2026-31431-copy-fail-vulnerability-enables-linux-root-privilege-escalation/)  
- **Microsoft 揭露多阶段“行为准则”钓鱼活动**：攻击链利用 AiTM 技术窃取令牌，邮件安全态势持续恶化。 [原文](https://www.microsoft.com/en-us/security/blog/2026/05/04/breaking-the-code-multi-stage-code-of-conduct-phishing-campaign-leads-to-aitm-token-compromise/)  
- **Trail of Bits 通过威胁建模与提示注入审计 Comet 浏览器**：该审计展示了如何系统性发现 AI 浏览功能中的逻辑类漏洞，提示注入被有效利用。 [原文](https://blog.trailofbits.com/2026/02/20/using-threat-modeling-and-prompt-injection-to-audit-comet/)  
- **OWASP 呼吁构建全球漏洞情报统一框架**：针对 CVE 计划的可持续性挑战，提议建立多方共治的漏洞数据库，影响漏洞管理生态。 [原文](http://owasp.org/blog/2025/04/17/owasp-global-vulnerability-intelligence.html)  
- **Microsoft Agent 365 正式发布，新增影子 AI 代理发现能力**：可管控本地代理（如 OpenClaw、Claude Code）风险，强化 AI 治理。 [原文](https://www.microsoft.com/en-us/security/blog/2026/05/01/microsoft-agent-365-now-generally-available-expands-capabilities-and-integrations/)  
- **CISA 发布防御中国关联隐蔽设备网络指南**：揭示广泛的受控设备网络战术转变，地缘性威胁情报更新。 [原文](https://www.cisa.gov/news-events/cybersecurity-advisories/aa26-113a)  
- **前沿 AI 模型颠覆软件安全**：Unit 42 指出前沿 AI 可自主执行零日发现与快速补丁分析，正重塑攻防格局。 [原文](https://unit42.paloaltonetworks.com/ai-software-security-risks/)