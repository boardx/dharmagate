# Dharmagate 来源与权利矩阵

版本 v0.1 · 官方来源核验日期 2026-10-25 · 候选来源不等于已获权或已下载

本表从产品定义派生，用于逐资源权利核查，完整治理规则见 [产品定义](product-definition.zh-CN.md)。

## 文字与经典来源矩阵

以下是候选来源，不是已获得完整镜像授权的名单。按每个集合与作品核验，不能把同一机构旗下所有数据套用一个许可；元数据本身也可能有批量复用条件。建议先从许可清楚、机器可读、版本结构稳定的集合建立小规模样板。

| 来源 | 优先价值 | 首期处理与权利门槛 |
| --- | --- | --- |
| SuttaCentral Bilara | 巴利经典与多语对照 | 优先核验并接入支持创建且明确 CC0 的文本。Bilara 支持创建的译文许可不能泛化到全站第三方资源。[B1] |
| CBETA | 汉文典籍及结构化标记 | 默认 CC BY NC SA 4.0；印顺、吕澂、太虚、演培相关资料另有例外。逐集合审批，不能据默认许可全量复制。[B2] |
| SAT | 大正藏检索及图像参照 | 主库学术与非营利用途、禁止再分发；图像库及嘉兴藏规则不同。先目录和链接，授权后再复制指定集合。[B3] |
| BDRC | 藏文与相关传统书目和扫描 | 优先联合目录及馆藏关联。平台不拥有底本版权，开放下载不是通用转授权；逐项查访问政策和权利状态。[B4] |
| 84000 | 藏传典籍英译与版本语义 | 官网所见条款页面明确标为 DRAFT；不当作最终授权。先目录或原站入口，逐篇确认现行许可或正式合作。[B5] |
| 其他研究与馆藏库 | 梵文、日文、敦煌与手稿 | 按机构白名单逐个研究；先登记稳定标识符和馆藏来源，未确认的全文不下载、不训练。 |

### 首批来源选择规则

选择 3 至 5 个来源先验证合作流程、文本质量和引用定位，而不是一次开启全球抓取。每个来源指定数据负责人及学术校核人，检查版本更新、字段语义、字符编码、撤回机制和归属信息。若上游提供正式数据包或接口，优先于网页抓取；保留上游 ID，方便增量同步与双向纠错。

对不可镜像的资源，优秀的联合目录仍能提供价值：用标准化题名、异名、译者、典籍编号与来源链接，把分散藏品连起来，并清楚告知为何只能跳转原站。不要以限制为由绕开来源机构，更不要把无法下载的文本从全球覆盖报告中抹掉。

## 补充来源矩阵与版本差异

以下来源帮助扩展术语、梵文、现代研究与影音，但仍遵循逐文件、逐数据子集的权利检查。候选合作方不等于已经授权的伙伴。

| 来源 | 可利用内容 | 首期动作与边界 |
| --- | --- | --- |
| DILA 规范库 | 人名 地名 时间及 TEI 数据 | 仓库数据 CC BY SA 3.0；只按仓库实际子集使用，不套用于线上 API 中其他机构条目。[B6] |
| SARIT | 梵文与结构化 TEI | 已核《佛所行赞》文件头为 CC BY SA 4.0；按文件核验，不推定整个库相同。[B7] |
| GRETIL | 分语言数据包与古典文本 | 同作品的另一数字版本可能为 CC BY NC SA 4.0，保留独立来源与许可。[B8] |
| Access to Insight | 英语译文与部分巴利文本 | 逐页许可不同，不可将其中公版部分推为全站公版；先目录再逐项审核。[B9] |
| Dhammatalks | 音频 文字 RSS 与 ZIP | 默认 CC BY NC 4.0，并有旧版 free distribution 条件；核对每项，不直接纳入付费内容库。[B10] |
| 台大佛学数字图书馆 | 现代佛学研究书目 | 先作为书目发现与外链，内容归台大或作者；允许个人下载不等于允许镜像。[B11] |
| 日韩与手稿馆藏 | 韩国 ABC 犍陀罗 敦煌等 | 逐馆合作与逐件权利核查；尚未核清的集合不进入自动下载白名单。 |
| YouTube 与第三方平台 | 公开视频发现与合法嵌入 | API 访问不是下载许可；未经所需批准不抓取频道影音。[B12] |

### 同作品不同版本必须分别登记

SARIT 与 GRETIL 的《佛所行赞》示例说明，古典作品相同，不等于数字版本许可相同。原始录入、底本、校勘和格式转换形成的来源链，都应出现在 provenance 中。BDRC 的本体可以借鉴作品、版本、人物与地名模型，但其本体 CC0 不等于全部扫描或元数据也是 CC0。[B7][B8][B13]

敦煌和其他手稿的数字图像需看每一件标明的公版、开放许可或第三方权利。不得从馆方‘开放访问’宣传语推断整馆影像可镜像；对韩国 ABC 等尚未完成官方条款核查的来源，本版只列研究线索。[B14]

## 资料与权利核验来源

核验日期为 2026 年 10 月 25 日。链接指向官方政策、机构或官方代码仓库；每个集合的最终授权仍需按具体版本和用途核定。

- [[B1] SuttaCentral Bilara 许可](https://github.com/suttacentral/bilara-data/blob/published/LICENSE.md)
- [[B2] CBETA 版权与例外集合](https://cbeta.org/copyright)
- [[B3] SAT 使用条款与不同数据库的规则](https://21dzk.l.u-tokyo.ac.jp/SAT/termsofuse.html)
- [[B4] BDRC 访问政策](https://www.bdrc.io/access-policies/)
- [[B5] 84000 使用条款草案 不能作为最终授权](https://84000.co/documents/terms-of-use)
- [[B6] DILA Authority Databases 仓库与许可](https://github.com/DILA-edu/Authority-Databases)
- [[B7] SARIT 佛所行赞 TEI 文件与许可](https://github.com/sarit/SARIT-corpus/blob/master/asvaghosa-buddhacarita.xml)
- [[B8] GRETIL 佛所行赞数字版本](https://gretil.sub.uni-goettingen.de/gretil/corpustei/transformations/html/sa_azvaghoSa-buddhacarita.htm)
- [[B9] Access to Insight 常见问题与许可说明](https://accesstoinsight.org/faq.html)
- [[B10] Dhammatalks 资源与许可](https://www.dhammatalks.org/)
- [[B11] 台大佛学数字图书馆著作权说明](https://buddhism.lib.ntu.edu.tw/copyright2.htm)
- [[B12] YouTube API 开发者政策](https://developers.google.com/youtube/terms/developer-policies)
- [[B13] BDRC BUDA 本体与 CC0 许可](https://github.com/buda-base/owl-schema)
- [[B14] British Library 使用条款与逐项权利](https://www.bl.uk/terms)
