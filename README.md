# imi达人管理

面向品牌团队的达人资源、合作流程、样品物流、结算与分析工作台。

## 本地运行

```powershell
npm.cmd install
npm.cmd run dev
```

打开 `http://localhost:3000`。未配置钉钉登录时，系统保留浏览器本地演示数据和演示登录。

## UI 设计与部署

- UI 规范：[docs/UI_DESIGN_SYSTEM.md](./docs/UI_DESIGN_SYSTEM.md)
- AI 部署执行文档：[AI_DEPLOYMENT.md](./AI_DEPLOYMENT.md)
- 统一主题覆盖层：`src/app/design-system.css`

设计系统采用浅蓝灰画布、白色卡片、黑色高对比文字和单一荧光黄绿色强调色。部署前必须运行：

```bash
npm ci
npm run lint
npm test
npm run build
```

## 本地导出目录

在右上角“系统设置”里填写“导出表格保存目录”，例如 `E:\imi-exports`。填写后，达人资源库和样品邮寄统计导出的 Excel 会保存到运行本应用的这台电脑目录；留空时仍使用浏览器下载。

## 钉钉登录

复制 `.env.example` 为 `.env.local`，填写：

- `DINGTALK_CLIENT_ID`
- `DINGTALK_CLIENT_SECRET`
- `DINGTALK_REDIRECT_URI`
- `SESSION_SECRET`
- `LOCAL_APP_ORIGIN`
- `ADMIN_DINGTALK_UNION_IDS`

登录流程：

1. 登录页点击“使用钉钉登录”。
2. `/api/auth/dingtalk/start` 跳转钉钉 OAuth。
3. `/api/auth/dingtalk/callback` 换取用户信息并写入 httpOnly session cookie。
4. 已启用用户进入工作台；未启用用户显示待管理员启用。

详细本地服务器和回调域名配置见 [LOCAL_SERVER.md](./LOCAL_SERVER.md)。

## AI 表格校验

达人资源库、项目充值进度、样品邮寄表均提供“AI 校验”入口。它会先显示字段识别、结构错误、重复项和可选择的格式修复；只有点击“确认应用并导入”后才会改变系统中的数据，原有导入和同步功能保持不变。

统一 AI 网关必须部署在团队共用的 Next.js 服务端，并启用钉钉登录。仅在该服务器的 `.env.local` 配置以下变量，安装客户端、浏览器和 Excel 中均不保存模型密钥：

```text
AI_ENABLED=true
AI_PROVIDER=runninghub
RUNNINGHUB_BASE_URL=https://llm.runninghub.cn/v1
RUNNINGHUB_API_KEY=服务器端 RunningHub API Key
RUNNINGHUB_MODEL=bytedance/doubao-seed-evolving
RUNNINGHUB_APP_CODE=vibex
AI_TIMEOUT_MS=20000
AI_MAX_ROWS=250
AI_MAX_BYTES=400000
```

如果使用其他 OpenAI 兼容服务，则改用以下配置：

```text
AI_ENABLED=true
AI_PROVIDER=compatible
AI_BASE_URL=https://api.openai.com/v1
AI_API_KEY=服务器端模型密钥
AI_MODEL=你的模型名称
AI_TIMEOUT_MS=20000
AI_MAX_ROWS=250
AI_MAX_BYTES=400000
```

`AI_PROVIDER=runninghub` 时，服务端会直接调用 RunningHub 的 OpenAI 兼容接口，默认模型为 `bytedance/doubao-seed-evolving`，并自动发送 `x-rh-llm-app-code` 和计费统计请求头。API Key 只放在运行 Next.js 的服务器 `.env.local` 中，不会进入浏览器 bundle、导出表格或安装包。也可以使用 `AI_PROVIDER=compatible` 接入其他 OpenAI 兼容服务。未配置时，“AI 校验”仍提供本地结构规则检查，但不会将表格数据发送到云端。启用云端语义校验前，界面会要求操作者确认本次完整业务字段将发送给模型；服务端只记录处理摘要，不保存原始表格内容。

## 应用内 AI 工作区

左侧“AI 智能助手”下提供“AI 分析中心”“AI 报告”“AI 审计”，右上角“问 AI”可打开全域助手抽屉。它会读取当前月份的合作、项目充值和样品物流数据，生成预算风险、执行进度、物流待办和下一步行动建议；报告会保存在当前浏览器的本地数据中。未配置云端模型时仍可使用本地确定性数据诊断，配置上述统一网关后，分析结果会自动增加云端模型解读。

## 本地 Supabase/PostgreSQL

1. 创建本地 Supabase 或 PostgreSQL 服务。
2. 执行 `supabase/migrations/001_initial.sql`。
3. 在 `.env.local` 填入 `NEXT_PUBLIC_SUPABASE_URL`、`NEXT_PUBLIC_SUPABASE_ANON_KEY`、`SUPABASE_SERVICE_ROLE_KEY`。
4. 钉钉登录成功后，服务端会 upsert `public.users`。

## 物流

默认使用手工物流台账，不自动生成真实轨迹。接入快递鸟时，在 `.env.local` 配置：

```text
SHIPPING_PROVIDER=kdniao
KDNIAO_EBUSINESS_ID=你的快递鸟用户ID
KDNIAO_APP_KEY=你的快递鸟API Key
```

也可以配置 `SHIPPING_PROVIDER=kuaidi100` 使用快递100。应用会通过 `/api/shipping` 服务端接口调用真实物流查询；未配置密钥时自动回退手工模式，不影响本地演示。顺丰、中通等快递可能需要在录入物流时填写手机号或后四位。真实轨迹查询后，签收仍需要人工点击确认。

## Excel 模板

支持 `.xlsx`、`.xls`、`.csv`，推荐列名：`名称`、`账号`、`平台`、`类型`、`城市`、`粉丝数`、`报价元`、`电话`、`标签`。
