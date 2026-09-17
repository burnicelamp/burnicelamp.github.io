const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");

function ensureWorkspaceTemp() {
  const target = path.resolve(
    process.env.BURNLAMP_TEMP || path.join(root, ".tmp"),
  );
  fs.mkdirSync(target, { recursive: true });
  process.env.TEMP = target;
  process.env.TMP = target;
  return target;
}

function playwrightCandidates() {
  const runtimeRoot = path.dirname(path.dirname(process.execPath));
  return [
    process.env.PLAYWRIGHT_MODULE,
    path.join(root, "node_modules", "playwright"),
    path.join(runtimeRoot, "node_modules", "playwright"),
    "playwright",
  ].filter(Boolean);
}

function loadPlaywright() {
  const attempted = [];
  for (const candidate of playwrightCandidates()) {
    try {
      const modulePath = require.resolve(candidate);
      return { module: require(modulePath), modulePath };
    } catch (error) {
      if (error.code !== "MODULE_NOT_FOUND") throw error;
      attempted.push(candidate);
    }
  }
  throw new Error(
    [
      "Playwright was not found.",
      `Checked: ${attempted.join(", ")}`,
      "Run npm install, or set PLAYWRIGHT_MODULE to a Playwright package directory.",
    ].join(" "),
  );
}

async function launchBrowser(options = {}) {
  ensureWorkspaceTemp();
  const { module: playwright } = loadPlaywright();
  const executablePath = process.env.BROWSER_EXECUTABLE;
  const launchOptions = { headless: true, ...options };
  if (executablePath) {
    launchOptions.executablePath = executablePath;
    delete launchOptions.channel;
  } else if (!launchOptions.channel) {
    launchOptions.channel = process.env.BROWSER_CHANNEL || "msedge";
  }
  return playwright.chromium.launch(launchOptions);
}

module.exports = {
  ensureWorkspaceTemp,
  launchBrowser,
  loadPlaywright,
  playwrightCandidates,
};
