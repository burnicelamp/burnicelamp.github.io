# BURNLAMP

Burnlamp 的个人主页：[burnlamp.is-my.id](https://burnlamp.is-my.id/)。原生 HTML、CSS、JavaScript，无构建或网站运行依赖。

## 预览与维护

在仓库根目录运行 `python -m http.server 8000`，打开 `http://localhost:8000`。内容通过 fetch 读取，请使用 HTTP 服务器。

- [CONTENT-GUIDE.md](CONTENT-GUIDE.md)：只上传图片、追加数据即可维护六类内容。
- content/：音乐、歌词、影像、阅读、记录、人物肖像。
- assets/music/、assets/cinema/、assets/books/、assets/life/：内容素材；官方音乐封面保留现有平台地址。
- index.html：页面语义骨架；styles.css / enhancements.css：原有设计系统及组件扩展。
- js/：数据加载、渲染、肖像、导航、歌词；script.js：原有揭示、唱片微倾、影像滑动和翻书交互。
- [歌词来源调查](docs/LYRICS-SOURCES.md)：授权边界与时钟适配。

运行 `node tests/content-check.mjs` 检查数据。安装开发用 Playwright 后运行 `node tests/browser-check.cjs` 做浏览器回归；可用 PLAYWRIGHT_MODULE 指定已有模块路径，BROWSER_CHANNEL=msedge 使用本机 Edge。测试自行启动并关闭本地服务器，测试资料只在内存中生成。

## 发布

保持 GitHub Pages 从 main 根目录发布。.nojekyll、CNAME、canonical、分享图和站点地图保留现状。不需要修改 DNS，不需要额外后台或打包步骤。

所有视角可通过按钮或键盘操作，移动端支持照片切换与顶部板块导航；运动尊重 prefers-reduced-motion。不自动播放声音、不劫持页面滚动，不将占位内容纳入随机浏览。
