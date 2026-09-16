# BURNLAMP 维护与 Codex 工作流

本文档把多轮网站调整中验证过的做法收敛成一条可重复流程。根目录 `AGENTS.md` 是简短且具有约束力的入口；本文档解释如何快速执行。

## 1. 最短启动方式

在新对话中，用户只需说：

> 请继续维护 BURNLAMP，先读取仓库根目录 `AGENTS.md` 并按其流程执行。本轮任务是：【写需求】。完成本地实现、验证和审阅材料；只有我明确写出“部署／发布”时才更新正式站。

如果本轮就要发布，最后一句改为：

> 本轮授权在全部验证通过后提交并发布到 `main`，随后对正式域名复验。

这比每次复制整套设计、技术和验收要求更稳定，因为实际约束与代码一起版本化。

## 2. 五分钟项目定位

### 运行模式

- `index.html` 是单页空间骨架。
- `js/app.js` 负责启动和空间组装。
- `js/content.js` 处理内容加载、图片与手势等共用能力。
- `js/spaces.js` 承担声场、银幕、书页等主要空间渲染。
- `js/journey.js` 处理稳定链接、弹层和浏览器历史。
- `js/search.js` 和 `js/catalog.js` 处理站内搜索与目录匹配。
- `styles.css` 是全站基础与历史空间样式；`cinema-books.css` 是当前银幕／书页的唯一专项入口；`motion.css` 只放材质与进场动效。
- `content/*.json` 保存正式内容。不要在 HTML 或 CSS 中复制一份内容。

### 主要文档

| 文档 | 用途 |
| --- | --- |
| `docs/DESIGN-PRINCIPLES.md` | 高级、智能、大气三个最高约束 |
| `CONTENT-GUIDE.md` | 内容结构、来源、权利、导入和发布规则 |
| `docs/KNOWN-ISSUES.md` | 实际遇到过的环境、实现和外部服务问题 |
| `docs/REGRESSION.md` | 历次验收结果和尚未覆盖的边界 |
| `docs/MOTION.md` | 动效、触屏和减少动态规则 |
| `docs/*-SOURCES.md` | 媒体和文字来源边界 |

## 3. 每轮工作流

### A. 源码与环境预检

```powershell
npm run preflight
```

如当前运行时有 Node 但 `npm` 没有进入 PATH，直接运行等价入口：

```powershell
node tools/preflight.mjs
```

预检会报告 Node 版本、关键文件、CNAME、是否存在 Git 元数据、本地 HEAD、远端 `main` 和正式站 HTTP 状态。

如果当前目录没有 `.git`：

1. 不要声称已创建分支或提交。
2. 先尝试用系统 Git 正常 clone 到新目录。
3. 如果运行时 Git 存在已知 helper 异常，查看 `docs/KNOWN-ISSUES.md`，不要无限重试。
4. 仅在用户授权发布、已验证 GitHub 身份和 push 权限时，才可用 Git Data API 作为临时降级。

对已有 Git 工作树，必须先检查：

```powershell
git status --short
git branch --show-current
git rev-parse HEAD
git fetch origin main
git rev-parse origin/main
```

保留用户的未提交修改；有重叠时就地调整，不使用 `git reset --hard` 或粗暴覆盖。

### B. 真实站点基线

在改视觉或交互前：

1. 打开 `https://burnlamp.is-my.id/`。
2. 至少检查 1440px 桌面和 390px 触屏视口。
3. 实际执行本次要改的路径，不只看首屏：搜索、切换、目录、详情、复制链接、深链接和前进／后退。
4. 记录资源实际加载、自然尺寸、控制台错误和失败请求。
5. 把“线上现状”与“本地实现”的截图分开命名。

### C. 实现顺序

1. 内容模型、稳定 ID 与导航语义。
2. 桌面／手机的信息架构和比例。
3. 键盘、焦点、触屏、历史状态和失败恢复。
4. 真实内容与极端夹具的布局验证。
5. 材质、阴影、进场和切换动效。
6. 去除重复样式、旧控件和过时文档。

只改颜色、阴影和时长不构成一次完整设计。

### D. 验证层级

#### 静态内容变更

```powershell
npm run check
```

它依次重建索引、验证内容结构，并运行内容回归。

`npm` 不在 PATH 时的等价命令：

```powershell
node tools/build-search.mjs
node tools/validate-content.mjs
node tests/content-check.mjs
```

#### 布局、导航、动效或共用 JavaScript 变更

```powershell
npm run check:full
```

它在内容检查后运行基础浏览器回归、银幕／书页专项交互回归和动效回归。

`npm` 不在 PATH 时，在上述三个内容命令后继续：

```powershell
node tests/browser-check.cjs
node tests/cinema-books-interaction-check.cjs
node tests/motion-check.cjs
```

Playwright 可以通过环境变量使用已有安装：

```powershell
$env:PLAYWRIGHT_MODULE='C:\path\to\node_modules\playwright'
$env:BROWSER_CHANNEL='msedge'
npm run check:full
```

如果 Windows 默认临时目录不可写，先创建工作区内临时目录，再设置：

```powershell
$env:TEMP=(Resolve-Path '.\tmp').Path
$env:TMP=$env:TEMP
```

#### 外部影视图片

```powershell
npm run verify:cinema-media
```

逐条检查 URL、HTTP 状态、浏览器解码、自然宽高和 JSON 声明的一致性。不按文件扩展名推测实际响应格式。

### E. 视觉和录屏验收

```powershell
npm run review:capture
npm run review:record
```

截图至少覆盖：

- 1440px 桌面主状态。
- 390px 手机主状态。
- 目录、详情、空结果或本次新增的复杂层。

录屏要真实展示切换，并专门检查：

- 快速连续点击和反向操作。
- 加载过程中是否白闪／黑闪。
- 图片、文字和计数是否同步。
- 容器高度是否跳动。
- 减少动态时功能是否完整。

## 4. 改动类型与最小充分验证

| 改动 | 必做检查 |
| --- | --- |
| 纯文案，不改结构 | `npm run check`，真实页面阅读 |
| 新增／编辑内容 JSON | 索引重建、schema／来源检查、搜索和深链接 |
| CSS 尺寸／布局 | `npm run check:full`，320/390/768/980/1440 视觉检查 |
| 导航／弹层／历史 | 键盘、Escape、焦点归还、深链接、Back/Forward |
| 影像或音频来源 | 来源与权利记录、真实网络请求、失败降级 |
| 动效 | 录屏、快速打断、触屏、`prefers-reduced-motion` |
| 共用加载／搜索／路由 | 全量 `npm run check:full`，各内容源单独失败 |

## 5. 发布流程

### 首选：正常 Git

1. 确认用户本轮已授权发布。
2. 运行必需验证并检查 diff。
3. 确认远端 `main` 未在工作期间前进。
4. 只暂存本次文件，创建清晰提交，普通 push；不 force push。
5. 确认 GitHub Pages 成功部署该 SHA。
6. 打开正式域名复验，不以 Actions 绿色勾代替站点检查。

### 降级：Git Data API

只在正常 clone/push 被运行时故障阻断时使用：

1. 互动登录 GitHub；不会越过未授权状态。
2. 验证登录账号就是 `burnicelamp`，并确认仓库 `push` 权限。
3. 获取远端当前 `main` SHA 和 tree。
4. 上传本次变更的 blob，基于最新 tree 创建新 tree 和 commit。
5. 以 `force: false` 更新 `refs/heads/main`；基线 SHA 发生变化时停止，不覆盖别人的提交。
6. 验证 Pages 和正式域名，删除临时凭据存储。

旧的 `work/publish-github.ps1` 属于某次任务的临时工具，文件清单和提交信息是硬编码的，不能原样重用。

## 6. 发布后线上验收

线上验收不依赖单一的 `load` 事件。外部 iframe、字体或媒体可能长时间保持加载态。优先等待：

- `document.documentElement.dataset.contentReady === "true"`
- 当前关键图片 `complete` 且 `naturalWidth > 0`
- 目标组件实际存在和可操作
- 本次变更文件含有预期的版本标识或结构

然后实际操作并检查：

- 桌面 1440px 和手机 390px。
- 一次主交互、一次目录／搜索、一个深链接。
- 无关键请求失败和新增控制台错误。
- 当前发布的 CSS／JS／文档已由正式域名返回，不是浏览器旧缓存。

## 7. 高效沟通格式

中间更新只需回答三件事：

1. 正在确认或改什么。
2. 已经得到的可验证结果。
3. 如有阻塞，它是代码问题、环境问题还是需要用户授权的外部操作。

最终交付必须列出：

- 具体改动。
- 实际执行的检查与结果。
- 可点击的本地审阅材料或线上提交／部署链接。
- 仍存在的第三方、实体设备或授权边界。

不用“更高级”“更丝滑”等不可验证的词代替实际结果。
