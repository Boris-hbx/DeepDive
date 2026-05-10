# 网络安全每日 Brief — 2026-05-10

## 最关注的事

### 1. 微软披露AI代理框架提示注入可致远程代码执行  
微软安全团队发现，在AI代理框架中通过提示注入（prompt injection）可以触发远程代码执行。攻击者能将提示转化为“Shell”，控制底层系统。该研究直指大模型代理的核心安全隐患，影响多个主流AI代理框架，强调需要严格的输入隔离与权限控制。[原文](https://www.microsoft.com/en-us/security/blog/2026/05/07/prompts-become-shells-rce-vulnerabilities-ai-agent-frameworks/)

### 2. Unit 42 展示多智能体AI系统可自主攻击云环境  
Palo Alto Networks Unit 42 构建了一套多智能体AI系统，展示了其自主执行云环境攻击的能力。该系统能跨服务横向移动、发现并利用错误配置，验证了AI可作为进攻性工具的现实威胁，对云防御和AI安全策略形成全新拷问。[原文](https://unit42.paloaltonetworks.com/autonomous-ai-cloud-attacks/)

### 3. CISA等联合发布Agentic AI服务谨慎采用指南  
CISA联合澳大利亚网络安全中心等机构发布《谨慎采用Agentic AI服务》指南，为企业安全引入自主AI代理提供风险评估、权限管理和持续监控建议。这是应对AI代理系统安全挑战的首份跨国联合指导文件。[原文](https://www.cisa.gov/resources-tools/resources/careful-adoption-agentic-ai-services)

## 值得一看的事

- Dirty Frag Linux本地提权漏洞被积极利用，微软分析其扩大入侵后风险的机制。[原文](https://www.microsoft.com/en-us/security/blog/2026/05/08/active-attack-dirty-frag-linux-vulnerability-expands-post-compromise-risk/)
- CISA将BerriAI LiteLLM SQL注入漏洞（CVE-2026-42208）加入已知被利用目录，该组件广泛用于大模型调用。[原文](https://www.cisa.gov/news-events/alerts/2026/05/08/cisa-adds-one-known-exploited-vulnerability-catalog)
- PAN-OS零日漏洞CVE-2026-0300被用于未经认证的远程代码执行，Unit 42发布威胁简报。[原文](https://unit42.paloaltonetworks.com/captive-portal-zero-day/)
- 教育平台Canvas遭数据勒索攻击，全美多家学校和大学正常教学受到影响。[原文](https://krebsonsecurity.com/2026/05/canvas-breach-disrupts-schools-colleges-nationwide/)
- Trail of Bits利用威胁建模和提示注入审计Comet浏览器，揭示AI浏览功能中对抗性提示的攻击路径。[原文](https://blog.trailofbits.com/2026/02/20/using-threat-modeling-and-prompt-injection-to-audit-comet/)
- 微软揭露ClickFix行动利用伪装macOS工具传播信息窃取器，提醒macOS用户警惕终端命令执行诱骗。[原文](https://www.microsoft.com/en-us/security/blog/2026/05/06/clickfix-campaign-uses-fake-macos-utilities-lures-deliver-infostealers/)
- “Copy Fail”（CVE-2026-31431）Linux提权漏洞影响云与Kubernetes环境，已有在野利用。[原文](https://www.microsoft.com/en-us/security/blog/2026/05/01/cve-2026-31431-copy-fail-vulnerability-enables-linux-root-privilege-escalation/)
- 微软获评KuppingerCole 2026新兴AI安全运营中心报告总体领导者，凸显AI在态势感知与自动化响应中的深度整合。[原文](https://www.microsoft.com/en-us/security/blog/2026/05/06/microsoft-named-an-overall-leader-in-kuppingercole-analysts-2026-emerging-ai-security-operations-center-soc-report/)