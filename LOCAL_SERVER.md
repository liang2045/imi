# 本地服务器与钉钉登录部署

## 1. 本地运行方式

开发预览：

```bash
npm run dev
```

局域网生产运行：

```bash
npm run build
npm run start
```

或使用 Docker：

```bash
docker compose -f docker-compose.local.yml up -d --build
```

建议将本机或小主机固定为局域网 IP，例如 `192.168.1.20`，团队访问 `http://192.168.1.20:3000`。

## 2. 钉钉回调入口

钉钉 OAuth 回调需要固定可访问的 HTTPS 地址。可选方案：

- Cloudflare Tunnel
- frp
- ngrok
- 公司已有反向代理/Nginx

示例回调：

```text
https://creator-ops.example.com/api/auth/dingtalk/callback
```

钉钉开放平台后台配置的回调地址必须与 `.env.local` 中的 `DINGTALK_REDIRECT_URI` 完全一致。

## 3. 环境变量

复制 `.env.example` 为 `.env.local`，填写：

```text
DINGTALK_CLIENT_ID=
DINGTALK_CLIENT_SECRET=
DINGTALK_REDIRECT_URI=https://creator-ops.example.com/api/auth/dingtalk/callback
SESSION_SECRET=至少32位随机字符串
LOCAL_APP_ORIGIN=https://creator-ops.example.com
ADMIN_DINGTALK_UNION_IDS=管理员unionId1,管理员unionId2
```

如果不配置钉钉变量，系统会继续显示本地演示登录。

## 4. 本地 Supabase/PostgreSQL

首版仍支持未配置数据库的浏览器本地演示数据。要启用本地 Supabase：

1. 在本机安装 Supabase CLI 或使用已有 Supabase/PostgreSQL 服务。
2. 执行 `supabase/migrations/001_initial.sql`。
3. 在 `.env.local` 填入 `NEXT_PUBLIC_SUPABASE_URL`、`NEXT_PUBLIC_SUPABASE_ANON_KEY`、`SUPABASE_SERVICE_ROLE_KEY`。
4. 钉钉登录成功后，服务端会使用 `SUPABASE_SERVICE_ROLE_KEY` upsert `public.users`。

不要将 `.env.local`、service role key、钉钉 secret 提交到仓库。

## 5. 真实物流查询

推荐使用快递鸟。要启用真实物流查询，在 `.env.local` 增加：

```text
SHIPPING_PROVIDER=kdniao
KDNIAO_EBUSINESS_ID=
KDNIAO_APP_KEY=
```

如果使用快递100，可改为：

```text
SHIPPING_PROVIDER=kuaidi100
KUAIDI100_CUSTOMER=
KUAIDI100_KEY=
```

物流密钥只保存在本地服务器环境变量中，前端页面不会读取或保存。未配置上述变量时，系统保持手工物流台账模式。顺丰、中通等承运商可能需要手机号或后四位用于查询校验；真实轨迹查询后，签收仍需要人工确认。
