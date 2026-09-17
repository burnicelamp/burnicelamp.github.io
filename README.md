# BURNLAMP

[一个私人世界](https://burnlamp.is-my.id/)：序幕 → 声场 → 银幕 → 书页 → 暗房 → 记录。

原生 HTML、CSS、JavaScript，网站无运行依赖、无打包步骤，内容保留在 content/\*.json。

- [Codex 仓库入口](AGENTS.md)：三个设计宗旨、稳定项目事实、默认执行顺序与发布边界。
- [维护工作流](docs/CODEX-WORKFLOW.md)：预检、实现、测试、截图录屏、发布和正式站复验。
- [问题与经验清单](docs/KNOWN-ISSUES.md)：历次实际遇到的 Git、凭据、Windows、浏览器、影视、图书与第三方边界。
- [内容维护指南](CONTENT-GUIDE.md)：照片导入、扩充音乐 / 电影 / 书籍 / 记录、索引生成与发布。
- [设计宗旨](docs/DESIGN-PRINCIPLES.md)：高级、智能、大气三条最高设计约束与决策检查。
- [音乐方案](docs/MUSIC-PROVIDERS.md)：真实播放能力、官方平台降级和待补凭证。
- [素材来源](docs/ASSET-SOURCES.md)：Public Domain 肖像及其他资源边界。
- [验证记录](docs/REGRESSION.md)。
- [第三阶段设计说明](docs/DESIGN-PHASE-3.md)：空间节奏、实际播放能力、可读书页与内容空状态。

开发：`npm install`，`npm run dev`；打开 http://127.0.0.1:8000。只有 Node 而没有 npm 的 Codex 运行时可直接执行 `node tools/serve.mjs`。

开工预检：`npm run preflight`。常规检查：`npm run check`。布局、交互或动效变更：`npm run check:full`。等价的纯 Node 入口是 `node tools/preflight.mjs`、`node tools/check.mjs` 和 `node tools/check.mjs --full`。测试会自动发现项目或 Codex 运行时中的 Playwright、使用仓库内临时目录并默认启动 Edge；正式站复验运行 `node tools/audit-production.cjs`。Sharp / Playwright 仅用于维护和开发，不发送给访客。

发布：GitHub Pages main 根目录。保留 CNAME、.nojekyll、SEO 与 DNS，不需服务器或 API 即可展示已有收藏。不要提交原图、导入清单、密钥、用户 token 或未授权媒体。
