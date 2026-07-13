# IMI 达人管理 UI 设计规范

版本：1.0  
适用项目：`liang2045/imi`  
视觉方向：Soft Utility Bento Dashboard

## 1. 设计目标

在不改变达人资源、合作流程、邮寄、结算和分析功能的前提下，将界面统一为高明度、低饱和、克制且便于长时间使用的管理驾驶舱。

核心原则：

- 浅蓝灰页面画布，白色卡片，黑色高对比文字。
- 荧光黄绿色只用于主操作、激活状态、进度和关键提示。
- 信息层级主要依靠字号、字重、边框、间距和卡片尺寸建立。
- 不使用大面积玻璃拟态、彩虹图表、厚重阴影、霓虹发光和复杂装饰。
- 保留原有业务结构和交互，不以视觉改造破坏功能。

## 2. Design Tokens

```css
--bg-canvas: #EEF1F5;
--bg-canvas-warm: #F3F3F1;
--surface: #FFFFFF;
--surface-subtle: #F7F8FA;
--surface-active: #F1F2F0;

--text-primary: #111311;
--text-secondary: #6F747C;
--text-tertiary: #9DA3AC;
--text-inverse: #FFFFFF;

--border-default: #E5E8EC;
--border-strong: #D8DDE3;

--accent: #B8FF3D;
--accent-bright: #DCFF57;
--accent-soft: #EEFFD2;
--accent-dark: #1B2611;

--success: #48C774;
--warning: #F2B84B;
--danger: #EC6A6A;
--info: #5D82D9;
```

字体：

```css
font-family:
  var(--font-geist),
  "PingFang SC",
  "Microsoft YaHei",
  "Noto Sans SC",
  sans-serif;
```

数字必须使用 `tabular-nums`。

## 3. 圆角、阴影与间距

- 输入框、按钮：10px。
- 普通卡片：14px。
- 重点模块、侧栏：18px。
- Badge：999px。
- 页面外边距：24–32px。
- 卡片内边距：20px。
- Grid gap：16px。

普通卡片：

```css
border: 1px solid #E5E8EC;
box-shadow:
  0 1px 2px rgba(17, 24, 39, 0.03),
  0 8px 24px rgba(17, 24, 39, 0.045);
```

悬停只允许上移 1px，不使用明显漂浮动画。

## 4. 应用结构

### 侧栏

- 桌面展开宽度：232px。
- 桌面折叠宽度：80px。
- 白色背景、浅灰边框、轻阴影。
- 激活项使用浅灰底和左侧荧光绿指示，不使用整块绿色。
- Logo 图标块可使用荧光绿。

### 顶栏

- 高度约 72px。
- 白色卡片式顶栏。
- 页面标题 24–28px，字重 650。
- 月份选择器和设置按钮放在右侧。

### 内容区

- 不锁死最大宽度。
- 采用 12 列思路组织 Bento 模块。
- 数据卡、图表和表格保持同一视觉基线。

## 5. 组件规范

### 卡片

- 白色底、1px 边框、轻阴影。
- KPI 卡可使用左侧 3px 荧光绿识别条。
- 不允许每张 KPI 卡使用不同背景色。

### 按钮

- 主按钮：荧光绿底、深色文字。
- 次按钮：白底、浅灰边框。
- 危险操作使用低饱和红色语义，不复用荧光绿。

### 输入框

- 默认浅灰底。
- Hover 变白并提高边框对比。
- Focus 使用荧光绿焦点环。

### Badge

- 默认中性浅灰。
- 关键正向或激活状态使用浅绿色。
- 信息、警告、失败分别使用低饱和蓝、黄、红。

### 表格

- 行高约 48px。
- 表头浅灰底。
- 不使用竖向分割线。
- 数字右对齐并使用等宽数字。
- Hover 只使用极浅背景变化。

## 6. 图表规范

基础色：

```text
主数据：#161816
强调/正向：#B8FF3D
对照/次要：#B8BDC5
信息：#5D82D9
负向：#EC6A6A
网格：#ECEEF1
```

要求：

- 禁止彩虹配色。
- Tooltip 为白底、浅灰边框、轻阴影。
- 默认不显示所有数据点。
- 必须支持图例、Tooltip、Resize 和 aria 描述。
- 饼图用于有限分类；分类过多时优先使用横向条形图。

## 7. 动效与无障碍

- Hover：120–160ms。
- 页面和弹窗：150–220ms。
- 位移不超过 1px。
- 所有可点击元素必须有清晰 Focus Ring。
- `prefers-reduced-motion` 下关闭位移动效。
- 正文与背景需保持可读对比度。

## 8. 代码落点

- 主题覆盖层：`src/app/design-system.css`
- 原始全局样式：`src/app/globals.css`
- 根布局加载：`src/app/layout.tsx`
- 图表主题：`src/components/charts.tsx`

`design-system.css` 必须在 `globals.css` 之后加载，以兼容当前业务组件中的历史颜色类。后续新组件应直接使用本规范的变量，避免继续增加硬编码色值。

## 9. 验收清单

- [ ] 页面背景为浅蓝灰，而不是纯白或渐变光斑。
- [ ] 卡片为纯白，边框和阴影克制。
- [ ] 主按钮和激活状态使用荧光绿，页面没有大面积绿色。
- [ ] 图表没有彩虹色序列。
- [ ] KPI 大数字为黑色高对比。
- [ ] 侧栏和顶栏视觉统一。
- [ ] 表格、表单、弹窗与卡片使用统一圆角。
- [ ] 1024px 与移动端没有明显溢出。
- [ ] 键盘焦点清晰，减少动画设置有效。
