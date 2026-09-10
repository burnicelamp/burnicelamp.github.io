# 内容更新指南

网站没有构建步骤。用 HTTP 服务器预览，不要双击 index.html。新增内容只改 JSON 和资源文件，不改页面、组件或 CSS。

| 新增什么 | 上传到 | 修改哪里 |
| --- | --- | --- |
| 生活照片 | assets/life/ | content/life.json 的 photos，或追加 items 条目 |
| 一首歌 | assets/music/（需要本地封面时） | content/music.json 的 tracks |
| 合法歌词 | 无需资源文件 | content/lyrics.json 的 tracks[歌曲id] |
| 电影 / 影像 | assets/cinema/ | content/cinema.json 的 items |
| 一本书 | assets/books/ | content/books.json 的 items |
| 一条记录 | 无需图片 | content/notes.json 的 items |

id 使用唯一、稳定的英文小写字母、数字和短横线。published: false 是草稿，不显示；placeholder: true 是占位，不参加“随便看看”。真实内容设 published: true, placeholder: false。数组顺序就是展示顺序，删除对象即可下架。图片路径相对站点根目录，例如 assets/life/window.webp，填写真实 alt。建议使用压缩后的 WebP/JPEG，不上传隐私位置元数据。标题、导语和说明也在对应 JSON 中。

## 上传 3 张照片 + 增加 1 条数据

上传 window-1.webp、window-2.webp、window-3.webp 后，在 life.json 的 items 末尾追加以下对象并换成真实内容。组件自动生成新视角、照片切换和随机浏览入口：

```json
{
  "id": "my-window",
  "published": true,
  "placeholder": false,
  "label": "窗边",
  "eyebrow": "一个自己的视角",
  "title": "填写真实标题",
  "text": "填写这三张照片与你的关系，建议 40～80 字。",
  "detail": "可选：地点、物件、偏好或一句补充。",
  "photos": [
    { "src": "assets/life/window-1.webp", "alt": "第一张照片的真实描述", "caption": "可选图注" },
    { "src": "assets/life/window-2.webp", "alt": "第二张照片的真实描述" },
    { "src": "assets/life/window-3.webp", "alt": "第三张照片的真实描述" }
  ]
}
```

没有照片时 photos: []，可填写 glyph、visualLabel、visualCaption 使用抽象取景面。可选 link: { "href": "#music", "label": "听听看 ↗" }。目前两个留白视角标成占位，不要把示例当作站主经历。

## 其他内容的最小字段

- 歌曲：复制 music.json 的一个对象，换 id/title/duration/appleUrl/embedSrc。使用 Apple 官方分享链接。同专辑只追加一条，intro 与 album.selection 中的 {count} 自动计算。专辑信息在 album。
- 影像：`{ "id": "film-id", "title": "真实片名", "meta": "年份 · 导演", "note": "自己的短评", "image": "assets/cinema/film.webp", "alt": "海报描述", "published": true, "placeholder": false }`。
- 书：`{ "id": "book-id", "title": "真实书名", "image": "assets/books/book.webp", "alt": "封面描述", "published": true, "placeholder": false, "pages": [{ "label": "正在读", "title": "真实书名", "text": "作者 · 阅读时间或进度", "footer": "自己的简短标注" }, { "label": "页边一笔", "title": "笔记标题", "text": "自己的读后感", "footer": "阅读日期" }] }`。pages 数量不限，每页桌面与手机都可独立翻到，长文可在页内滚动。
- 记录：`{ "id": "note-id", "date": "2026-09-10", "dateLabel": "2026.09.10", "title": "真实标题", "text": "记录正文", "published": true, "placeholder": false }`。

## 歌词：数据与播放时钟是两件事

lyrics.json 用歌曲 id 对应歌词。当前五首歌没有已确认可公开分发的歌词授权，页面保留完整组件、曲目联动与平台入口。不要抓歌词或把 API 密钥放进仓库。[来源调查](docs/LYRICS-SOURCES.md)。

仅在持有全球公开展示及静态分发许可时，将以下对象放进 tracks[歌曲id]。这是字段示例，不是已有歌曲歌词：

```json
{
  "rights": {
    "kind": "owned",
    "publicDisplay": true,
    "staticPublication": true,
    "attribution": "词作者及许可说明",
    "sourceUrl": "https://example.com/permission"
  },
  "lines": [
    { "time": 0, "text": "你的原创第一句" },
    { "time": 8.5, "text": "你的原创第二句" }
  ]
}
```

kind 支持 owned、direct-permission、public-domain，请如实填写；布尔字段不会创造法律上的授权。可选 expiresAt 是 ISO 日期。过期或不完整授权不显示歌词。time 是完整歌曲的秒数，严格递增；无时间轴可省略，自动成为自由阅读。LRC 应先转换为这里的秒数与文本结构，不把来源未知的 LRC 直接搬入。

Apple 官方 iframe 不提供本站可依赖的播放时钟，已有歌词时显示自由阅读。若歌曲有可合法公开播放的自有/直接获准音频，只需在音乐数据中增加 `audio: { "src": "assets/music/song.mp3", "publicPlayback": true, "attribution": "音频授权署名", "offsetSeconds": 0 }`，现有播放器位置会使用原生音频控件，歌词自动绑定 currentTime，支持暂停、跳播、点击歌词定位与手动滚动 5 秒后恢复跟随。试听片段的 offsetSeconds 必须准确，不得猜测。不增加 audio 就保持现有 Apple 播放方式。

## 发布前

运行 `node tests/content-check.mjs` 检查数据、重复 ID、图片路径和歌词授权字段，再本地预览桌面与手机。GitHub Pages 从 main 根目录发布；不要改 CNAME、.nojekyll、DNS 或部署来源。提交并推送数据与图片即可上线。

浏览器回归脚本为 tests/browser-check.cjs，只在开发检查时需要 Playwright 和 Chromium/Edge，网站没有运行依赖。
