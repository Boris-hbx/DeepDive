# 网络安全每日 Brief — 2026-05-08

## 最关注的事

### 1. 提示注入可致 AI Agent 框架远程代码执行
微软安全研究揭示，针对 AI Agent 框架的提示注入（prompt injection）能实现远程代码执行，将自然语言提示变成系统 Shell。此类逻辑类漏洞在工具调用、权限串联的场景中极易被扩大化，对当下智能体的架构安全提出严峻挑战。  
[原文](https://www.microsoft.com/en-us/security/blog/2026/05/07/prompts-become-shells-rce-vulnerabilities-ai-agent-frameworks/)

### 2. CISA 发布《谨慎采纳 Agentic AI 服务》指南
CISA 联合多国网络安全机构发布专门指南，指导组织在引入具有自主决策与行动能力的 Agentic AI 时如何控制风险，包含沙箱隔离、最小权限、输入输出验证等控制要求，是当前对 AI 系统运营安全的官方级强化信号。  
[原文](https://www.cisa.gov/resources-tools/resources/careful-adoption-agentic-ai-services)

### 3. 前沿 AI 模型可自主发现零日漏洞，安全研究范式受冲击
Unit 42 研究发现，前沿 AI 模型已具备全栈安全研究员的能力，可自主完成零日漏洞发现与利用，并极大加速 N-day 补丁的逆向验证。这种“AI for 态势感知”的能力在提升防御效率的同时，也意味着攻击门槛急剧降低。  
[原文](https://unit42.paloaltonetworks.com/ai-software-security-risks/)

## 值得一看的事

- Canvas 教育平台遭持续性数据勒索攻击，导致全美多所大学与学区课程中断。  
  [原文](https://krebsonsecurity.com/2026/05/canvas-breach-disrupts-schools-colleges-nationwide/)
- CISA 将 Ivanti EPMM 漏洞（CVE-2026-6973）加入已知被利用漏洞目录，要求联邦机构限期修复。  
  [原文](https://www.cisa.gov/news-events/alerts/2026/05/07/cisa-adds-one-known-exploited-vulnerability-catalog)
- PAN-OS Captive Portal 零日漏洞（CVE-2026-0300）被野外利用，可实现无需认证的远程代码执行。  
  [原文](https://unit42.paloaltonetworks.com/captive-portal-zero-day/)
- Linux 内核高危权限提升漏洞“Copy Fail”（CVE-2026-31431）影响数百万系统，可隐蔽获取 root 权限。  
  [原文](https://unit42.paloaltonetworks.com/cve-2026-31431-copy-fail/)
- 新 Rowhammer 攻击可完全控制 NVIDIA Ampere 架构 GPU，硬件安全边界再被突破。  
  [原文](https://www.schneier.com/blog/archives/2026/05/rowhammer-attack-against-nvidia-chips.html)
- ClickFix 恶意活动利用虚假 macOS 修复工具诱骗用户执行窃密命令，窃取凭证与钱包数据。  
  [原文](https://www.microsoft.com/en-us/security/blog/2026/05/06/clickfix-campaign-uses-fake-macos-utilities-lures-deliver-infostealers/)
- 微软发现多阶段“行为准则”主题钓鱼活动，结合 AiTM 技术窃取令牌并接管账户。  
  [原文](https://www.microsoft.com/en-us/security/blog/2026/05/04/breaking-the-code-multi-stage-code-of-conduct-phishing-campaign-leads-to-aitm-token-compromise/)
- 微软在“世界通行密钥日”推进无密码认证，扩大 Passkey 支持以降低钓鱼风险。  
  [原文](https://www.microsoft.com/en-us/security/blog/2026/05/07/world-passkey-day-advancing-passwordless-authentication/)