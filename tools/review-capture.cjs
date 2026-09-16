const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");

const root = path.resolve(__dirname, "..");
const target = path.resolve(process.env.REVIEW_DIR || path.join(root, "..", "visual-review"));

(async () => {
  const { server } = await import("./serve.mjs");
  const local = server();
  await new Promise((resolve) => local.listen(0, "127.0.0.1", resolve));
  const base = `http://127.0.0.1:${local.address().port}`;
  const browser = await chromium.launch({
    headless: true,
    channel: process.env.BROWSER_CHANNEL || "msedge",
  });
  fs.mkdirSync(target, { recursive: true });
  const report = { base, captures: [], errors: [] };

  try {
    for (const size of [
      { name: "desktop", width: 1440, height: 1000 },
      { name: "mobile", width: 390, height: 844, isMobile: true, hasTouch: true },
    ]) {
      const context = await browser.newContext({
        viewport: { width: size.width, height: size.height },
        isMobile: size.isMobile,
        hasTouch: size.hasTouch,
        deviceScaleFactor: 1,
        recordVideo: undefined,
      });
      const page = await context.newPage();
      page.on("pageerror", (error) => report.errors.push(`${size.name}: ${error.message}`));
      await page.route("https://embed.music.apple.com/**", (route) =>
        route.fulfill({ contentType: "text/html", body: "<p>Preview stub</p>" }),
      );
      await page.goto(`${base}/#cinema-cinema-1`, { waitUntil: "domcontentloaded" });
      await page.waitForFunction(
        () => document.documentElement.dataset.contentReady === "true",
      );
      // Locator screenshots can composite the intentionally off-canvas skip link
      // when a section is taller than the viewport; keep that capture artifact out.
      await page.addStyleTag({ content: ".skip-link{visibility:hidden!important}" });
      await page.locator(".cinema-image.is-current").waitFor({ state: "visible" });
      await page.waitForFunction(
        () => document.querySelector(".cinema-image.is-current")?.naturalWidth >= 1600,
      );
      await page.locator("#cinema").scrollIntoViewIfNeeded();
      await page.waitForTimeout(450);
      await page.locator("#cinema").screenshot({
        path: path.join(target, `${size.name}-cinema.png`),
      });
      report.captures.push({
        name: `${size.name}-cinema`,
        frame: await page.locator(".cinema-visual").boundingBox(),
        image: await page.locator(".cinema-image.is-current").evaluate((image) => ({
          src: image.currentSrc,
          naturalWidth: image.naturalWidth,
          naturalHeight: image.naturalHeight,
          objectFit: getComputedStyle(image).objectFit,
          objectPosition: getComputedStyle(image).objectPosition,
        })),
        section: await page.locator("#cinema").boundingBox(),
      });
      await page.locator("[data-cinema-catalog]").click();
      await page.locator("#cinema-catalog").screenshot({
        path: path.join(target, `${size.name}-cinema-catalog.png`),
      });
      await page.keyboard.press("Escape");
      await page.locator("#cinema-catalog").waitFor({ state: "hidden" });
      await page.waitForTimeout(250);

      await page.goto(`${base}/#reading-book-2`, {
        waitUntil: "domcontentloaded",
      });
      await page.waitForFunction(
        () => document.documentElement.dataset.contentReady === "true",
      );
      await page.addStyleTag({ content: ".skip-link{visibility:hidden!important}" });
      await page.waitForFunction(
        () => document.querySelector("[data-book]")?.dataset.contentId === "book-2",
      );
      await page.locator("#reading").scrollIntoViewIfNeeded();
      await page.waitForTimeout(450);
      await page.locator("#reading").screenshot({
        path: path.join(target, `${size.name}-books.png`),
      });
      report.captures.push({
        name: `${size.name}-books`,
        book: await page.locator(".reading-book").boundingBox(),
        left: await page.locator(".book-title-page").boundingBox(),
        right: await page.locator(".book-reading-page").boundingBox(),
        section: await page.locator("#reading").boundingBox(),
        horizontalOverflow: await page.evaluate(
          () => document.documentElement.scrollWidth - innerWidth,
        ),
      });
      await page.locator("[data-book-catalog]").click();
      await page.locator("#book-catalog").screenshot({
        path: path.join(target, `${size.name}-book-catalog.png`),
      });
      await page.keyboard.press("Escape");
      await page.locator("#book-catalog").waitFor({ state: "hidden" });
      await context.close();
    }
  } finally {
    await browser.close();
    local.close();
  }

  fs.writeFileSync(
    path.join(target, "capture-report.json"),
    JSON.stringify(report, null, 2),
  );
  if (report.errors.length) throw new Error(report.errors.join("\n"));
  console.log(`Captured ${report.captures.length} views in ${target}`);
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
