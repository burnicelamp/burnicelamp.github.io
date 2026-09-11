const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const root = path.resolve(__dirname, "..");
const read = (n) =>
  JSON.parse(
    fs
      .readFileSync(path.join(root, "content", n + ".json"), "utf8")
      .replace(/^\uFEFF/, ""),
  );
const svg =
  '<svg xmlns="http://www.w3.org/2000/svg" width="900" height="600"><rect width="900" height="600" fill="#696952"/><circle cx="580" cy="200" r="90" fill="#d0c3a2"/><path d="M0 600L270 150L500 600" fill="#343e39"/></svg>';
function wav() {
  const size = 8000 * 2 * 60,
    b = Buffer.alloc(44 + size);
  b.write("RIFF");
  b.writeUInt32LE(36 + size, 4);
  b.write("WAVEfmt ", 8);
  b.writeUInt32LE(16, 16);
  b.writeUInt16LE(1, 20);
  b.writeUInt16LE(1, 22);
  b.writeUInt32LE(8000, 24);
  b.writeUInt32LE(16000, 28);
  b.writeUInt16LE(2, 32);
  b.writeUInt16LE(16, 34);
  b.write("data", 36);
  b.writeUInt32LE(size, 40);
  return b;
}
(async () => {
  const { server } = await import("../tools/serve.mjs");
  const s = server();
  await new Promise((r) => s.listen(0, "127.0.0.1", r));
  const base = "http://127.0.0.1:" + s.address().port;
  const browser = await chromium.launch({
    headless: true,
    channel: process.env.BROWSER_CHANNEL || "msedge",
  });
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
  });
  const errors = [],
    missing = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("response", (r) => {
    if (r.url().startsWith(base) && r.status() === 404) missing.push(r.url());
  });
  await page.route("https://embed.music.apple.com/**", (r) =>
    r.fulfill({
      contentType: "text/html",
      body: "<p>Official embed — test stub</p>",
    }),
  );
  await page.route("https://is1-ssl.mzstatic.com/**", (r) =>
    r.fulfill({ contentType: "image/svg+xml", body: svg }),
  );
  let visit = 0;
  const go = async (hash = "") => {
    await page.goto(base + "/?visit=" + ++visit + hash, {
      waitUntil: "domcontentloaded",
    });
    await page.waitForFunction(
      () => document.documentElement.dataset.contentReady === "true",
    );
  };
  try {
    await go();
    assert.deepEqual(
      await page
        .locator("main>section")
        .evaluateAll((ns) => ns.map((n) => n.id)),
      ["top", "music", "cinema", "reading", "darkroom", "notes"],
    );
    assert.equal(await page.locator(".track-row").count(), 5);
    assert(await page.locator("[data-play]").isDisabled());
    assert(await page.locator("[data-progress]").isDisabled());
    assert(await page.locator("[data-volume]").isDisabled());
    assert(await page.locator("[data-repeat]").isDisabled());
    for (const [i, t] of read("music").tracks.entries()) {
      await page.locator(".track-row").nth(i).click();
      assert.equal(
        await page.locator("[data-current-track]").textContent(),
        t.title,
      );
      assert.equal(
        await page.locator("[data-lyrics-title]").textContent(),
        t.title,
      );
      assert.equal(
        await page.locator("[data-provider-host] iframe").getAttribute("src"),
        t.embedSrc,
      );
    }
    await page.locator("[data-music-search]").fill("我讲");
    assert.equal(await page.locator(".track-row").count(), 1);
    await page.locator("[data-music-search]").fill("");
    await page.keyboard.press("Control+k");
    await page.locator("#global-query").fill("寸铁");
    assert.equal(await page.locator("[role=option]").count(), 5);
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("Enter");
    await page.waitForFunction(
      (title) =>
        document.querySelector("[data-current-track]").textContent === title,
      read("music").tracks[1].title,
    );
    assert.equal(await page.locator(".film-copy").count(), 0);
    assert(await page.locator("#cinema .space-toolbar").isHidden());
    assert(await page.locator("#reading .book-controls").isHidden());
    assert.equal(await page.locator(".notes-list article").count(), 1);
    assert.equal(
      await page
        .locator(".notes-list button")
        .filter({ hasText: "展开" })
        .count(),
      0,
    );
    assert(await page.locator("[data-play]").isHidden());
    assert(await page.locator(".lyrics-card").isHidden());
    for (const width of [320, 390, 768, 980, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      for (const id of [
        "top",
        "music",
        "cinema",
        "reading",
        "darkroom",
        "notes",
      ]) {
        await page.locator("#" + id).scrollIntoViewIfNeeded();
        assert(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
          `Overflow ${width} ${id}`,
        );
      }
      if (width <= 900) {
        await page.locator(".nav-toggle").click();
        assert(await page.locator("#mobile-nav").isVisible());
        await page.keyboard.press("Escape");
        await page.waitForTimeout(150);
        assert(await page.locator("#mobile-nav").isHidden());
      }
    }
    await page.emulateMedia({ reducedMotion: "reduce" });
    let previous = "";
    for (let i = 0; i < 12; i++) {
      await page.locator("[data-wander]").click();
      const hash = new URL(page.url()).hash;
      assert.notEqual(hash, previous);
      previous = hash;
      assert(/^#(music-track-[1-5]|notes-note-1)$/.test(hash));
    }
    assert.equal(
      await page.evaluate(
        () => getComputedStyle(document.documentElement).scrollBehavior,
      ),
      "auto",
    );
    assert.equal(
      await page
        .locator(".cursor")
        .evaluate((n) => getComputedStyle(n).display),
      "none",
    );
    console.log(
      "PASS: migrated content, official fallback, local/global search, modal keyboard, honest empty rooms, five viewport sizes, real-only random and reduced motion.",
    );
    const books = read("books");
    books.items.push(
      ...["first", "second", "third"].map((id, i) => ({
        id: "test-" + id,
        title: "测试书 " + id,
        author: i === 2 ? "陀思妥耶夫斯基" : "测试作者",
        tags: ["武汉"],
        summary: "原创测试简介",
        review: "原创短评",
        published: true,
        placeholder: false,
        status: "测试阅读",
        links: { douban: "https://book.douban.com/" },
      })),
    );
    const cinema = read("cinema");
    cinema.items.push({
      id: "test-film",
      title: "测试电影",
      year: 2026,
      director: "测试导演",
      tags: ["武汉"],
      image: "assets/test.svg",
      alt: "测试画面",
      note: "原创测试短评",
      published: true,
      placeholder: false,
      links: {
        douban: "https://movie.douban.com/",
        imdb: "https://www.imdb.com/",
      },
    });
    const darkroom = read("darkroom");
    darkroom.rolls.push({
      id: "test-roll",
      title: "测试胶卷",
      published: true,
    });
    darkroom.items.push(
      ...[1, 2, 3].map((i) => ({
        id: "photo-" + i,
        rollId: "test-roll",
        title: "测试照片 " + i,
        src: "assets/test.svg",
        alt: "原创测试图 " + i,
        width: 900,
        height: 600,
        date: "2026-08",
        location: "武汉",
        tags: ["武汉"],
        published: true,
        placeholder: false,
      })),
    );
    const notes = read("notes");
    notes.items.push({
      id: "test-note",
      title: "测试记录",
      text: "<img src=x onerror=alert(1)>",
      dateLabel: "测试",
      published: true,
      placeholder: false,
      tags: ["武汉"],
    });
    for (const [n, d] of Object.entries({ books, cinema, darkroom, notes }))
      await page.route("**/content/" + n + ".json", (r) =>
        r.fulfill({ json: d }),
      );
    await page.route("**/assets/test.svg", (r) =>
      r.fulfill({ contentType: "image/svg+xml", body: svg }),
    );
    await go("#reading-test-third");
    await page.waitForFunction(
      () =>
        document.querySelector("[data-book]").dataset.contentId ===
        "test-third",
    );
    await page.keyboard.press("Control+k");
    await page.locator("#global-query").fill("作者:陀思妥耶夫斯基");
    assert.equal(await page.locator("[role=option]").count(), 1);
    await page.keyboard.press("Enter");
    assert.equal(
      await page.locator("[data-book]").getAttribute("data-content-id"),
      "test-third",
    );
    await page
      .locator("[data-authors] button")
      .filter({ hasText: "测试作者" })
      .click();
    await page.waitForFunction(
      () =>
        document.querySelector("[data-book]").dataset.contentId ===
        "test-first",
    );
    await page.keyboard.press("Control+k");
    await page.locator("#global-query").fill("地点:武汉 年份:2026");
    assert.equal(await page.locator("[role=option]").count(), 3);
    await page.keyboard.press("Enter");
    await page.locator(".enlarger").waitFor({ state: "visible" });
    assert.equal(
      await page.locator("[data-enlarger-image] img").getAttribute("alt"),
      "原创测试图 1",
    );
    await page.locator("[data-photo-next]").click();
    assert.equal(
      await page.locator("[data-enlarger-image] img").getAttribute("alt"),
      "原创测试图 2",
    );
    await page.keyboard.press("Escape");
    await page.waitForTimeout(150);
    assert(await page.locator(".enlarger").isHidden());
    await go("#cinema-test-film");
    await page.locator(".film-copy button").first().click();
    assert.equal(await page.locator(".detail-links a").count(), 2);
    assert(
      (
        await page.locator(".detail-dialog .connections").textContent()
      ).includes("同一页世界里"),
    );
    await page.keyboard.press("Escape");
    await page.waitForTimeout(150);
    await go("#notes-test-note");
    assert.equal(await page.locator("#notes-test-note img").count(), 0);
    console.log(
      "PASS: data-only film/book/photo additions, author and location filters, deep links, enlarger controls, relations, escaping.",
    );
    // Verify the two real animation paths, not only reduced-motion state changes.
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
    await page.waitForFunction(
      () =>
        getComputedStyle(document.querySelector(".hero-copy")).opacity === "1",
    );
    for (const fallback of [false, true]) {
      await go();
      if (fallback)
        await page.evaluate(() => {
          document.startViewTransition = undefined;
        });
      await page.locator('[data-photo-id="photo-1"]').click();
      await page.waitForTimeout(850);
      assert(await page.locator(".enlarger").isVisible());
      await page.keyboard.press("Escape");
      await page.waitForTimeout(150);
      await page.waitForTimeout(850);
      assert(await page.locator(".enlarger").isHidden());
      assert.equal(await page.locator(".photo-flight").count(), 0);
    }
    await page
      .locator("[data-authors] button")
      .filter({ hasText: "陀思妥耶夫斯基" })
      .click();
    await page.waitForFunction(
      () =>
        document.querySelector("[data-book]").dataset.contentId ===
        "test-third",
    );
    await page.waitForFunction(
      () => document.querySelectorAll(".page-turn").length === 0,
    );
    await page.emulateMedia({ reducedMotion: "reduce" });
    console.log(
      "PASS: returning to prologue restores text; native and fallback photo transitions clean up; animated author jump completes.",
    );
    const music = read("music");
    music.tracks[0].sources.unshift({
      provider: "local-authorized",
      src: "assets/test.wav",
      offsetSeconds: 2,
      rights: {
        kind: "owned",
        publicPlayback: true,
        staticPublication: true,
        attribution: "Original test silence",
      },
    });
    const lyrics = {
      tracks: {
        "track-1": {
          rights: {
            kind: "owned",
            publicDisplay: true,
            staticPublication: true,
            attribution: "Original test text",
          },
          lines: Array.from({ length: 25 }, (_, i) => ({
            time: i * 2,
            text: "原创回归测试行 " + i,
          })),
        },
      },
    };
    await page.route("**/content/music.json", (r) =>
      r.fulfill({ json: music }),
    );
    await page.route("**/content/lyrics.json", (r) =>
      r.fulfill({ json: lyrics }),
    );
    await page.route("**/assets/test.wav", (r) => {
      const b = wav(),
        range = /bytes=(\d+)-(\d*)/.exec(r.request().headers().range || "");
      const start = range ? Number(range[1]) : 0,
        end = range?.[2] ? Number(range[2]) : b.length - 1;
      return r.fulfill({
        status: range ? 206 : 200,
        contentType: "audio/wav",
        headers: {
          "Accept-Ranges": "bytes",
          ...(range
            ? { "Content-Range": `bytes ${start}-${end}/${b.length}` }
            : {}),
        },
        body: b.subarray(start, end + 1),
      });
    });
    await page.setViewportSize({ width: 390, height: 844 });
    await go();
    await page.locator(".track-row").first().click();
    await page.waitForFunction(
      () => document.querySelector("audio")?.currentTime > 0.1,
    );
    await page.locator("[data-play]").click();
    assert(await page.locator("audio").evaluate((n) => n.paused));
    await page.locator("audio").evaluate((n) => (n.currentTime = 10));
    await page.waitForFunction(
      () =>
        document.querySelector(".lyric-line.is-current")?.dataset.line === "6",
    );
    await page
      .locator("[data-lyrics-viewport]")
      .dispatchEvent("wheel", { deltaY: 100 });
    assert(await page.locator("[data-lyrics-resume]").isVisible());
    await page.waitForTimeout(5200);
    assert(await page.locator("[data-lyrics-resume]").isVisible());
    await page.locator("[data-lyrics-resume]").click();
    assert(await page.locator("[data-lyrics-resume]").isHidden());
    await page.locator("[data-volume]").fill("0.2");
    assert.equal(await page.locator("audio").evaluate((n) => n.volume), 0.2);
    await page.locator("[data-repeat]").click();
    assert(await page.locator("audio").evaluate((n) => n.loop));
    await page.locator("body").click({ position: { x: 4, y: 400 } });
    await page.keyboard.press("Space");
    await page.waitForFunction(() => !document.querySelector("audio").paused);
    await page.keyboard.press("Space");
    assert(await page.locator("audio").evaluate((n) => n.paused));
    await page.locator(".track-row").nth(1).click();
    assert.equal(await page.locator("audio").count(), 0);
    assert.equal(await page.locator(".lyric-line").count(), 0);
    assert(await page.locator("[data-play]").isDisabled());
    console.log(
      "PASS: real audio playback/pause, excerpt clock, persistent manual lyrics, resume, volume, loop, Space, provider disposal and disabled fallback controls.",
    );

    // Third-phase fixtures are intercepted in memory and never written to content/.
    books.items = Array.from({ length: 80 }, (_, i) => ({
      id: "stress-book-" + i,
      title:
        i === 79
          ? "很长的书名：关于时间、记忆与那些值得反复阅读的句子"
          : "测试书目 " + i,
      author: "作者 " + i,
      summary: "简介。".repeat(25),
      review:
        i === 79
          ? "自己的阅读感受，逐页安静读下去。".repeat(120)
          : "一段真实字段格式的测试短评。",
      published: true,
      placeholder: false,
      tags: [],
      links: {},
    }));
    cinema.items = Array.from({ length: 6 }, (_, i) => ({
      id: "stress-film-" + i,
      title: "测试放映画面 " + i,
      note: "这是一条用于验证构图和阅读层级的测试短评。",
      image: "assets/test.svg",
      alt: "原创几何测试画面",
      year: 2026,
      director: "测试导演",
      published: true,
      placeholder: false,
    }));
    darkroom.items = Array.from({ length: 7 }, (_, i) => ({
      id: "stress-photo-" + i,
      rollId: "test-roll",
      src: "assets/test.svg",
      alt: "横竖比例测试 " + i,
      width: i % 2 ? 600 : 900,
      height: i % 2 ? 900 : 600,
      published: true,
      placeholder: false,
    }));
    notes.items = Array.from({ length: 18 }, (_, i) => ({
      id: "stress-note-" + i,
      title: "测试记录 " + i,
      text: i === 0 ? "用于验证长记录的正文。".repeat(90) : "短记录直接阅读。",
      date: i % 2 ? "2025-08" : "2026-09",
      dateLabel: i % 2 ? "2025.08" : "2026.09",
      placeholder: false,
      published: true,
    }));
    await page.setViewportSize({ width: 1440, height: 1000 });
    await go("#reading-stress-book-79");
    await page.waitForFunction(
      () =>
        document.querySelector("[data-book]").dataset.contentId ===
        "stress-book-79",
    );
    assert.equal(
      await page.locator('[aria-label="快速定位书籍"] option').count(),
      80,
    );
    const oldText = await page.locator(".paper-right .review").textContent();
    await page.locator(".paper-pagination button").last().click();
    assert(
      (await page.locator(".paper-pagination").textContent()).includes("2 /"),
    );
    assert.equal(
      await page.locator("[data-book]").getAttribute("data-content-id"),
      "stress-book-79",
    );
    await page.locator('[aria-label="快速定位书籍"]').selectOption("0");
    assert.equal(
      await page.locator("[data-book]").getAttribute("data-content-id"),
      "stress-book-0",
    );
    assert((await page.locator(".paper-pagination").count()) === 0);
    await page.locator('[aria-label="快速定位书籍"]').selectOption("79");
    const out = process.env.SCREENSHOT_DIR;
    if (out) {
      fs.mkdirSync(out, { recursive: true });
      await page.screenshot({
        path: path.join(out, "fixture-book-desktop.png"),
      });
    }
    await page.setViewportSize({ width: 390, height: 844 });
    await page.locator("#reading").scrollIntoViewIfNeeded();
    assert(await page.locator(".paper-right").isVisible());
    assert(
      (await page.locator(".paper-right").textContent()).includes("作者 79"),
    );
    assert(await page.locator(".paper-right .review").isVisible());
    if (out)
      await page.screenshot({
        path: path.join(out, "fixture-book-mobile.png"),
      });
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.locator("#darkroom").scrollIntoViewIfNeeded();
    if (out)
      await page.screenshot({
        path: path.join(out, "fixture-darkroom-desktop.png"),
      });
    await page
      .locator('[data-photo-id="stress-photo-0"]')
      .scrollIntoViewIfNeeded();
    const beforePhoto = await page.evaluate(() => scrollY);
    await page.locator('[data-photo-id="stress-photo-0"]').click();
    await page.locator(".enlarger").waitFor({ state: "visible" });
    await page.goBack();
    await page.waitForTimeout(250);
    assert(await page.locator(".enlarger").isHidden());
    assert(Math.abs((await page.evaluate(() => scrollY)) - beforePhoto) < 80);
    await page.goForward();
    await page.locator(".enlarger").waitFor({ state: "visible" });
    await page.locator("[data-photo-tools] button").last().click();
    assert((await page.locator(".enlarger-image.zoomed").count()) === 1);
    await page.keyboard.press("Escape");
    await page.waitForTimeout(250);
    await page.locator('[aria-label="按年份浏览记录"]').selectOption("2025");
    assert.equal(await page.locator(".notes-list article:visible").count(), 9);
    await page.locator('[aria-label="搜索记录"]').fill("不存在");
    assert.equal(await page.locator(".notes-list article:visible").count(), 0);
    await page.keyboard.press("Control+k");
    await page.locator("#global-query").fill("不可能找到的词");
    await page.getByRole("button", { name: "清除条件，看看全部" }).click();
    assert((await page.locator("[role=option]").count()) > 0);
    await page.keyboard.press("Escape");
    await page.waitForTimeout(250);
    await page.route("**/assets/test.svg", (r) => r.abort());
    await go("#cinema-stress-film-0");
    await page.locator(".image-retry").first().waitFor({ state: "visible" });
    assert(await page.locator(".image-retry").first().isVisible());
    console.log(
      "PASS: 80-book direct jumps, bounded inner pages, mobile title/author/review, photo Back/Forward and zoom, year filters, search recovery and image retry.",
    );

    await page.route("**/content/cinema.json", (r) =>
      r.fulfill({ status: 500, body: "Unavailable" }),
    );
    await go();
    assert((await page.locator("#cinema").textContent()).includes("重新载入"));
    assert.equal(await page.locator(".track-row").count(), 5);
    assert.deepEqual(errors, []);
    assert.deepEqual(missing, []);
    console.log(
      "PASS: isolated content failure, no uncaught browser exceptions, no local 404. External embeds/images are stubs, not an assertion of third-party playback.",
    );
  } finally {
    await browser.close();
    s.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
