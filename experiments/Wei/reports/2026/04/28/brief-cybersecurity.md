# 网络安全每日 Brief — 2026-04-28

## 最关注的事

### 1. Anthropic Claude Mythos 可自主发现并武器化漏洞
Anthropic 发布的 Claude Mythos 预览版展示出里程碑式能力：模型可在无专家指导下自主挖掘软件漏洞并直接生成可用的攻击代码。这一进展大幅降低了零日利用的门槛，将深刻改变攻防平衡，敦促安全行业加速构建针对 AI 驱动攻击的防御与响应体系。 [原文](https://www.schneier.com/blog/archives/2026/04/what-anthropics-mythos-means-for-the-future-of-cybersecurity.html)

### 2. CISA 新增 4 个已知被利用漏洞，需立即响应
CISA 基于主动利用证据将 CVE-2024-7399（三星 MagicINFO 9 服务器路径遍历）等四个漏洞列入已知被利用漏洞目录。这些漏洞正在被现实攻击所利用，相关组织必须紧急排查、修补并加强监控，以阻断已确认的入侵途径。 [原文](https://www.cisa.gov/news-events/alerts/2026/04/24/cisa-adds-four-known-exploited-vulnerabilities-catalog)

### 3. 前沿 AI 模型实现自主云攻击并加速漏洞发现
Unit 42 的研究揭示，多代理 AI 系统已能对云环境发动全自动攻击，前沿模型等同于具备全谱能力的安全研究员，可自主发现零日漏洞并极大缩短 N-day 修补窗口。这要求安全负责人根本性地重新评估云暴露面及 AI 驱动的攻击链。 [原文](https://unit42.paloaltonetworks.com/autonomous-ai-cloud-attacks/)

## 值得一看的事

- TeamPCP 发起针对安全基础设施的多阶段供应链攻击，并宣布与 Vect 勒索软件团伙合作，直接威胁防护工具本身的可信性。 [原文](https://unit42.paloaltonetworks.com/teampcp-supply-chain-attacks/)
- CISA 发布防御中国相关隐蔽受感染设备网络的指引，警告战术正转向利用大量受控设备建立隐秘基础设施。 [原文](https://www.cisa.gov/news-events/cybersecurity-advisories/aa26-113a)
- Unit 42 分析 npm 供应链攻击新趋势，发现蠕虫化恶意软件和 CI/CD 持久化技术，开发人员需加固包管理安全。 [原文](https://unit42.paloaltonetworks.com/monitoring-npm-supply-chain-attacks/)
- OWASP 呼吁建立统一的全球漏洞情报框架，以弥补现有 CVE 体系在可持续性和信任方面的缺陷。 [原文](http://owasp.org/blog/2025/04/17/owasp-global-vulnerability-intelligence.html)
- Trail of Bits 开源 Trailmark 工具，可将源代码解析为可查询的调用图并暴露语义元数据，辅助恶意代码和漏洞分析。 [原文](https://blog.trailofbits.com/2026/04/23/trailmark-turns-code-into-graphs/)