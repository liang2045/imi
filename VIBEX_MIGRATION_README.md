# imi 达人管理 VibeX 迁移包

这个包用于把当前 imi 达人管理项目迁移到 VibeX。当前源项目是 Next.js + TypeScript；VibeX 参考项目是 Vite + React + PocketBase，因此迁移不是简单上传后直接运行，而是需要执行 `VIBEX_MIGRATION_PROMPT.md` 中的架构转换。

## 使用方法

1. 将 `source` 目录上传到 VibeX 项目工作区。
2. 将 `VIBEX_MIGRATION_PROMPT.md` 作为迁移任务提示词提交给 VibeX AI。
3. 要求先完成架构转换，再逐项执行验收清单。
4. 迁移完成后，检查 VibeX 是否已经注入默认 RunningHub AI 调用身份和余额；不需要在应用内新增 RunningHub 登录页。

## 重要边界

- 本包不包含 `.env.local`、真实 API Key、Supabase Service Role Key、Session Secret、Cookie 或构建产物。
- 当前源代码中的 RunningHub 直连适配用于独立服务器；迁移到 VibeX 后应改为使用 VibeX 默认的 RunningHub AI 调用身份和余额，不要求安装用户配置 API Key。
- 不要在 VibeX 应用中新增独立 RunningHub 登录页或共享 API Key 输入框。

## 源码内容

`source` 中包含当前项目的源代码、数据库迁移、测试、部署文档和 AI/物流功能实现，不包含依赖目录和 `.next` 构建目录。
