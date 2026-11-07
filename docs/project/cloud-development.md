# DharmaGate 云开发与恢复

本说明将源码保全、云端执行、全站整合和生产发布分别验收。Cloudflare 网站在线不代表开发环境已迁移；保存环境名称也不代表云端命令已运行。

## 第一批：静坐与声音应用

目标仓库 `boardx/dharmagate`，分支 `codex/dharmagate-consolidation-20261029`。仅追加经过审查的自有模块与合成测试，不替换整棵历史树。

Node.js 22.23.1；无需第三方包、数据库、Cloudflare 密钥或本机目录：

```sh
npm --prefix tools/cloud-practice ci --ignore-scripts --no-audit --no-fund
npm --prefix tools/cloud-practice test
npm --prefix tools/cloud-practice run build
npm --prefix tools/cloud-practice run verify
npm --prefix tools/cloud-practice run preview
```

预览默认 `http://127.0.0.1:8787/practice/timer`；声音页 `/practice/sounds`。云平台端口代理确需全网卡监听时，显式使用 `HOST=0.0.0.0`，并保留平台访问控制。预览不是完整生产站点。

GitHub Actions `cloud-practice.yml` 在此分支推送及对应 PR 执行 Linux 测试、资源一致性检查和实际 loopback HTTP 验证；权限只有 `contents: read`，不引用 secrets，不部署。

## 专用交互式云环境

- 名称建议 `dharmagate-development`，私人可见；源码仓库 `boardx/dharmagate`，工作分支如上。
- 安装和检查命令使用第一批命令，启动命令使用 `preview`。
- 第一批不需要生产凭据、私有数据库、真实用户或额外服务授权。
- 环境必须实际启动后记录 Linux/Node 版本、检出提交、测试退出码与预览 HTTP 回执，才可标记云开发可用。
- 每次恢复先读 GitHub 分支和已记录执行状态，再继续未知结果；不得盲目重复发布。

## 剩余迁移范围

1. 藏经浏览器与原件处理工具：只迁自有代码；已核权的正文库独立保留，云测试用显式合成 fixture。原文验收与合成测试分开。
2. 百位人物与影视目录：保留逐项来源和署名；图像、影片不随元数据自动迁移。
3. Explore/研究页面：生成资源可能内嵌全文，必须完成内容来源审查后才能迁入公开仓库。
4. 现有生产兼容运行时、会话和绑定：保持私有隔离；备份仓库并不等于当前修复版本已保全。不得复制旧配置里的秘密；需先形成安全私有源码候选。
5. 生产部署：在完整同源构建、绑定和旧资产保留证据、独立复核及回滚检查通过后另行执行；此云开发流水线不能发布半成品。

## 完成标准

关闭 Mac 后，能在真实云环境从远端固定提交检出、运行测试和构建、启动预览、保存新提交，并恢复进度。全站部署还须具备经审查的私有运行时和既有部署访问。没有这些实际回执时，不声明全量迁移完成，也不改变原45项业务验收状态。
