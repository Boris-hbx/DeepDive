# 网络安全每日 Brief — 2026-05-09

## 最关注的事

### 1. 微软揭示：AI代理框架提示注入漏洞可致远程代码执行
微软最新研究显示，攻击者可通过精心构造的提示注入，在AI代理框架中实现远程代码执行。这类攻击将LLM的逻辑弱点转化为实际系统控制，直接威胁大模型应用的安全边界，为“逻辑类漏洞防护”敲响警钟。 [原文](https://www.microsoft.com/en-us/security/blog/2026/05/07/prompts-become-shells-rce-vulnerabilities-ai-agent-frameworks/)

### 2. CISA将LiteLLM SQL注入漏洞列入已知被利用目录
CISA将BerriAI LiteLLM中的SQL注入漏洞（CVE-2026-42208）加入KEV目录，确认其已被主动利用。LiteLLM是流行的大模型网关，该漏洞可导致AI服务数据泄露或拒绝服务，凸显大模型基础设施层安全防护的紧迫性。 [原文](https://www.cisa.gov/news-events/alerts/2026/05/08/cisa-adds-one-known-exploited-vulnerability-catalog)

### 3. Unit 42：前沿AI模型正成为全频谱漏洞挖掘利器
Palo Alto Unit 42研究表明，前沿AI模型不仅可加速已知漏洞修补，更能自主发现零日漏洞，扮演“全频谱安全研究员”角色。此发现深刻影响AI for 态势感知与AI攻击防御间的动态平衡，必须提前构建对抗性检测框架。 [原文](https://unit42.paloaltonetworks.com/ai-software-security-risks/)

## 值得一看的事

- Linux内核“Dirty Frag”漏洞遭在野攻击，可提权扩大后渗透风险 [原文](https://www.microsoft.com/en-us/security/blog/2026/05/08/active-attack-dirty-frag-linux-vulnerability-expands-post-compromise-risk/)
- Canvas教育平台遭数据勒索，美国大批学校及大学服务中断 [原文](https://krebsonsecurity.com/2026/05/canvas-breach-disrupts-schools-colleges-nationwide/)
- 新型Rowhammer攻击实现对NVIDIA Ampere显卡的完全控制 [原文](https://www.schneier.com/blog/archives/2026/05/rowhammer-attack-against-nvidia-chips.html)
- CISA联合多国发布《代理式AI服务审慎采用》安全指南 [原文](https://www.cisa.gov/resources-tools/resources/careful-adoption-agentic-ai-services)
- 微软曝光大规模“行为准则”诈骗链，利用AiTM窃取令牌 [原文](https://www.microsoft.com/en-us/security/blog/2026/05/04/breaking-the-code-multi-stage-code-of-conduct-phishing-campaign-leads-to-aitm-token-compromise/)
- 微软获评KuppingerCole 2026新兴AI SOC领导者，AI驱动态势感知获认可 [原文](https://www.microsoft.com/en-us/security/blog/2026/05/06/microsoft-named-an-overall-leader-in-kuppingercole-analysts-2026-emerging-ai-security-operations-center-soc-report/)
- ClickFix活动伪装macOS实用工具，传播信息窃取木马 [原文](https://www.microsoft.com/en-us/security/blog/2026/05/06/clickfix-campaign-uses-fake-macos-utilities-lures-deliver-infostealers/)
- MAXHUB Pivot客户端明文暴露租户邮箱信息及拒绝服务漏洞 [原文](https://www.cisa.gov/news-events/ics-advisories/icsa-26-127-01)