const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");

const root = path.resolve(__dirname, "..");
const videoDir = path.resolve(
  process.env.VIDEO_TEMP || path.join(root, "..", "review-video-temp"),
);
const output = path.resolve(
  process.env.VIDEO_FILE || path.join(root, "..", "burnlamp-interactions.webm"),
);

(async () => {
  const { server } = await import("./serve.mjs");
  const local = server();
  await new Promise((resolve) => local.listen(0, "127.0.0.1", resolve));
  const base = `http://127.0.0.1:${local.address().port}`;
  const browser = await chromium.launch({
    headless: true,
    channel: process.env.BROWSER_CHANNEL || "msedge",
  });
  fs.mkdirSync(videoDir, { recursive: true });
  fs.mkdirSync(path.dirname(output), { recursive: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    recordVideo: { dir: videoDir, size: { width: 1280, height: 720 } },
  });
  const page = await context.newPage();
  const video = page.video();

  try {
    await page.route("https://embed.music.apple.com/**", (route) =>
      route.fulfill({ contentType: "text/html", body: "Preview stub" }),
    );
    await page.goto(`${base}/#cinema-cinema-1`, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(
      () => document.documentElement.dataset.contentReady === "true",
    );
    await page.waitForFunction(() =>
      document.querySelector(".cinema-image.is-current")?.src.includes(
        "rfxryDIv8huejujg4JueDJx8zCz",
      ),
    );
    await page.locator(".cinema-stage").scrollIntoViewIfNeeded();
    await page.waitForTimeout(1500);

    await page.locator("[data-film-next]").click();
    await page.waitForFunction(() =>
      document.querySelector(".cinema-image.is-current")?.src.includes(
        "og2jKploGHYnCz68vV1nRSEE0xV",
      ),
    );
    await page.waitForTimeout(1100);

    await page.locator("[data-cinema-catalog]").click();
    await page.waitForTimeout(700);
    await page.locator("[data-cinema-search]").fill("纸牌屋");
    await page.waitForTimeout(700);
    await page
      .locator(".cinema-catalog-item")
      .filter({ hasText: "纸牌屋" })
      .click();
    await page.waitForFunction(
      () => document.querySelector("[data-film-title]")?.textContent === "纸牌屋",
    );
    await page.locator(".cinema-info").scrollIntoViewIfNeeded();
    await page.waitForTimeout(1400);

    await page.evaluate(() => {
      location.hash = "#reading-book-2";
    });
    await page.waitForFunction(
      () => document.querySelector("[data-book]")?.dataset.contentId === "book-2",
    );
    await page.locator(".reading-book").scrollIntoViewIfNeeded();
    await page.waitForTimeout(1600);

    await page.locator("[data-book-catalog]").click();
    await page.waitForTimeout(700);
    await page.locator("[data-books-search]").fill("白夜");
    await page.waitForTimeout(700);
    await page.locator(".author-works button").filter({ hasText: "白夜" }).click();
    await page.waitForFunction(
      () => document.querySelector("[data-book] h3")?.textContent === "白夜",
    );
    await page.locator(".reading-book").scrollIntoViewIfNeeded();
    await page.waitForTimeout(1800);
  } finally {
    await context.close();
    await browser.close();
    local.close();
  }

  const recorded = await video.path();
  fs.copyFileSync(recorded, output);
  console.log(`Recorded review video to ${output}`);
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
