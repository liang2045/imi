# imi达人管理

面向品牌团队的达人资源、合作流程、样品物流、结算与分析工作台。

## 本地运行

```powershell
npm.cmd install
npm.cmd run dev
```

打开 `http://localhost:3000`。未配置钉钉登录时，系统保留浏览器本地演示数据和演示登录。

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
