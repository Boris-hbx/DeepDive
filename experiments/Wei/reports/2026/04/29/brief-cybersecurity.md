# 网络安全每日 Brief — 2026-04-29

## 最关注的事

### 1. Claude Mythos 在 Firefox 中发现 271 个零日漏洞
Anthropic 的前沿模型 Claude Mythos 已自主发现 Firefox 浏览器中 271 个零日漏洞，并能生成实际攻击利用代码。这一数字远超人类研究员长期积累的成果，标志着 AI 已具备规模化、高质量的“攻击性安全”能力，将从根本上改变漏洞发现与修复的攻防节奏。 [原文](https://www.schneier.com/blog/archives/2026/04/claude-mythos-has-found-271-zero-days-in-firefox.html)

### 2. TeamPCP 发起针对安全基础设施的多阶段供应链攻击
攻击组织 TeamPCP 持续升级其供应链攻击行动，最新活动直接瞄准安全防护软件本身的更新渠道，实现了对“保护者”的武器化。与此同时，TeamPCP 宣布与 Vect 勒索组织建立合作，这既放大了供应链破防后的勒索杀伤力，也为防御体系提出了更严峻的横向渗透挑战。 [原文](https://unit42.paloaltonetworks.com/teampcp-supply-chain-attacks/)

### 3. CISA 将 ConnectWise ScreenConnect 漏洞纳入已知被利用目录
CISA 基于活跃利用证据，将 CVE-2024-1708（ConnectWise ScreenConnect 路径遍历漏洞）等两个漏洞添加至 KEV 目录。ScreenConnect 作为广泛部署的远程管理工具，其路径遍历缺陷可被攻击者用于突破边界、窃取敏感数据，联邦机构及企业需按 BOD 22-01 要求紧急修补。 [原文](https://www.cisa.gov/news-events/alerts/2026/04/28/cisa-adds-two-known-exploited-vulnerabilities-catalog)

## 值得一看的事

- Unit 42 发现前沿 AI 模型不仅加速漏洞发现，更能像全栈安全研究员一样自主完成零日发现与 N-day 补丁分析。 [原文](https://unit42.paloaltonetworks.com/ai-software-security-risks/)
- Unit 42 构建的多智能体 AI 系统成功对云环境发起自主攻击，验证了 AI 向云平台扩散攻击的可行性。 [原文](https://unit42.paloaltonetworks.com/autonomous-ai-cloud-attacks/)
- 微软与 Anthropic 联手将前沿模型能力转化为规模化防护，通过 AI 驱动的防御体系应对 AI 加速的威胁态势。 [原文](https://www.microsoft.com/en-us/security/blog/2026/04/22/ai-powered-defense-for-an-ai-accelerated-threat-landscape/)
- Unit 42 剖析 npm 供应链威胁演进，发现蠕虫式恶意软件、CI/CD 持久化及多阶段攻击等新趋势。 [原文](https://unit42.paloaltonetworks.com/monitoring-npm-supply-chain-attacks/)
- CISA 发布针对中国关联的隐蔽受控设备网络的防御指南，解析此类网络的大规模转向战术与防护措施。 [原文](https://www.cisa.gov/news-events/cybersecurity-advisories/aa26-113a)