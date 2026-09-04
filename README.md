# BURNLAMP SIGNAL DESK

Burnlamp 的个人网站。全站以“个人信号台 / Personal Signal Desk”为核心概念，把状态、媒介偏爱、影像、经历与未来计划组织成可切换的频道，而不是通用 Landing Page 分区。

## 本地预览

站点使用语义化 HTML、CSS 与原生 JavaScript，没有构建步骤或外部运行依赖。

```bash
python -m http.server 8000
```

然后访问 `http://localhost:8000`。

## 发布

仓库根目录就是 GitHub Pages 发布产物：

- `main` 分支根目录发布；
- `.nojekyll` 保留静态文件原样；
- `CNAME` 保留 `burnlamp.is-my.id`；
- 不需要重新配置 DNS 或 GitHub Pages。

## 真实内容入口

当前未知的个人内容全部明确标记为“待录入”，没有编造经历或偏好。

- `index.html`：最近状态、照片素材位、队列与联络信息；
- `script.js` 的 `mediaData`：声音、影像、阅读、地点、物件五类媒介内容；
- `script.js` 的 `logEntries`：人生节点与站点记录；
- `assets/og-card.svg`：社交分享封面的可编辑源文件；
- `assets/og-card.png`：平台实际读取的分享图片。

照片加入后，建议在 `.film-frame > i` 内替换为带有 `alt` 的 `<img loading="lazy" decoding="async">`，并同步更新对应按钮的标题和说明。

## 交互与可访问性

- 桌面端使用固定频道轨、可拖拽频道旋钮、媒介切换台、横向底片架与时间游标；
- 移动端重新组织为底部频道 Dock、触控选台、横向滑动底片与纵向控制台；
- 支持键盘焦点、方向键切换、语义化 Tab、原生 Dialog 与 `prefers-reduced-motion`；
- 无自动播放声音、无滚动劫持、无远程字体或前端依赖。
