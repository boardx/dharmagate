# DharmaGate 项目定义与开发计划

版本：v0.1 设计提案 · 2026-10-25

本目录统一保存三份正式设计文档与开发 backlog。它们不是已部署、已下载全量资料或已通过业务验收的声明；首先对账既有成果，再决定实施基线。

## 三份正式文档

| 文档 | 可维护正文 | Word | PDF |
| --- | --- | --- | --- |
| 产品定义 | [阅读正文](product-definition.zh-CN.md) | [Word](exports/DharmaGate_Product_Definition_ZH_v0.1.docx) | [PDF](exports/DharmaGate_Product_Definition_ZH_v0.1.pdf) |
| 架构定义 | [阅读正文](architecture-definition.zh-CN.md) | [Word](exports/DharmaGate_Architecture_Definition_ZH_v0.1.docx) | [PDF](exports/DharmaGate_Architecture_Definition_ZH_v0.1.pdf) |
| UI/UX 用户体验设计 | [阅读正文](uiux-design.zh-CN.md) | [Word](exports/DharmaGate_UIUX_Design_ZH_v1.docx) | [PDF](exports/DharmaGate_UIUX_Design_ZH_v1.pdf) |

产品定义回答为谁、解决什么、首发范围与验收；架构定义回答数据、Cloudflare 能力、检索 AI、安全与运维；UI/UX 定义关键旅程、页面、状态及桌面/移动线框。UI/UX 文件名 v1 为首次交付，三份同属本轮设计提案。

## 共同约束

- 不使用 Cloudflare Stream；影音采用 R2 与自有播放器，转码、OCR、ASR 算力独立核准。
- 全球最完整是长期覆盖目标，不是当前馆藏或全量下载承诺。逐来源、作品和用途核权；不绕过访问限制。
- AI 服务理解、反思与实践，不评价证悟，不替代真人师长或专业支持。
- 首个闭环为一条许可清楚来源、10–30 部代表性资料的文本检索与证据问答；影音按后续优先级推进。
- 文件上传不代表授权生产变更、批量抓取、购买服务或新增资源。现有入口、绑定、数据与回退需单独验证。

## 开发与辅助材料

- [45 项 backlog](backlog.md) · [CSV](backlog.csv) · [JSON](backlog.json)：稳定 DG 编号、依赖、责任角色、交付与验收；状态为待现状对账的建议计划，不自动创建 Issues。
- [架构 Mermaid 源文件](architecture.mmd) · [架构图](assets/architecture.png)
- [来源与权利矩阵](source-rights-matrix.md)
- [人本体验与 AI 治理辅助说明](human-experience-and-governance.md)
- [既有研究档案入口](../../README.md) · [版权与转载边界](../../COPYRIGHT.md)

维护时应同步更新相关正文、结构化 backlog 与导出文件；完成状态必须有实际版本、测试和审阅回执。既有研究档案及其逐项权利说明保留，不因本目录新增而改变授权。
