# 全站反馈与管理员审核

用户在每个正常 HTML 页面点击「意见反馈」，填写类型、标题、说明。匿名可提交，保存页面路径，不保存查询参数、片段、账户或邮箱。每个来源 IP 每小时最多 5 次，数据库只保留哈希限流桶并清理旧桶。后台 `/admin/feedback` 支持状态筛选、分页、拒绝原因、批准创建 GitHub Issue、同步失败重试及 Issue 链接。

状态：pending → syncing → published；失败进入 sync_failed；pending 可进入 rejected。审批用 D1 条件更新加锁。重试先查找 Issue 内的反馈 ID 标记，避免响应丢失后的重复创建。核对失败或超过 10,000 条 Issue 时停止创建。已发布反馈重复批准直接返回已有链接。审核人和拒绝原因不发布到 GitHub。

## 生产接入

当前仓库没有完整生产源码、真实管理员会话解析器、Wrangler 配置或生产绑定。实现是可接入的 Worker 模块，尚未上线。遵循现有恢复限制，不能操作未知旧站数据库或推测生产部署配置。

```js
import {createFeedbackWorker} from './src/feedback-worker.mjs';
import {createFeedbackStore} from './src/feedback-store.mjs';
import {createFeedbackGithub} from './src/feedback-github.mjs';

export default {
  fetch(request, env, ctx) {
    return createFeedbackWorker(existingWorker, {
      store: createFeedbackStore(env.FEEDBACK_DB),
      github: createFeedbackGithub({
        token: env.FEEDBACK_GITHUB_TOKEN,
        repository: env.FEEDBACK_GITHUB_REPOSITORY,
      }),
      resolveAdmin: readVerifiedExistingAdmin,
    }).fetch(request, env, ctx);
  },
};
```

1. 创建专用 FEEDBACK_DB D1 绑定，仅对它执行 migrations/0001-feedback.sql，不迁移旧站数据库。
2. 使用服务端 secret 配置 FEEDBACK_GITHUB_TOKEN，权限只需目标仓库 Issues 读写；FEEDBACK_GITHUB_REPOSITORY 为 boardx/dharmagate。不要提交凭据。
3. 实现 readVerifiedExistingAdmin(request, env)，验证真实服务器会话和权威管理员成员资格，返回 {id} 或 null。每次请求检查权限，不能信任浏览器角色声明；现有 reviewer 角色不自动等于管理员。
4. 在现有 Worker 最外层包装。平台需将 API、后台、脚本及所有页面 HTML 路由到 Worker。CDN 直接返回的静态 HTML 无法经过注入。
5. 保留原页面 CSP；staging 验证同源脚本和 connect-src。要求 nonce 的策略需在真实构建层适配，不能放宽策略。

如果 Worker 被平台强制终止，反馈可能停留 syncing。运维确认旧调用已结束后，在专用数据库将该条记录设为 sync_failed，再从后台重试并核对 Issue 标记。不要在旧调用仍可能执行时释放锁。目前没有自动队列或自动锁过期。

## 验证

运行 npm test。测试使用内存 store 和模拟 GitHub，覆盖提交校验、查询参数拒绝、跨站保护、管理员权限、并发和重复批准、失败保留、拒绝状态、GitHub 标记核对及创建。没有访问生产数据库或创建真实 Issue。

生产上线前需使用真实 D1 和登录体系验收所有页面布局、移动端及键盘弹窗操作、CSP、分页、限流、权限撤销、同步失败重试和原站资源路由。用户反馈内容以 textContent 显示；API 和后台禁止缓存；令牌与 GitHub 错误详情不返回客户端。
