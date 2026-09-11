# BURNLAMP 内容指南 · 第三阶段

网站是原生 HTML / CSS / ES Modules，GitHub Pages 从 main 根目录发布。内容始终来自 `content/*.json`，新增内容无需修改 HTML、CSS 或核心组件。先读本文件，再动内容。正式域名 `burnlamp.is-my.id`；保留 CNAME、.nojekyll、canonical、robots.txt、sitemap.xml 与部署来源。

## 给下一次 Codex 对话

1. 拉取最新 main，查看 git status，读本指南及对应 JSON。不要覆盖用户未提交修改。
2. 只整理用户提供的真实信息，不推断人生经历、偏好、评分、阅读状态或精确地理位置。缺失的可选字段留空。保留已有稳定 id。
3. 确认用户有公开发布资源的权利；歌词、封面、电影剧照、音乐分别记录来源。官方外链不等于可以下载后永久托管。
4. 照片用下述导入清单和工具处理。原图、导入清单、私密授权证明放在仓库外，绝不提交原始 EXIF/GPS。只保留用户明确给出的年月、地点等公开文字。
5. 运行验证及索引生成，查看 diff，桌面和手机预览。内容没有增加不代表要制造测试条目；测试夹具只在浏览器路由中存在。
6. 用户本轮授权发布时，`git add` 指定内容、生成索引、资源文件，commit，再普通 `git push origin main`。不要 force push，不要自动改 DNS。确认 Pages 部署的提交就是本次 SHA。

## 文件职责

| 文件                        | 内容                                                       |
| --------------------------- | ---------------------------------------------------------- |
| content/site.json           | 序幕文字、肖像来源、空间名称、页脚                         |
| content/music.json          | tracks、封面、标签与 sources 音源                          |
| content/lyrics.json         | 经授权的文字及可选时间轴                                   |
| content/cinema.json         | 电影及豆瓣 / IMDb 链接                                     |
| content/books.json          | 每本书包含封面跨页与按长度分页的阅读内页；作者书签自动产生 |
| content/darkroom.json       | rolls 胶卷与 items 照片                                    |
| content/notes.json          | 记录                                                       |
| content/relations.json      | 手动关系及是否启用共同标签关系                             |
| content/search-index.json   | **自动生成，禁止手改**                                     |
| content/relation-index.json | **自动生成，禁止手改**                                     |

`published: false` 是草稿；`placeholder: true` 是设计留白。只有 `published !== false && placeholder === false` 的条目进入搜索、随机和关联。每种内容内 id 唯一，格式 `lowercase-kebab-case`。关联引用 `类型:id`，例如 `music:track-1`。已发布链接使用 HTTPS。文本按纯文本渲染。

旧 life.json 中没有真实照片，仅有“肖像”介绍与留白，本阶段按要求删除整个板块及专用逻辑；原内容在 Git 历史可追溯。《近人可读》五首歌的 ID、顺序、Apple 链接和封面来源保留。旧 books.pages 保留在数据文件内供历史参考；当前展示只使用真实条目的 title / author / review / summary。旧占位条目不会显示为实际书目。

## 照片：一句话变成一卷胶片

用户说“这三张是 2026 年 8 月在武汉拍的，第一张作为主图，放进卷 03”时，先找到原始文件和已有卷 03 的稳定 id。创建仓库外的 `import.json`：

```json
{
  "roll": { "id": "roll-03", "title": "卷 03 · 2026 夏天" },
  "coverId": "wuhan-evening-01",
  "photos": [
    {
      "id": "wuhan-evening-01",
      "file": "./IMG_001.jpg",
      "alt": "根据照片实际画面填写描述",
      "date": "2026-08",
      "location": "武汉",
      "caption": "",
      "tags": ["武汉", "夏天"],
      "rights": {
        "kind": "owned",
        "staticPublication": true,
        "attribution": "Burnlamp"
      }
    }
  ]
}
```

其余两张按同样格式追加。`rights` 必须反映事实，布尔值不产生法律上的权利。只在用户提供的是其本人照片或有明确许可时这样填写。地点不用 GPS 自动猜测。

```sh
npm install
node tools/ingest-photo.mjs ../private-import/import.json
node tools/validate-content.mjs
node tools/build-search.mjs
```

导入自动完成：日期 + id 命名、`assets/darkroom/卷id/` 归档、方向矫正、删除所有 EXIF/XMP/IPTC（含 GPS）、不放大的 480/960/1600 宽 WebP 和 AVIF、缩略图、尺寸比例、darkroom 数据、搜索及关联索引。已存在 ID 拒绝覆盖。明确拍摄日期和公开地点只保留在 JSON。工具绝不复制原图进网站，也不自行 commit/push。

图像工具唯一依赖 sharp，仅在维护阶段使用。`SHARP_MODULE` 可指向已安装的 sharp。网站运行不加载 npm。

## 音乐

```json
{
  "id": "song-id",
  "title": "真实歌名",
  "artist": "艺人",
  "album": "专辑",
  "year": 2026,
  "duration": "03:42",
  "published": true,
  "placeholder": false,
  "tags": ["自定义标签"],
  "environment": "indigo",
  "cover": { "src": "assets/music/authorized-cover.webp", "alt": "封面描述" },
  "sources": [
    {
      "provider": "local-authorized",
      "src": "assets/music/authorized-song.mp3",
      "offsetSeconds": 0,
      "rights": {
        "kind": "owned",
        "publicPlayback": true,
        "staticPublication": true,
        "attribution": "创作者及许可说明"
      }
    }
  ]
}
```

音频只允许自有、直接许可或确实公版的**录音**。作品公版不代表某个现代录音公版。可选 `rights.expiresAt` 使用 ISO 日期，到期后拒绝播放。试听片段需要真实 `offsetSeconds`，不可猜测。`environment` 可选 indigo / wine，缺省 indigo。

Apple 官方来源：`{ "provider": "apple", "url": "https://music.apple.com/cn/album/...", "embed": "https://embed.music.apple.com/cn/album/..." }`。网易云、Bilibili 同样提供官方分享 url，可选官方 embed。请在对应平台获得真实分享地址，不凭空构造歌曲 ID。适配器仅允许这些平台官方域名；未验证曲目可嵌入时只放 url。Bilibili 视频仍保留可见视频播放器，不提取音轨。

选择优先级：有效的 local-authorized 优先，否则使用第一个官方来源。只有真实音频时钟才显示播放/暂停、进度、音量、单曲循环及同步歌词；离开声场后显示真实状态的迷你播放器。官方模式只显示官方播放器、平台外链、重新加载及选曲。iframe 的 load 不代表播放成功，也不能据此同步歌词。上一首/下一首可切换官方播放器；官方模式不冒充可控制其播放。Space 不抢占输入框、按钮、链接、歌词和弹层键盘。当前没有凭证的 MusicKit **未激活**，不要把签名私钥放到 Pages。

音源扩展见 `js/providers.js` 的 `registerProvider`、capabilities、dispose 契约。新适配器必须实现能力并补回归，再放开验证器中的 provider 白名单。每个播放器的加载失败要保留可理解的状态和官方入口。

歌词沿用原来的 rights 和 lines 结构；见 [来源边界](docs/LYRICS-SOURCES.md)。人工滚动后永不自行恢复跟随，点击“回到当前句”才恢复。有授权文字但没有真实时钟时是自由阅读，无权限或无歌词时整块歌词区收起。

## 电影 / 书籍 / 记录

```json
{
  "id": "film-id",
  "title": "真实片名",
  "year": 2026,
  "director": "真实导演",
  "note": "我留的一句话",
  "tags": [],
  "rating": null,
  "rewatch": null,
  "image": null,
  "alt": "",
  "published": true,
  "placeholder": false,
  "links": { "douban": "", "imdb": "" }
}
```

影像资源有合法来源时填写 image/alt；没有图片仍可用文字放映页。评分、重看意愿可省略，禁止代填。可选 `media` 存 width、height、variants，以支持 srcset。

```json
{
  "id": "book-id",
  "title": "真实书名",
  "author": "真实作者",
  "publisher": "",
  "year": null,
  "readDate": "",
  "status": "",
  "summary": "自己的简短简介",
  "review": "自己的短评",
  "tags": [],
  "image": null,
  "alt": "",
  "published": true,
  "placeholder": false,
  "links": { "douban": "", "publisher": "", "googleBooks": "" }
}
```

作者字段形成伸出书页的书签；同作者多书停在第一本。桌面为实体跨页，手机默认显示书名、作者和短评。底部“前一本 / 后一本”、方向键切换书目；书内“上一页 / 下一页”和横向手势只翻当前书的内页。长 review / summary 按段落自动分页；快速书目选择和作者书签立即定位，不逐本等待动画。

记录沿用 `{ id, date, dateLabel, title, text, tags, published, placeholder }`。可以再加 location，参与地点搜索。

把上述对象保存为仓库外 JSON，可运行 `node tools/ingest-content.mjs books ../book.json`；同理支持 cinema / music / notes。新增图片先用 `node tools/optimize-images.mjs 原图 输出路径前缀`，只对有公开发布权的原图执行。

## 关联与搜索

```json
{
  "version": 1,
  "automaticTags": true,
  "maxItems": 3,
  "links": [
    {
      "from": "books:book-id",
      "to": "music:track-1",
      "note": "自己写的关联缘由",
      "bidirectional": true
    }
  ]
}
```

明确关系优先，然后按共同标签数量排序，不冒充算法了解用户。只展示有真实关系的少量内容。同一 artist + album 的真实曲目显示为“继续听这张专辑”；跨内容关系仍优先人工关系，其次共同标签，显示关联缘由。

搜索支持全文与 `作者:`、`艺人:`、`导演:`、`地点:`、`年份:`、`标签:`、`类型:`，中英文冒号、英文别名及引号值均支持。多个条件取交集。Ctrl/Cmd+K 打开、方向键选择、Enter 进入、Escape 关闭。搜索、推荐和随机共享内容注册表，草稿和留白均排除。生成索引可供后续集成；当前浏览器用相同纯函数从刚加载的 JSON 建立轻量索引，避免旧索引造成丢内容。

## 验证和发布

```sh
node tools/build-search.mjs
node tools/validate-content.mjs
node tests/content-check.mjs
node tools/serve.mjs 8000
node tests/browser-check.cjs
```

浏览器回归需要开发依赖 Playwright 和 Edge，或设置 BROWSER_CHANNEL。可用 PLAYWRIGHT_MODULE 指向已有安装。检查手机、桌面、键盘、减少动态效果、图片资源、外链、Console。测试中的音频和图片是原创夹具，不是已给本站补充的真实收藏。

提交之前重新确认远端 main 没有新提交。用户授权发布后普通 commit/push，等待 Pages 对应提交部署成功。不得以本地回归替代正式域名验收，也不得把第三方 HTTP 200 当作大陆所有网络完整可播放的证明。

## 第三阶段的展示规则

- 不改既有内容 ID、顺序和 JSON 架构。电影、书、照片、记录只展示真实发布条目；没有真实内容时仅渲染一个空间空状态，不出现虚假计数、空详情或无效导航。添加第一条真实内容后自动切换为完整体验。
- 同类内容顺序沿用 JSON 数组。照片卷的 coverId 先展示，余下仍按 items 顺序；首幅主图、横竖比例与结束帧共同决定接触印样布局。需调整叙事时编辑数组顺序和 coverId，不靠随机排布。
- 电影可选 media.width / media.height；竖版海报完整显示，横版剧照铺入巨幅银幕。短评在详情中为正文，外部资料作为补充。搜索框与快速选择可直接到任一部。
- 记录短于或等于 360 字直接阅读，较长记录显示前段并提供继续阅读。达到 8 条后自动显示年份浏览与关键词检索。
- 内容级链接沿用 #music-id / #cinema-id / #reading-id / #darkroom-id / #notes-id；详情可用 &view=detail。每种内容都有复制链接；照片链接进入放大机。浏览器返回关闭弹层，前进可重新进入照片或详情。
- sessionStorage 只保留当前标签页会话中的选择和最近随机历史，不记录身份、不发送到服务器。序幕按实际访问显示“接着看”。官方播放器不会伪造跨空间播放状态。
- 图片失败显示重载入口；官方播放器保留来源外链和重载入口。照片“查看细节”允许原尺寸滚动查看，关闭仍返回起点。
- 测试夹具留在 tests/，由 Playwright 路由注入内存；绝不写入 content/ 或作为真实截图素材宣传。设置 SCREENSHOT_DIR 可导出夹具截图。

当前真实内容仍为原有五首歌与一条记录。没有新增个人经历、评分、照片或阅读书目。
