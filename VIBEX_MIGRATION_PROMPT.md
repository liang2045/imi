# imi 达人管理迁移到 VibeX 执行提示词

请将本压缩包中的 `source` 项目完整迁移为可在 VibeX 平台运行的 React + Vite + PocketBase 应用，并保留现有业务功能、数据结构、视觉设计和交互动画。

## 迁移目标

应用名称：imi达人管理

需要保留：

- 达人资源库：新增、编辑、删除、多平台账号、平台链接、粉丝数、标签、城市和负责人。
- 达人合作数据：合作节点、合作意向、提报结果、拒绝原因、费用和排序。
- 月份切换：当前月份自动生成，7 月及以后空月初始化，项目充值预算沿用但已充值/已消耗归零。
- 项目充值进度：预算、已充值、已消耗、剩余可充值、充值进度和项目合计。
- 样品邮寄：待寄出、已寄出、已签收、样品内容、产品编码、数量、快递单号、物流轨迹、导出表格。
- 真实物流查询：优先保留快递100/快递鸟适配器；未配置时回退手工台账。
- AI 分析中心、AI 报告、AI 审计和 AI 表格校验。
- 深色模式、侧栏折叠、响应式桌面界面、现有动画和提示反馈。

## 必须完成的架构改造

1. 将 Next.js App Router 页面改为 Vite React 入口，保持现有 `DashboardApp` 业务组件可以复用。
2. 将 `src/app/api/*` 中的服务端接口迁移为 PocketBase `pb_hooks/*.pb.js` 路由。
3. 将本地 Supabase 数据访问改成 PocketBase collection；如果没有配置数据库，保留 localStorage 演示模式。
4. 不新增单独的 RunningHub 登录页；VibeX 运行环境默认使用当前 VibeX/RunningHub 账户余额和平台注入的调用身份。
5. 使用 VibeX 平台提供的默认身份调用 PocketBase Hook；不要把 RunningHub token 或 API Key 放入浏览器请求体、Excel、localStorage 或导出文件。
6. AI 文本调用使用 PocketBase `/api/llm/chat` 和 `/api/llm/poll`，模型 allowlist 默认启用 `doubao-seed-evolving`，实际模型为 `bytedance/doubao-seed-evolving`。
7. 将样品物流 `/api/shipping` 迁移为 PocketBase Hook，保留 `createTracking`、`refreshTracking`、`handleWebhook` 接口契约。
8. 所有写操作保留原有校验、权限判断、金额单位和状态迁移规则。

## VibeX 账号和 AI 规则

- 不要求安装用户填写 RunningHub API Key。
- 不实现单独的 RunningHub 登录流程；直接使用 VibeX 默认提供的 RunningHub 余额、权限和调用身份。
- 每次 LLM 请求由 VibeX 平台处理权限和计费。
- 如果 VibeX 平台没有提供默认 AI 调用身份，必须报告阻塞，不得退回到把一个共享 API Key 写进前端。
- 仅在服务端 Hook 中读取平台注入的密钥或 token。

## 验收要求

- VibeX 在线预览可以直接调用默认 RunningHub AI 能力和余额。
- AI 助手、AI 表格校验和 AI 报告能调用 VibeX 默认模型权限；模型失败时回退本地确定性分析。
- 资源库、合作、充值、物流、导入、导出和同步流程全部可用。
- `npm run build`、Vite 预览和 PocketBase 启动均通过。
- 不生成或提交任何真实 API Key、Cookie、Session Secret、Supabase Service Role Key。

## 迁移完成后输出

请生成：

- VibeX 可导入源代码目录。
- `vibex-local/README.md`，包含本地启动、PocketBase 启动和环境变量说明。
- `pocketbase/pb_hooks/` 下的所有服务端 Hook。
- `MIGRATION_REPORT.md`，逐项说明保留、改造、未完成和需要 VibeX 平台权限的功能。
- 如果无法使用 VibeX 默认 AI 身份，请明确写出原因，不要伪造调用成功。
