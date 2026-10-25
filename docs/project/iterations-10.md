# DharmaGate 十轮迭代与 GitHub Issues

2026-10-25。45 条 backlog 已映射到本仓库 Issues；固定 R01–R10 编号组织，**未创建 GitHub milestones**。本索引是排期与追溯，不是功能完成、验收或 90 天交付承诺。

## 范围与状态

用户最新指令授权把 backlog 创建为 issues 并分配十轮，取代旧 backlog 快照内“不创建外部 issues”这一项限制；其他安全、许可、费用边界不变。全部问题初始为 open / proposed_pending_baseline，先对账复用既有工作。资料授权、算力、真实跨账户或人工验收缺失时保留 blocked/open，不用 mock 冒充业务验收。

首轮代码已见提交 [25b3003](https://github.com/boardx/dharmagate/commit/25b30038e0870aa0e66258c530adc5e6ee5cdd2c)：[工程检查点](releases/round-01-engineering.md)、[本地回执](releases/round-01-local-receipt.json)记载 npm test 离线 7/7 通过，但保留完整旧静态资产且更新 Worker-first 路由的方法仍待权威证据，发布 blocked，**完成发布轮数 0/10**。这不关闭 #1–#5，也不代表线上登录/AI/支付等已验。

## 执行与关闭标准

1. 每轮内部按前置依赖拓扑执行；可并行无依赖的工作，不得跳过上游验收。
2. 每轮可渐进交付安全可用增量，不必等待 R06 才首次上线；未完成能力使用明确未启用状态，不暴露未授权真实资料。
3. 每轮都需要实现、测试（含负向权限/撤权/旧站回归）、Cloudflare 实际发布回执和线上核验；记录代码 SHA、命令、环境、时间、版本、结果与未验业务。
4. Git 提交、本地测试、计划文档、预览页面均不计作成功生产发布。部署后未验为待验；失败回退不计成功轮次。只有满足相应验收后关闭适用 Issues。
5. 不使用 Cloudflare Stream。影音使用 R2 + 自有播放器；OCR/ASR/转码依赖已批准资源，不自动申请权限、续期凭据、购买算力或开通服务。不能以公开可访问替代资料权利许可。
6. DG-011/016/028 的即时撤权是 P0 底线，不延至 DG-038。外部权利确认/人工审核/招募等待不计入主动人日。

[执行回执协议](releases/execution-protocol.md) · [机器可读完整映射](issue-map.json) · [原始 backlog](backlog.md)

## 十轮总览

| 迭代 | 目标 | 数量 | 主动人日粗估 | 状态 |
|---|---|---:|---:|---|
| [R01](#r01) | 旧站保护与安全发布底座 | 5 | 8–18 | 本地测试通过；发布阻塞 |
| [R02](#r02) | 身份、证据模型与许可闸门 | 6 | 13–28 | 待开始/前置依赖待验 |
| [R03](#r03) | 合规采集与版本处理 | 4 | 9–19 | 待开始/前置依赖待验 |
| [R04](#r04) | 带权利过滤的检索和引用 | 4 | 11–22 | 待开始/前置依赖待验 |
| [R05](#r05) | 证据问答、质量与成本保护 | 5 | 13–28 | 待开始/前置依赖待验 |
| [R06](#r06) | 私人书房、隐私与文本闭环验收 | 4 | 10–21 | 待开始/前置依赖待验 |
| [R07](#r07) | 授权OCR/影音与规模化撤权 | 4 | 15–32 | 待开始/前置依赖待验 |
| [R08](#r08) | 影音检索、教学、机构、多语与试点 | 7 | 28–57 | 待开始/前置依赖待验 |
| [R09](#r09) | 知识图谱、容量和专用模型评估 | 3 | 19–45 | 待开始/前置依赖待验 |
| [R10](#r10) | 跨馆藏、可控推荐与治理互助 | 3 | 16–39 | 待开始/前置依赖待验 |

<a id="r01"></a>

## R01 旧站保护与安全发布底座

| Issue | 优先级 | 前置 Issues | 主动人日 |
|---|---|---|---|
| [DG-001 #1 核对旧站生产基线](https://github.com/boardx/dharmagate/issues/1) | P0 | 无 | 1–2 |
| [DG-002 #2 建立新旧路由兼容测试](https://github.com/boardx/dharmagate/issues/2) | P0 | [DG-001 #1](https://github.com/boardx/dharmagate/issues/1) | 2–4 |
| [DG-003 #3 准备安全发布与回退方案](https://github.com/boardx/dharmagate/issues/3) | P0 | [DG-001 #1](https://github.com/boardx/dharmagate/issues/1)、[DG-002 #2](https://github.com/boardx/dharmagate/issues/2) | 2–4 |
| [DG-004 #4 阻止候选配置污染生产](https://github.com/boardx/dharmagate/issues/4) | P0 | [DG-003 #3](https://github.com/boardx/dharmagate/issues/3) | 1–3 |
| [DG-005 #5 建立环境隔离与配置模板](https://github.com/boardx/dharmagate/issues/5) | P0 | [DG-001 #1](https://github.com/boardx/dharmagate/issues/1) | 2–5 |

<a id="r02"></a>

## R02 身份、证据模型与许可闸门

| Issue | 优先级 | 前置 Issues | 主动人日 |
|---|---|---|---|
| [DG-006 #6 实现身份与租户边界](https://github.com/boardx/dharmagate/issues/6) | P0 | [DG-005 #5](https://github.com/boardx/dharmagate/issues/5) | 3–6 |
| [DG-007 #7 定义作品版本证据数据模型](https://github.com/boardx/dharmagate/issues/7) | P0 | [DG-005 #5](https://github.com/boardx/dharmagate/issues/5) | 2–4 |
| [DG-008 #8 建立R2原件与衍生物存储规范](https://github.com/boardx/dharmagate/issues/8) | P0 | [DG-005 #5](https://github.com/boardx/dharmagate/issues/5)、[DG-007 #7](https://github.com/boardx/dharmagate/issues/7) | 2–4 |
| [DG-009 #9 建立逐来源权利登记](https://github.com/boardx/dharmagate/issues/9) | P0 | [DG-007 #7](https://github.com/boardx/dharmagate/issues/7) | 2–5 |
| [DG-010 #10 选定首批有限授权语料](https://github.com/boardx/dharmagate/issues/10) | P0 | [DG-009 #9](https://github.com/boardx/dharmagate/issues/9) | 2–5 |
| [DG-011 #11 实现发布前权利闸门](https://github.com/boardx/dharmagate/issues/11) | P0 | [DG-009 #9](https://github.com/boardx/dharmagate/issues/9)、[DG-010 #10](https://github.com/boardx/dharmagate/issues/10)、[DG-006 #6](https://github.com/boardx/dharmagate/issues/6) | 2–4 |

<a id="r03"></a>

## R03 合规采集与版本处理

| Issue | 优先级 | 前置 Issues | 主动人日 |
|---|---|---|---|
| [DG-012 #12 实现首个合规来源适配器](https://github.com/boardx/dharmagate/issues/12) | P0 | [DG-010 #10](https://github.com/boardx/dharmagate/issues/10)、[DG-011 #11](https://github.com/boardx/dharmagate/issues/11)、[DG-008 #8](https://github.com/boardx/dharmagate/issues/8) | 3–6 |
| [DG-013 #13 建立幂等采集与处理队列](https://github.com/boardx/dharmagate/issues/13) | P0 | [DG-012 #12](https://github.com/boardx/dharmagate/issues/12) | 2–4 |
| [DG-014 #14 规范化文本并保留原貌](https://github.com/boardx/dharmagate/issues/14) | P0 | [DG-007 #7](https://github.com/boardx/dharmagate/issues/7)、[DG-013 #13](https://github.com/boardx/dharmagate/issues/13) | 2–5 |
| [DG-015 #15 建立去重与版本更新机制](https://github.com/boardx/dharmagate/issues/15) | P0 | [DG-014 #14](https://github.com/boardx/dharmagate/issues/14) | 2–4 |

<a id="r04"></a>

## R04 带权利过滤的检索和引用

| Issue | 优先级 | 前置 Issues | 主动人日 |
|---|---|---|---|
| [DG-016 #16 建立带权利过滤的检索索引](https://github.com/boardx/dharmagate/issues/16) | P0 | [DG-015 #15](https://github.com/boardx/dharmagate/issues/15)、[DG-011 #11](https://github.com/boardx/dharmagate/issues/11) | 3–6 |
| [DG-017 #17 实现混合检索与可解释过滤](https://github.com/boardx/dharmagate/issues/17) | P0 | [DG-016 #16](https://github.com/boardx/dharmagate/issues/16) | 3–6 |
| [DG-018 #18 实现稳定引用定位](https://github.com/boardx/dharmagate/issues/18) | P0 | [DG-007 #7](https://github.com/boardx/dharmagate/issues/7)、[DG-017 #17](https://github.com/boardx/dharmagate/issues/17) | 2–4 |
| [DG-022 #22 实现统一搜索与资料结果页](https://github.com/boardx/dharmagate/issues/22) | P0 | [DG-017 #17](https://github.com/boardx/dharmagate/issues/17)、[DG-018 #18](https://github.com/boardx/dharmagate/issues/18) | 3–6 |

<a id="r05"></a>

## R05 证据问答、质量与成本保护

| Issue | 优先级 | 前置 Issues | 主动人日 |
|---|---|---|---|
| [DG-019 #19 实现证据约束问答流程](https://github.com/boardx/dharmagate/issues/19) | P0 | [DG-017 #17](https://github.com/boardx/dharmagate/issues/17)、[DG-018 #18](https://github.com/boardx/dharmagate/issues/18) | 3–7 |
| [DG-020 #20 实现跨传统与安全回答边界](https://github.com/boardx/dharmagate/issues/20) | P0 | [DG-019 #19](https://github.com/boardx/dharmagate/issues/19) | 2–5 |
| [DG-021 #21 建立预发布质量与权限测试集](https://github.com/boardx/dharmagate/issues/21) | P0 | [DG-010 #10](https://github.com/boardx/dharmagate/issues/10)、[DG-019 #19](https://github.com/boardx/dharmagate/issues/19)、[DG-020 #20](https://github.com/boardx/dharmagate/issues/20) | 3–6 |
| [DG-023 #23 实现有出处的阅读与问答界面](https://github.com/boardx/dharmagate/issues/23) | P0 | [DG-018 #18](https://github.com/boardx/dharmagate/issues/18)、[DG-019 #19](https://github.com/boardx/dharmagate/issues/19)、[DG-022 #22](https://github.com/boardx/dharmagate/issues/22) | 3–6 |
| [DG-027 #27 建立成本可观测与故障保护](https://github.com/boardx/dharmagate/issues/27) | P0 | [DG-013 #13](https://github.com/boardx/dharmagate/issues/13)、[DG-019 #19](https://github.com/boardx/dharmagate/issues/19) | 2–4 |

<a id="r06"></a>

## R06 私人书房、隐私与文本闭环验收

| Issue | 优先级 | 前置 Issues | 主动人日 |
|---|---|---|---|
| [DG-024 #24 实现最小私人书房](https://github.com/boardx/dharmagate/issues/24) | P0 | [DG-006 #6](https://github.com/boardx/dharmagate/issues/6)、[DG-023 #23](https://github.com/boardx/dharmagate/issues/23) | 2–5 |
| [DG-025 #25 建立资料纠错与反馈闭环](https://github.com/boardx/dharmagate/issues/25) | P0 | [DG-018 #18](https://github.com/boardx/dharmagate/issues/18)、[DG-006 #6](https://github.com/boardx/dharmagate/issues/6) | 2–4 |
| [DG-026 #26 落实隐私最小化与数据访问审计](https://github.com/boardx/dharmagate/issues/26) | P0 | [DG-006 #6](https://github.com/boardx/dharmagate/issues/6)、[DG-008 #8](https://github.com/boardx/dharmagate/issues/8)、[DG-024 #24](https://github.com/boardx/dharmagate/issues/24) | 3–6 |
| [DG-028 #28 验收首个上线闭环](https://github.com/boardx/dharmagate/issues/28) | P0 | [DG-004 #4](https://github.com/boardx/dharmagate/issues/4)、[DG-021 #21](https://github.com/boardx/dharmagate/issues/21)、[DG-023 #23](https://github.com/boardx/dharmagate/issues/23)、[DG-024 #24](https://github.com/boardx/dharmagate/issues/24)、[DG-025 #25](https://github.com/boardx/dharmagate/issues/25)、[DG-026 #26](https://github.com/boardx/dharmagate/issues/26)、[DG-027 #27](https://github.com/boardx/dharmagate/issues/27) | 3–6 |

<a id="r07"></a>

## R07 授权OCR/影音与规模化撤权

| Issue | 优先级 | 前置 Issues | 主动人日 |
|---|---|---|---|
| [DG-029 #29 增加扫描资料OCR及人工抽检](https://github.com/boardx/dharmagate/issues/29) | P1 | [DG-028 #28](https://github.com/boardx/dharmagate/issues/28)、[DG-009 #9](https://github.com/boardx/dharmagate/issues/9) | 4–9 |
| [DG-030 #30 增加影音转写与术语校正](https://github.com/boardx/dharmagate/issues/30) | P1 | [DG-028 #28](https://github.com/boardx/dharmagate/issues/28)、[DG-009 #9](https://github.com/boardx/dharmagate/issues/9) | 4–9 |
| [DG-031 #31 建设R2影音播放器](https://github.com/boardx/dharmagate/issues/31) | P1 | [DG-008 #8](https://github.com/boardx/dharmagate/issues/8)、[DG-028 #28](https://github.com/boardx/dharmagate/issues/28) | 4–8 |
| [DG-038 #38 扩展多来源影音权利清退](https://github.com/boardx/dharmagate/issues/38) | P1 | [DG-028 #28](https://github.com/boardx/dharmagate/issues/28)、[DG-011 #11](https://github.com/boardx/dharmagate/issues/11)、[DG-016 #16](https://github.com/boardx/dharmagate/issues/16) | 3–6 |

<a id="r08"></a>

## R08 影音检索、教学、机构、多语与试点

| Issue | 优先级 | 前置 Issues | 主动人日 |
|---|---|---|---|
| [DG-032 #32 实现影音时间码检索](https://github.com/boardx/dharmagate/issues/32) | P1 | [DG-030 #30](https://github.com/boardx/dharmagate/issues/30)、[DG-031 #31](https://github.com/boardx/dharmagate/issues/31)、[DG-018 #18](https://github.com/boardx/dharmagate/issues/18) | 3–6 |
| [DG-033 #33 增加原文与异译对照](https://github.com/boardx/dharmagate/issues/33) | P1 | [DG-028 #28](https://github.com/boardx/dharmagate/issues/28)、[DG-015 #15](https://github.com/boardx/dharmagate/issues/15) | 4–8 |
| [DG-034 #34 建立法师教师审核工作台](https://github.com/boardx/dharmagate/issues/34) | P1 | [DG-028 #28](https://github.com/boardx/dharmagate/issues/28)、[DG-006 #6](https://github.com/boardx/dharmagate/issues/6) | 4–9 |
| [DG-035 #35 试点三条人本学习路径](https://github.com/boardx/dharmagate/issues/35) | P1 | [DG-034 #34](https://github.com/boardx/dharmagate/issues/34)、[DG-020 #20](https://github.com/boardx/dharmagate/issues/20) | 4–8 |
| [DG-036 #36 建立机构资料接入工作流](https://github.com/boardx/dharmagate/issues/36) | P1 | [DG-028 #28](https://github.com/boardx/dharmagate/issues/28)、[DG-009 #9](https://github.com/boardx/dharmagate/issues/9)、[DG-025 #25](https://github.com/boardx/dharmagate/issues/25) | 4–8 |
| [DG-037 #37 扩展多语言检索评测](https://github.com/boardx/dharmagate/issues/37) | P1 | [DG-028 #28](https://github.com/boardx/dharmagate/issues/28)、[DG-021 #21](https://github.com/boardx/dharmagate/issues/21) | 5–10 |
| [DG-039 #39 开展真实试点与成本优化](https://github.com/boardx/dharmagate/issues/39) | P1 | [DG-028 #28](https://github.com/boardx/dharmagate/issues/28)、[DG-027 #27](https://github.com/boardx/dharmagate/issues/27) | 4–8 |

<a id="r09"></a>

## R09 知识图谱、容量和专用模型评估

| Issue | 优先级 | 前置 Issues | 主动人日 |
|---|---|---|---|
| [DG-040 #40 建设人工可审校知识关系图](https://github.com/boardx/dharmagate/issues/40) | P2 | [DG-033 #33](https://github.com/boardx/dharmagate/issues/33)、[DG-037 #37](https://github.com/boardx/dharmagate/issues/37)、[DG-036 #36](https://github.com/boardx/dharmagate/issues/36) | 8–18 |
| [DG-043 #43 按实测瓶颈扩容与灾备](https://github.com/boardx/dharmagate/issues/43) | P2 | [DG-039 #39](https://github.com/boardx/dharmagate/issues/39)、[DG-038 #38](https://github.com/boardx/dharmagate/issues/38) | 6–15 |
| [DG-044 #44 评估专用模型而非默认训练](https://github.com/boardx/dharmagate/issues/44) | P2 | [DG-039 #39](https://github.com/boardx/dharmagate/issues/39)、[DG-037 #37](https://github.com/boardx/dharmagate/issues/37)、[DG-011 #11](https://github.com/boardx/dharmagate/issues/11) | 5–12 |

<a id="r10"></a>

## R10 跨馆藏、可控推荐与治理互助

| Issue | 优先级 | 前置 Issues | 主动人日 |
|---|---|---|---|
| [DG-041 #41 扩展跨馆藏版本对齐](https://github.com/boardx/dharmagate/issues/41) | P2 | [DG-040 #40](https://github.com/boardx/dharmagate/issues/40)、[DG-015 #15](https://github.com/boardx/dharmagate/issues/15) | 6–15 |
| [DG-042 #42 增加用户可控个性化建议](https://github.com/boardx/dharmagate/issues/42) | P2 | [DG-035 #35](https://github.com/boardx/dharmagate/issues/35)、[DG-026 #26](https://github.com/boardx/dharmagate/issues/26)、[DG-039 #39](https://github.com/boardx/dharmagate/issues/39) | 5–12 |
| [DG-045 #45 探索受治理的人类互助空间](https://github.com/boardx/dharmagate/issues/45) | P2 | [DG-034 #34](https://github.com/boardx/dharmagate/issues/34)、[DG-026 #26](https://github.com/boardx/dharmagate/issues/26)、[DG-039 #39](https://github.com/boardx/dharmagate/issues/39) | 5–12 |

## 对账规则

Issue 正文保留角色、交付、原验收、估算口径和关闭闸门；尚未分派真人。十轮跨度取决于实际团队、依赖和权利/算力可用性，轮次人日不可当作自然日。新证据先回写具体 Issue 和该轮回执，再更新索引；不得因后续轮次计划存在而声明之前轮次已经完成。
