# 可移植的静坐与声音应用预览

此目录是零第三方运行依赖的 Node.js 22+ runner，直接导入本仓库的实际自有应用代码。它不需要根目录的 `node_modules`、`.local`、Wrangler、Cloudflare 登录、数据库或私有运行时。

从仓库根目录执行：

```sh
node --version
npm --prefix tools/cloud-practice ci --ignore-scripts --no-audit --no-fund --offline
npm --prefix tools/cloud-practice run build
npm --prefix tools/cloud-practice test
npm --prefix tools/cloud-practice run verify
npm --prefix tools/cloud-practice run preview
```

默认仅监听 `127.0.0.1:8787`，打开 `http://127.0.0.1:8787/practice/timer` 或 `/practice/sounds`。`verify` 使用真实临时 loopback HTTP 服务检查 GET、HEAD、405、JS、CSP 和路由范围，完成或失败都会关闭服务。`build` 只核对已生成资源与当前实际源逐字一致，不写源文件。`test` 自动运行根目录 `apps/web/test/practice*.test.mjs`，包括 portal 和实际客户端生命周期的合成回归。

只有云预览平台确实需要监听所有网卡时，才显式指定：

```sh
HOST=0.0.0.0 PORT=8787 npm --prefix tools/cloud-practice run preview
```

这会扩大监听范围；公网访问控制、HTTPS 与代理由所用云环境负责，不会在这里创建权限、凭据或自动发布。按 Ctrl+C 停止预览。

## 必须一同保全的源文件

- 本目录全部文件。
- `apps/web/src/practice/` 中的应用、计时模型、音频引擎、客户端、生成资源与资源构建脚本。
- `apps/web/src/practice-portal.mjs`。
- `apps/web/data/practice-research.json`。
- `apps/web/test/practice*.test.mjs`。

本包只提供静坐与声音应用，以及 portal 的自有 CSS/JS；`/` 仅跳转到计时页。`/zh`、账户、管理后台、藏经、旧业务与任何生产绑定均不在预览范围，不会以示例页面冒充完整网站。全站生产整合仍需受保护运行时及独立部署验收。

## 验证边界

没有外部网络 API、音频下载或账户操作。声音由浏览器 Web Audio 合成，必须由用户点击才能播放；后台/缓存恢复行为已做实际客户端脚本的合成测试，但自动测试不等于真实 iOS 锁屏、听感或手机排版验收。网页不保证后台提示音准时播放，不收集或上传健康数据。
