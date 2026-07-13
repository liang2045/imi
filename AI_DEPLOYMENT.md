# IMI 达人管理：AI 部署执行文档

版本：1.0  
仓库：`https://github.com/liang2045/imi.git`  
目标分支：`weizhong`  
设计整合分支：`agent/soft-utility-bento-design`

> 本文档供 Codex、Claude Code、Gemini CLI、Cursor Agent 或其他具备终端与 GitHub 权限的 AI 开发代理直接执行。先完成预览部署和验收，再进入生产部署。

---

## 1. 本次改造范围

本分支已在不修改核心业务逻辑的情况下，将项目整合为 Soft Utility Bento Dashboard 视觉系统。

已完成：

- 新增 `src/app/design-system.css`，作为现有样式之后加载的设计系统覆盖层。
- 更新 `src/app/layout.tsx`，加载统一设计系统。
- 更新 `src/components/charts.tsx`，使用黑色、荧光绿、灰色、低饱和蓝红的图表配色，并启用 ECharts aria。
- 新增 `docs/UI_DESIGN_SYSTEM.md`，记录颜色、排版、布局、组件、图表和验收规则。
- 保留达人资源、合作、邮寄、结算、Excel、Supabase、钉钉登录和物流接口逻辑。

设计目标：

- 浅蓝灰画布 `#EEF1F5`。
- 白色模块卡片。
- 黑色高对比文字。
- 荧光黄绿色 `#B8FF3D` 仅用于主操作、激活状态、进度和重点提示。
- 禁止彩虹图表、大面积绿色、玻璃拟态、厚重阴影和夸张动效。

---

## 2. AI 执行原则

1. 不要覆盖或重写现有业务功能。
2. 不要把 `dashboard-app.tsx` 重构成新架构，除非构建错误明确要求。
3. `src/app/design-system.css` 必须在 `globals.css` 后加载。
4. 不要删除本地演示数据回退机制。
5. 不要把密钥、Token、Supabase Service Role Key 或物流密钥提交到 Git。
6. 未通过 `lint`、`test` 和 `build` 时不得进行生产部署。
7. 首次部署必须创建 Preview，验收后再部署 Production。
8. 发现与视觉无关的历史问题时记录到报告，不扩大修改范围。

---

## 3. 环境要求

- Git 2.40+
- Node.js 20 LTS 或更高兼容版本
- npm 10+
- 可访问 GitHub 和 Vercel
- 可选：Supabase CLI
- 可选：Vercel CLI，通过 `npx vercel` 调用即可

项目使用 `package-lock.json`，统一使用 npm，不要改用 pnpm 或 yarn。

---

## 4. 获取代码

### 4.1 直接检查设计分支

```bash
git clone https://github.com/liang2045/imi.git
cd imi
git fetch origin
git checkout agent/soft-utility-bento-design
git status -sb
```

### 4.2 合并到目标分支后部署

如果设计分支已经通过 Pull Request 合并：

```bash
git clone --branch weizhong https://github.com/liang2045/imi.git
cd imi
git pull --ff-only origin weizhong
git status -sb
```

确认工作区没有未提交文件后继续。

---

## 5. 安装与本地校验

```bash
npm ci
npm run lint
npm test
npm run build
```

任何命令失败时：

1. 读取完整错误。
2. 只修复导致失败的最小范围。
3. 重新运行失败命令。
4. 最后再次完整运行：

```bash
npm run lint && npm test && npm run build
```

禁止通过关闭 TypeScript、跳过 ESLint、删除测试或加入宽泛 `any` 来规避错误。

---

## 6. 本地启动与视觉检查

```bash
npm run dev
```

打开：

```text
http://localhost:3000
```

至少检查以下页面或导航状态：

- 达人管理总视图
- 达人管理资源库
- 达人数据库
- 达人档期日历
- 样品邮寄情况
- 全年样品汇总
- 每月达人合作详情
- 达人建联情况分析
- 团队与权限
- 系统设置弹窗

浏览器尺寸：

```text
1440 × 900
1280 × 800
1024 × 768
768 × 1024
390 × 844
```

视觉验收：

- 页面为浅蓝灰背景，没有紫色或青色光斑。
- 卡片为白色、浅边框、轻阴影。
- 主按钮为荧光绿底和深色文字。
- 侧栏激活项为浅灰底加绿色识别，不是整块绿色。
- KPI 数字以黑色为主，不再每张卡使用不同颜色。
- 图表不出现彩虹序列。
- 输入框 Focus Ring 清晰。
- 卡片 Hover 位移不超过 1px。
- 表格、弹窗、看板和表单圆角统一。
- 1024px 和移动端无横向页面溢出。
- `prefers-reduced-motion` 下无位移动画。

---

## 7. 环境变量

复制示例文件：

```bash
cp .env.example .env.local
```

项目变量：

```dotenv
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

DINGTALK_CLIENT_ID=
DINGTALK_CLIENT_SECRET=
DINGTALK_REDIRECT_URI=
SESSION_SECRET=
LOCAL_APP_ORIGIN=http://localhost:3000
ADMIN_DINGTALK_UNION_IDS=

SHIPPING_PROVIDER=manual
KUAIDI100_CUSTOMER=
KUAIDI100_KEY=
KUAIDI100_ENDPOINT=https://poll.kuaidi100.com/poll/query.do
KDNIAO_EBUSINESS_ID=
KDNIAO_APP_KEY=
KDNIAO_ENDPOINT=https://api.kdniao.com/Ebusiness/EbusinessOrderHandle.aspx

NEXT_PUBLIC_APP_TIMEZONE=Asia/Shanghai
```

### 7.1 最小演示部署

不配置 Supabase、钉钉和物流密钥时，应用仍应保留浏览器本地演示数据和演示登录。设置：

```dotenv
LOCAL_APP_ORIGIN=https://你的预览域名
SHIPPING_PROVIDER=manual
NEXT_PUBLIC_APP_TIMEZONE=Asia/Shanghai
```

### 7.2 生产部署

生产环境按需配置：

- Supabase 三个变量。
- 钉钉 OAuth 五个变量。
- 快递鸟或快递100变量。
- 强随机 `SESSION_SECRET`。
- 正确的线上 `LOCAL_APP_ORIGIN`。

`SUPABASE_SERVICE_ROLE_KEY`、`DINGTALK_CLIENT_SECRET`、`SESSION_SECRET`、物流密钥只能配置为服务端环境变量，不得暴露为 `NEXT_PUBLIC_*`。

---

## 8. Supabase 初始化

需要真实数据库时：

1. 创建 Supabase 项目。
2. 打开 SQL Editor。
3. 执行：

```text
supabase/migrations/001_initial.sql
```

4. 将项目 URL、Anon Key 和 Service Role Key 配置到 Vercel。
5. 重新部署 Preview。
6. 验证登录后用户可写入 `public.users`。

不要在未检查迁移文件内容的情况下对已有生产数据库重复执行初始化迁移。

---

## 9. 钉钉 OAuth 配置

Preview 验证阶段可继续使用演示登录。启用真实钉钉登录时：

1. 将 `DINGTALK_REDIRECT_URI` 设置为：

```text
https://你的域名/api/auth/dingtalk/callback
```

2. 将相同地址加入钉钉应用回调白名单。
3. 设置：

```dotenv
LOCAL_APP_ORIGIN=https://你的域名
```

4. 配置管理员 Union ID。
5. 部署后完整验证登录、回调、Cookie 和未启用用户状态。

Preview 域名经常变化，建议正式钉钉回调使用稳定的 Production Domain。

---

## 10. Vercel Preview 部署

优先使用 GitHub Integration，让非生产分支自动生成 Preview。

### 10.1 Vercel Git 集成

1. 在 Vercel 导入 `liang2045/imi`。
2. Framework Preset 选择 Next.js。
3. Root Directory 保持仓库根目录。
4. Install Command：

```text
npm ci
```

5. Build Command：

```text
npm run build
```

6. Output Directory 留空，由 Next.js 自动处理。
7. 添加 Preview 环境变量。
8. 部署 `agent/soft-utility-bento-design` 分支。

### 10.2 Vercel CLI

```bash
npx vercel login
npx vercel link
npx vercel pull --yes --environment=preview
npx vercel build
npx vercel deploy --prebuilt
```

保存 Preview URL，并完成第 6 节全部验收。

如果远程构建和本地构建结果不一致，优先检查：

- Node.js 版本。
- 环境变量作用域。
- 大小写敏感路径。
- 服务端代码是否误用浏览器 API。
- Vercel 构建日志中的首个真实错误。

---

## 11. Production 部署

只有在以下条件全部满足后才允许继续：

- Pull Request 已审查并合并到 `weizhong`。
- `npm run lint` 通过。
- `npm test` 通过。
- `npm run build` 通过。
- Preview 的桌面端和移动端视觉验收通过。
- 演示登录或真实钉钉登录至少有一种可用。
- 生产环境变量已完成检查。

### 11.1 Git 自动生产部署

在 Vercel Project Settings 中将 Production Branch 设为：

```text
weizhong
```

合并后由 Vercel 自动部署。

### 11.2 CLI 生产部署

```bash
npx vercel pull --yes --environment=production
npx vercel build --prod
npx vercel deploy --prebuilt --prod
```

部署完成后检查：

```bash
npx vercel inspect <production-url>
npx vercel logs <production-url>
```

---

## 12. 部署后冒烟测试

必须验证：

1. 首页能够加载，不出现白屏或水合错误。
2. 左侧导航可切换所有模块。
3. 月份筛选可切换。
4. 本地演示数据可加载和保存。
5. 新增达人弹窗可打开、保存、关闭。
6. 系统设置弹窗可使用。
7. 图表正常显示并随容器变化尺寸。
8. Excel 导入导出入口仍可用。
9. 物流未配置时正确回退手工模式。
10. 浏览器控制台无持续错误。
11. 页面没有旧紫色主题残留的大面积模块。
12. 荧光绿只用于关键操作和识别。

---

## 13. 回滚

### Vercel 回滚

```bash
npx vercel rollback
```

或指定部署：

```bash
npx vercel rollback <deployment-url-or-id>
```

### Git 回滚

不要直接删除历史。创建回滚提交或回退合并 PR：

```bash
git checkout weizhong
git pull --ff-only origin weizhong
git revert <merge-commit-sha>
git push origin weizhong
```

---

## 14. 已知实现说明

- 本次设计整合采用兼容覆盖层，而不是重写约 1900 行的业务组件。
- 新组件必须直接使用 `docs/UI_DESIGN_SYSTEM.md` 中的变量，不再增加历史紫色、青色和橙色硬编码。
- 当前移动端继续保留项目原有的紧凑底部导航行为，视觉已统一；若后续改成抽屉导航，应单独立项并进行交互回归。
- 设计样式与功能逻辑分离，出现视觉问题优先检查 `design-system.css` 的级联顺序和选择器，不要先修改业务状态逻辑。

---

## 15. 可直接复制给 AI 的执行提示词

```text
你是一名资深 Next.js、React、TypeScript 和 Vercel 部署工程师。请对 GitHub 仓库 https://github.com/liang2045/imi.git 执行以下任务。

目标：
将 agent/soft-utility-bento-design 分支进行完整校验，创建 Preview 部署，按 AI_DEPLOYMENT.md 和 docs/UI_DESIGN_SYSTEM.md 验收；全部通过后再合并或部署到生产分支 weizhong。

硬性规则：
1. 使用 npm 和 package-lock.json，不改用其他包管理器。
2. 不重写现有业务逻辑，不删除本地演示数据回退。
3. src/app/design-system.css 必须在 globals.css 后加载。
4. 不提交任何密钥或 .env.local。
5. 必须运行 npm ci、npm run lint、npm test、npm run build。
6. 失败时只做最小修复，不通过关闭规则或删除测试绕过。
7. 先 Preview，完成桌面和移动端验收后才能 Production。
8. Production Branch 使用 weizhong。

执行步骤：
- 克隆仓库并切换 agent/soft-utility-bento-design。
- 检查 git diff 和本次设计文件。
- 安装依赖并执行 lint、test、build。
- 启动本地服务检查所有导航、弹窗、图表和表格。
- 使用 Vercel Git Integration 或 npx vercel 创建 Preview。
- 配置必要环境变量，未配置第三方服务时保持演示模式。
- 按 AI_DEPLOYMENT.md 的视觉验收和冒烟测试逐项检查。
- 输出：修改文件、测试结果、Preview URL、环境变量缺口、验收结果和是否可进入生产。
- 只有全部通过时才执行生产部署；否则停止在 Preview 并修复。
```
