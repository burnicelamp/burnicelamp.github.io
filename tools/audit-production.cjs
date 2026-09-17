const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { launchBrowser } = require("../tests/browser-runtime.cjs");

const root = path.resolve(__dirname, "..");
const site = (process.env.SITE_URL || "https://burnlamp.is-my.id").replace(/\/$/, "");
const output = path.resolve(
  process.env.AUDIT_REPORT || path.join(root, "outputs", "production-audit.json"),
);
const attempts = Math.max(1, Number(process.env.AUDIT_ATTEMPTS || 3));
const fetchTimeout = Math.max(1_000, Number(process.env.AUDIT_FETCH_TIMEOUT_MS || 20_000));
const navigationTimeout = Math.max(
  5_000,
  Number(process.env.AUDIT_NAVIGATION_TIMEOUT_MS || 45_000),
);

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const errorText = (error) =>
  [error.cause?.code, error.message].filter(Boolean).join(": ");

async function retry(label, action, maximumAttempts = attempts) {
  let lastError;
  for (let attempt = 1; attempt <= maximumAttempts; attempt += 1) {
    try {
      return await action(attempt);
    } catch (error) {
      lastError = error;
      if (attempt < maximumAttempts) await wait(attempt * 900);
    }
  }
  throw new Error(
    `${label} failed after ${maximumAttempts} attempts: ${errorText(lastError)}`,
  );
}

async function fetchText(relativePath) {
  return retry(`GET ${relativePath}`, async () => {
    const response = await fetch(`${site}${relativePath}`, {
      cache: "no-store",
      headers: { "User-Agent": "BURNLAMP-production-audit" },
      signal: AbortSignal.timeout(fetchTimeout),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.text();
  });
}

async function auditProfile(browser, profile, stamp) {
  const context = await browser.newContext({
    viewport: { width: profile.width, height: profile.height },
    isMobile: profile.mobile,
    hasTouch: profile.mobile,
    deviceScaleFactor: 1,
    ignoreHTTPSErrors: true,
  });
  const page = await context.newPage();
  const errors = [];
  const firstPartyFailures = [];
  page.on("pageerror", (error) => errors.push(`page: ${error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(`console: ${message.text()}`);
  });
  page.on("requestfailed", (request) => {
    if (new URL(request.url()).hostname === new URL(site).hostname)
      firstPartyFailures.push(
        `${request.resourceType()}: ${request.url()} (${request.failure()?.errorText})`,
      );
  });

  try {
    await retry(`${profile.name} navigation`, () =>
      page.goto(`${site}/?audit=${stamp}#cinema-cinema-1`, {
        waitUntil: "commit",
        timeout: navigationTimeout,
      }),
    );
    await page.waitForFunction(
      () => document.documentElement?.dataset.contentReady === "true",
      null,
      { timeout: 30_000 },
    );
    await page.waitForFunction(
      () => document.querySelector(".cinema-image.is-current")?.naturalWidth >= 1600,
      null,
      { timeout: 30_000 },
    );
    await page.evaluate(() => window.stop());

    assert.equal(await page.locator("#cinema.cinema-room").count(), 1);
    assert.equal(await page.locator("#reading.reading-room").count(), 1);
    assert.equal(await page.locator(".cinema-visual button").count(), 0);
    const frame = await page.locator(".cinema-visual").boundingBox();
    assert(frame && Math.abs(frame.width / frame.height - 16 / 9) < 0.025);

    const firstFilm = await page.locator("[data-film-title]").textContent();
    await page.locator("[data-film-next]").click();
    await page.waitForFunction(
      (oldTitle) => document.querySelector("[data-film-title]")?.textContent !== oldTitle,
      firstFilm,
    );
    const nextFilm = await page.locator("[data-film-title]").textContent();

    await page.locator("[data-cinema-catalog]").click();
    await page.waitForFunction(
      () => document.activeElement === document.querySelector("[data-cinema-search]"),
    );
    await page.keyboard.press("Escape");
    await page.locator("#cinema-catalog").waitFor({ state: "hidden" });

    await page.evaluate(() => {
      location.hash = "#reading-book-2";
    });
    await page.waitForFunction(
      () => document.querySelector("[data-book]")?.dataset.contentId === "book-2",
    );
    await page.locator("[data-book-catalog]").click();
    await page.locator("[data-books-search]").fill("不会存在的作者");
    assert(await page.locator("[data-books-empty]").isVisible());
    await page.keyboard.press("Escape");
    await page.locator("#book-catalog").waitFor({ state: "hidden" });

    assert.equal(
      await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),
      false,
    );
    assert.deepEqual(errors, []);
    assert.deepEqual(firstPartyFailures, []);
    return {
      profile: profile.name,
      viewport: `${profile.width}x${profile.height}`,
      cinemaFrame: { width: frame.width, height: frame.height },
      firstFilm,
      nextFilm,
      book: await page.locator("[data-book] h3").textContent(),
      errors,
      firstPartyFailures,
    };
  } finally {
    await context.close();
  }
}

(async () => {
  const stamp = Date.now().toString();
  const fetched = {};
  fetched.html = await fetchText(`/?audit=${stamp}`);
  fetched.css = await fetchText(`/cinema-books.css?audit=${stamp}`);
  fetched.principles = await fetchText(`/docs/DESIGN-PRINCIPLES.md?audit=${stamp}`);
  assert(fetched.html.includes("js/app.js"));
  assert(fetched.css.includes(".cinema-room") && fetched.css.includes(".reading-room"));
  assert(["高级", "智能", "大气"].every((word) => fetched.principles.includes(word)));

  const browser = await launchBrowser({ args: ["--ignore-certificate-errors"] });
  try {
    const report = {
      site,
      checkedAt: new Date().toISOString(),
      ok: true,
      files: { html: true, cinemaBooksCss: true, designPrinciples: true },
      results: [],
    };
    for (const profile of [
      { name: "desktop", width: 1440, height: 1000, mobile: false },
      { name: "mobile", width: 390, height: 844, mobile: true },
    ])
      report.results.push(await auditProfile(browser, profile, stamp));
    fs.mkdirSync(path.dirname(output), { recursive: true });
    fs.writeFileSync(output, JSON.stringify(report, null, 2));
    console.log(`PASS: production desktop/mobile audit; report: ${output}`);
  } finally {
    await browser.close();
  }
})().catch((error) => {
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(
    output,
    JSON.stringify(
      {
        site,
        checkedAt: new Date().toISOString(),
        ok: false,
        error: errorText(error),
      },
      null,
      2,
    ),
  );
  console.error(error);
  console.error(`Failure report: ${output}`);
  process.exitCode = 1;
});
