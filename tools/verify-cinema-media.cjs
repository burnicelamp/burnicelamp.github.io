const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");

const root = path.resolve(__dirname, "..");
const data = JSON.parse(
  fs.readFileSync(path.join(root, "content", "cinema.json"), "utf8"),
);

(async () => {
  const { server } = await import("./serve.mjs");
  const local = server();
  await new Promise((resolve) => local.listen(0, "127.0.0.1", resolve));
  const browser = await chromium.launch({
    headless: true,
    channel: process.env.BROWSER_CHANNEL || "msedge",
  });
  const page = await browser.newPage();
  const results = [];

  try {
    await page.setContent("<!doctype html><title>Cinema media audit</title>");
    for (const item of data.items) {
      for (const [index, frame] of item.gallery.entries()) {
        const responsePromise = page
          .waitForResponse((response) => response.url() === frame.src, {
            timeout: 20000,
          })
          .catch(() => null);
        const imagePromise = page.evaluate(
          (src) =>
            new Promise((resolve) => {
              const image = new Image();
              image.onload = () =>
                resolve({
                  loaded: true,
                  naturalWidth: image.naturalWidth,
                  naturalHeight: image.naturalHeight,
                });
              image.onerror = () => resolve({ loaded: false });
              image.src = src;
            }),
          frame.src,
        );
        const [response, image] = await Promise.all([responsePromise, imagePromise]);
        const result = {
          film: item.title,
          frame: index + 1,
          url: frame.src,
          status: response?.status() || "cache",
          contentType: response?.headers()["content-type"] || "cache",
          ...image,
        };
        assert(image.loaded, `${item.title} frame ${index + 1} did not load`);
        assert.equal(image.naturalWidth, frame.width, `${frame.src} width drifted`);
        assert.equal(image.naturalHeight, frame.height, `${frame.src} height drifted`);
        results.push(result);
      }
    }
  } finally {
    await browser.close();
    local.close();
  }

  const report = {
    checkedAt: new Date().toISOString(),
    uniqueUrls: new Set(results.map((result) => result.url)).size,
    results,
  };
  if (process.env.MEDIA_REPORT)
    fs.writeFileSync(process.env.MEDIA_REPORT, JSON.stringify(report, null, 2));
  console.log(
    `PASS: ${results.length} distinct cinema images loaded at declared dimensions (${Math.min(...results.map((result) => result.naturalWidth))}–${Math.max(...results.map((result) => result.naturalWidth))} px wide).`,
  );
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
