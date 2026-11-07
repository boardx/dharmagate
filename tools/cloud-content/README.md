# 藏经：独立云端源码检查

Node 22.23.1、Python 3。无需 npm 第三方依赖、私有运行时或真实语料。

```sh
npm --prefix tools/cloud-content ci --ignore-scripts --offline --no-audit --no-fund
npm --prefix tools/cloud-content test
npm --prefix tools/cloud-content run build
```

测试运行真实模块与明确合成 XML、内存存储、VM fixture；不从生产下载正文。`build`检查语法和服务端依赖闭包并输出逐文件哈希，不生成完整生产 Worker。阅读器 DOMParser 的真实浏览器测试和全量原件验收不由此替代。

本批不包含影片、图片或人物原文简传。100项影视的另分支源码与本机旧37项目录分开核对，不以旧目录覆盖新版。用户的100人和全藏要求仍保留，不能以本批源码检查当作内容穷尽、人审或生产验收。
