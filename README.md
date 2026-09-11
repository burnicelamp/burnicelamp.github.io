# BURNLAMP

[一个私人世界](https://burnlamp.is-my.id/)：序幕 → 声场 → 银幕 → 书页 → 暗房 → 记录。

原生 HTML、CSS、JavaScript，网站无运行依赖、无打包步骤，内容保留在 content/\*.json。

- [内容维护指南](CONTENT-GUIDE.md)：照片导入、扩充音乐 / 电影 / 书籍 / 记录、索引生成与发布。
- [音乐方案](docs/MUSIC-PROVIDERS.md)：真实播放能力、官方平台降级和待补凭证。
- [素材来源](docs/ASSET-SOURCES.md)：Public Domain 肖像及其他资源边界。
- [验证记录](docs/REGRESSION.md)。
- [第三阶段设计说明](docs/DESIGN-PHASE-3.md)：空间节奏、实际播放能力、可读书页与内容空状态。

开发：`npm install`，`npm run dev`；打开 http://127.0.0.1:8000。

内容检查：`npm run build:content`、`npm run validate`、`npm test`。浏览器回归：`npm run test:browser`（默认 Edge；可设置 BROWSER_CHANNEL）。sharp / Playwright 仅用于维护和开发，不发送给访客。

发布：GitHub Pages main 根目录。保留 CNAME、.nojekyll、SEO 与 DNS，不需服务器或 API 即可展示已有收藏。不要提交原图、导入清单、密钥、用户 token 或未授权媒体。
