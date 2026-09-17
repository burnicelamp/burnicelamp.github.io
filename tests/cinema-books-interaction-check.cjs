const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { launchBrowser } = require("./browser-runtime.cjs");

const root = path.resolve(__dirname, "..");
const cinema = JSON.parse(
  fs.readFileSync(path.join(root, "content", "cinema.json"), "utf8"),
);
const frames = cinema.items.flatMap((item) => item.gallery || []);
assert.equal(frames.length, 12);
assert.equal(new Set(frames.map((frame) => frame.src)).size, 12);
for (const frame of frames) {
  assert(frame.width >= 1600, `${frame.src} is below 1600px`);
  assert(frame.width > frame.height, `${frame.src} is not landscape`);
  assert(frame.alt && frame.source && frame.credit, `${frame.src} lacks provenance`);
}

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const svg = (label, color) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="900"><rect width="1600" height="900" fill="${color}"/><text x="800" y="470" fill="white" font-size="96" text-anchor="middle">${label}</text></svg>`;

(async () => {
  const { server } = await import("../tools/serve.mjs");
  const local = server();
  await new Promise((resolve) => local.listen(0, "127.0.0.1", resolve));
  const base = `http://127.0.0.1:${local.address().port}`;
  const browser = await launchBrowser();
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  let failNextFilm = true;

  try {
    const fixture = {
      intro: "测试放映厅",
      items: [
        {
          id: "film-a",
          title: "影片甲",
          originalTitle: "Film A",
          meta: "2026 · 测试",
          note: "当前画面必须保持可见。",
          published: true,
          placeholder: false,
          gallery: [
            { src: "assets/frame-a1.svg", alt: "甲一", width: 1600, height: 900 },
            { src: "assets/frame-a2.svg", alt: "甲二", width: 1600, height: 900 },
            { src: "assets/frame-a3.svg", alt: "甲三", width: 1600, height: 900 },
          ],
        },
        {
          id: "film-b",
          title: "影片乙",
          originalTitle: "Film B",
          meta: "2025 · 测试",
          note: "失败时不能提前提交资料。",
          published: true,
          placeholder: false,
          gallery: [
            { src: "assets/frame-b1.svg", alt: "乙一", width: 1600, height: 900 },
          ],
        },
      ],
    };
    await page.route("**/content/cinema.json", (route) =>
      route.fulfill({ json: fixture }),
    );
    await page.route("https://embed.music.apple.com/**", (route) =>
      route.fulfill({ contentType: "text/html", body: "Preview stub" }),
    );
    await page.route("**/assets/frame-a1.svg", (route) =>
      route.fulfill({ contentType: "image/svg+xml", body: svg("A1", "#263e46") }),
    );
    await page.route("**/assets/frame-a2.svg", async (route) => {
      await delay(900);
      await route.fulfill({ contentType: "image/svg+xml", body: svg("A2", "#604536") });
    });
    await page.route("**/assets/frame-a3.svg", async (route) => {
      await delay(450);
      await route.fulfill({ contentType: "image/svg+xml", body: svg("A3", "#394b34") });
    });
    await page.route("**/assets/frame-b1.svg", async (route) => {
      await delay(120);
      if (failNextFilm) await route.abort("failed");
      else
        await route.fulfill({
          contentType: "image/svg+xml",
          body: svg("B1", "#55405d"),
        });
    });

    await page.goto(base, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(
      () => document.documentElement.dataset.contentReady === "true",
    );
    await page.waitForFunction(() =>
      document.querySelector(".cinema-image.is-current")?.src.endsWith("frame-a1.svg"),
    );

    assert.equal(await page.locator(".cinema-visual button").count(), 0);
    assert.equal((await page.locator(".cinema-visual").textContent()).trim(), "");
    assert(await page.locator(".cinema-info").evaluate((info, visual) => !visual.contains(info), await page.locator(".cinema-visual").elementHandle()));

    await page.locator("[data-film-next]").click();
    await delay(70);
    await page.locator(".cinema-progress__dot").nth(2).click();
    await delay(180);
    assert(
      (await page.locator(".cinema-image.is-current").getAttribute("src")).endsWith("frame-a1.svg"),
    );
    assert.equal(await page.locator("[data-film-title]").textContent(), "影片甲");
    await page.waitForFunction(() =>
      document.querySelector(".cinema-image.is-current")?.src.endsWith("frame-a3.svg"),
    );
    await delay(700);
    assert(
      (await page.locator(".cinema-image.is-current").getAttribute("src")).endsWith("frame-a3.svg"),
    );
    assert.equal(await page.locator(".cinema-image").count(), 1);

    await page.locator("[data-cinema-next]").click();
    await page.locator("[data-cinema-status] button").waitFor({ state: "visible" });
    assert(
      (await page.locator(".cinema-image.is-current").getAttribute("src")).endsWith("frame-a3.svg"),
    );
    assert.equal(await page.locator("[data-film-title]").textContent(), "影片甲");
    failNextFilm = false;
    await page.locator("[data-cinema-status] button").click();
    await page.waitForFunction(
      () => document.querySelector("[data-film-title]")?.textContent === "影片乙",
    );
    assert(
      (await page.locator(".cinema-image.is-current").getAttribute("src")).endsWith("frame-b1.svg"),
    );
    assert.equal(new URL(page.url()).hash, "#cinema-film-b");

    await page.locator("[data-cinema-prev]").click();
    await page.waitForFunction(
      () => document.querySelector("[data-film-title]")?.textContent === "影片甲",
    );
    const visual = page.locator(".cinema-visual");
    await visual.dispatchEvent("pointerdown", { clientX: 310, clientY: 200 });
    await visual.dispatchEvent("pointerup", { clientX: 220, clientY: 310 });
    await delay(120);
    assert(
      (await page.locator(".cinema-image.is-current").getAttribute("src")).endsWith("frame-a1.svg"),
      "mostly vertical movement must not change frame",
    );
    await visual.dispatchEvent("pointerdown", { clientX: 310, clientY: 200 });
    await visual.dispatchEvent("pointerup", { clientX: 180, clientY: 205 });
    await page.waitForFunction(() =>
      document.querySelector(".cinema-image.is-current")?.src.endsWith("frame-a2.svg"),
    );
    assert.equal(await page.locator("[data-film-title]").textContent(), "影片甲");
    assert.equal(new URL(page.url()).hash, "#cinema-film-a");

    await page.goBack();
    await page.waitForFunction(
      () => document.querySelector("[data-film-title]")?.textContent === "影片乙",
    );
    await page.goForward();
    await page.waitForFunction(
      () => document.querySelector("[data-film-title]")?.textContent === "影片甲",
    );

    for (const width of [320, 390, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      const box = await page.locator(".cinema-visual").boundingBox();
      assert(Math.abs(box.width / box.height - 16 / 9) < 0.02, `${width}px lost 16:9`);
      assert.equal(
        await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),
        false,
      );
    }

    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.locator(".cinema-stage").focus();
    await page.keyboard.press("ArrowRight");
    await page.waitForFunction(() =>
      document.querySelector(".cinema-image.is-current")?.src.endsWith("frame-a2.svg"),
    );
    assert.equal(await page.locator(".cinema-image").count(), 1);

    await page.emulateMedia({ reducedMotion: "no-preference" });
    await page.setViewportSize({ width: 1440, height: 1000 });
    const beforeBook = await page.locator("[data-book]").getAttribute("data-content-id");
    const bookTrigger = page.locator("[data-book-catalog]");
    await bookTrigger.click();
    await page.waitForFunction(
      () => document.activeElement === document.querySelector("[data-books-search]"),
    );
    await page.locator("[data-books-search]").fill("不会存在的作者");
    assert(await page.locator("[data-books-empty]").isVisible());
    assert(await page.locator("[data-book-directory-reset]").isVisible());
    await page.locator("[data-book-directory-reset]").click();
    assert((await page.locator(".author-group").count()) >= 4);
    const secondAuthor = page.locator(".author-group").nth(1);
    await secondAuthor.locator("summary").focus();
    await page.keyboard.press("Enter");
    assert(await secondAuthor.evaluate((node) => node.open));
    assert.equal(
      await page.locator("[data-book]").getAttribute("data-content-id"),
      beforeBook,
      "opening an author must not jump to the first work",
    );
    await secondAuthor.locator(".author-works button").first().focus();
    await page.keyboard.press("Enter");
    await page.locator("#book-catalog").waitFor({ state: "hidden" });
    assert.notEqual(
      await page.locator("[data-book]").getAttribute("data-content-id"),
      beforeBook,
    );
    await bookTrigger.click();
    await page.keyboard.press("Escape");
    await page.locator("#book-catalog").waitFor({ state: "hidden" });
    await delay(250);
    assert(await bookTrigger.evaluate((node) => document.activeElement === node));
    await page.setViewportSize({ width: 390, height: 844 });
    await bookTrigger.click();
    const dialogBox = await page.locator("#book-catalog").boundingBox();
    assert(Math.abs(dialogBox.width - 390) < 1);
    assert(Math.abs(dialogBox.height - 844) < 1);
    await page.keyboard.press("Escape");
    assert.deepEqual(errors, []);
    console.log(
      "PASS: 12 sourced landscape frames; latest action wins; old frame survives delay/failure; retry, swipe, keyboard, history, reduced motion and 16:9 breakpoints; book directory search, author expansion, focus return and mobile drawer.",
    );
  } finally {
    await browser.close();
    local.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
