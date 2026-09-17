const assert = require("node:assert/strict");
const path = require("node:path");
const { launchBrowser } = require("./browser-runtime.cjs");
(async () => {
  const { server } = await import("../tools/serve.mjs");
  const s = server();
  await new Promise((r) => s.listen(0, "127.0.0.1", r));
  const base = "http://127.0.0.1:" + s.address().port;
  const b = await launchBrowser();
  try {
    const p = await b.newPage({ viewport: { width: 1440, height: 1000 } });
    const errors = [];
    p.on("pageerror", (e) => errors.push(e.message));
    await p.route("https://embed.music.apple.com/**", (r) =>
      r.fulfill({ contentType: "text/html", body: "Official embed test stub" }),
    );
    await p.route("https://is1-ssl.mzstatic.com/**", (r) => r.abort());
    await p.goto(base);
    await p.waitForFunction(
      () => document.documentElement.dataset.contentReady,
    );
    await p.locator(".record-art").scrollIntoViewIfNeeded();
    await p.waitForTimeout(700);
    const art = p.locator(".record-art");
    const rect = await art.boundingBox();
    await p.mouse.move(rect.x + rect.width * 0.82, rect.y + rect.height * 0.2);
    await p.waitForTimeout(500);
    assert(await art.evaluate((n) => n.classList.contains("material-active")));
    assert.notEqual(
      await p
        .locator(".album-placeholder")
        .evaluate((n) => getComputedStyle(n).transform),
      "matrix(1, 0, 0, 1, 0, 0)",
    );
    assert.notEqual(
      await art.evaluate((n) => n.style.getPropertyValue("--tilt-y")),
      "",
    );
    if (process.env.SCREENSHOT_DIR)
      await p.screenshot({
        path: path.join(process.env.SCREENSHOT_DIR, "motion-desktop.png"),
      });
    await p.locator("[data-search-open]").click();
    assert.equal(
      await art.evaluate((n) => n.style.getPropertyValue("--tilt-y")),
      "",
    );
    await p.locator("#global-query").fill("寸铁");
    assert.equal(await p.locator("[role=option]").count(), 5);
    await p.locator("[data-search-close]").click();
    await p.waitForTimeout(200);
    await p.emulateMedia({ reducedMotion: "reduce" });
    await art.scrollIntoViewIfNeeded();
    await p.mouse.move(rect.x + rect.width * 0.8, rect.y + rect.height * 0.3);
    assert.equal(
      await art.evaluate((n) => n.style.getPropertyValue("--tilt-y")),
      "",
    );
    assert.equal(
      await p
        .locator(".album-placeholder")
        .evaluate((n) => getComputedStyle(n).transform),
      "none",
    );
    assert.equal(
      await p
        .locator(".sound-layout")
        .evaluate((n) => n.getAnimations().length),
      0,
    );
    await p.emulateMedia({ reducedMotion: "no-preference" });
    await p.locator("#top").scrollIntoViewIfNeeded();
    await art.scrollIntoViewIfNeeded();
    await p.waitForTimeout(100);
    assert.equal(
      await p
        .locator(".sound-layout")
        .evaluate((n) => n.getAnimations().length),
      0,
    );
    await p.route("**/content/books.json", (r) =>
      r.fulfill({
        json: {
          items: [
            {
              id: "test-cover",
              title: "测试书封",
              author: "测试作者",
              review: "只验证书封材质，不是真实收藏。",
              image: "assets/test-cover.svg",
              published: true,
              placeholder: false,
            },
          ],
        },
      }),
    );
    await p.route("**/assets/test-cover.svg", (r) =>
      r.fulfill({
        contentType: "image/svg+xml",
        body: '<svg xmlns="http://www.w3.org/2000/svg" width="300" height="450"><rect width="300" height="450" fill="#576057"/><path d="M40 60H260M40 70H260" stroke="#d8d1bd"/></svg>',
      }),
    );
    await p.goto(base);
    await p.waitForFunction(
      () => document.documentElement.dataset.contentReady,
    );
    await p.locator(".book-cover").scrollIntoViewIfNeeded();
    await p.waitForTimeout(700);
    await p.locator(".book-cover").hover();
    await p.waitForTimeout(650);
    assert.notEqual(
      await p
        .locator(".book-cover")
        .evaluate((n) => getComputedStyle(n).transform),
      "none",
    );
    await p.emulateMedia({ reducedMotion: "reduce" });
    await p.waitForFunction(
      () =>
        getComputedStyle(document.querySelector(".book-cover")).transform ===
        "none",
    );
    const phone = await b.newPage({
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
    });
    await phone.goto(base);
    await phone.waitForFunction(
      () => document.documentElement.dataset.contentReady,
    );
    await phone.locator(".record-art").scrollIntoViewIfNeeded();
    await phone.locator(".record-art").dispatchEvent("pointermove", {
      pointerType: "touch",
      clientX: 60,
      clientY: 180,
    });
    assert.equal(
      await phone
        .locator(".record-art")
        .evaluate((n) => n.style.getPropertyValue("--tilt-y")),
      "",
    );
    assert(
      await phone.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    );
    if (process.env.SCREENSHOT_DIR)
      await phone.screenshot({
        path: path.join(process.env.SCREENSHOT_DIR, "motion-mobile.png"),
      });
    assert.deepEqual(errors, []);
    console.log(
      "PASS: tilt/fallback, modal reset, search, live reduced-motion switch, once-only reveal, touch fallback, mobile overflow and no page errors.",
    );
  } finally {
    await b.close();
    s.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
