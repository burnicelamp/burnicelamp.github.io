import { access, mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import { constants } from "node:fs";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
const required = [
  "AGENTS.md",
  "README.md",
  "CONTENT-GUIDE.md",
  "docs/DESIGN-PRINCIPLES.md",
  "docs/CODEX-WORKFLOW.md",
  "docs/KNOWN-ISSUES.md",
  "index.html",
  "CNAME",
  "content/site.json",
  "content/search-index.json",
  "content/relation-index.json",
];

const lines = [];
let failed = false;

function report(label, value, level = "ok") {
  const mark = level === "ok" ? "OK" : level === "warn" ? "WARN" : "FAIL";
  lines.push(`${mark.padEnd(4)} ${label}: ${value}`);
  if (level === "fail") failed = true;
}

function git(...args) {
  const result = spawnSync("git", args, {
    cwd: root,
    encoding: "utf8",
    timeout: 15_000,
    windowsHide: true,
  });
  if (result.error || result.status !== 0) return null;
  return result.stdout.trim();
}

function commandVersion(command, args = ["--version"]) {
  const result = spawnSync(command, args, {
    cwd: root,
    encoding: "utf8",
    timeout: 10_000,
    windowsHide: true,
  });
  if (result.error || result.status !== 0) return null;
  return result.stdout.trim() || result.stderr.trim();
}

async function exists(relativePath) {
  try {
    await access(resolve(root, relativePath), constants.R_OK);
    return true;
  } catch {
    return false;
  }
}

const wait = (ms) => new Promise((resolveWait) => setTimeout(resolveWait, ms));

async function retry(label, action, attempts = 2) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await action();
    } catch (error) {
      lastError = error;
      if (attempt < attempts) await wait(attempt * 600);
    }
  }
  throw new Error(`${label} failed after ${attempts} attempts: ${lastError.message}`);
}

async function getJson(url) {
  return retry("GitHub API", async () => {
    const response = await fetch(url, {
      headers: { Accept: "application/vnd.github+json", "User-Agent": "BURNLAMP-preflight" },
      signal: AbortSignal.timeout(8_000),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json();
  });
}

async function getSite() {
  return retry("production", async () => {
    const response = await fetch(`https://burnlamp.is-my.id/?preflight=${Date.now()}`, {
      cache: "no-store",
      redirect: "follow",
      signal: AbortSignal.timeout(12_000),
    });
    const html = await response.text();
    return {
      status: response.status,
      server: response.headers.get("server") || "unknown",
      hasApp: html.includes("js/app.js"),
    };
  });
}

report("Node", process.version);

const npmVersion = commandVersion("npm");
report(
  "npm",
  npmVersion || "not in PATH; use node tools/check.mjs",
  npmVersion ? "ok" : "warn",
);
const ghVersion = commandVersion("gh");
report("GitHub CLI", ghVersion || "not in PATH; normal Git remains sufficient", ghVersion ? "ok" : "warn");

try {
  const { loadPlaywright } = require("../tests/browser-runtime.cjs");
  report("Playwright", loadPlaywright().modulePath);
} catch (error) {
  report("Playwright", error.message, "warn");
}

try {
  const temp = resolve(root, ".tmp");
  const probe = resolve(temp, ".preflight-write");
  await mkdir(temp, { recursive: true });
  await writeFile(probe, "ok");
  await unlink(probe);
  report("workspace temp", temp);
} catch (error) {
  report("workspace temp", error.message, "fail");
}

const gitVersion = commandVersion("git");
if (gitVersion) {
  report("Git", gitVersion);
  const sslBackend = git("config", "--get", "http.sslBackend") || "default";
  report(
    "Git HTTPS backend",
    sslBackend,
    sslBackend.toLowerCase() === "schannel" ? "warn" : "ok",
  );
} else report("Git", "not in PATH", "warn");

for (const relativePath of required) {
  const present = await exists(relativePath);
  report(`file ${relativePath}`, present ? "present" : "missing", present ? "ok" : "fail");
}

try {
  const cname = (await readFile(resolve(root, "CNAME"), "utf8")).trim();
  report("CNAME", cname, cname === "burnlamp.is-my.id" ? "ok" : "fail");
} catch (error) {
  report("CNAME", error.message, "fail");
}

const gitMetadata = await exists(".git");
let localHead = null;
if (!gitMetadata) {
  report("Git worktree", ".git is absent; this is a source snapshot, not a commit-ready worktree", "warn");
} else {
  localHead = git("rev-parse", "HEAD");
  const branch = git("branch", "--show-current") || "detached";
  const status = git("status", "--short");
  report("Git worktree", `${branch} @ ${localHead || "unknown"}`);
  report("Git status", status ? `${status.split(/\r?\n/).length} changed path(s)` : "clean", status ? "warn" : "ok");
}

try {
  const remote = await getJson("https://api.github.com/repos/burnicelamp/burnicelamp.github.io/commits/main");
  report("GitHub main", remote.sha);
  if (localHead && localHead !== remote.sha)
    report("local/remote", "HEAD differs from GitHub main; sync before publishing", "warn");
  else if (localHead) report("local/remote", "HEAD matches GitHub main");
} catch (error) {
  report("GitHub main", `not verified (${error.message})`, "warn");
}

try {
  const site = await getSite();
  report(
    "production",
    `HTTP ${site.status}; server=${site.server}; app=${site.hasApp ? "found" : "missing"}`,
    site.status === 200 && site.hasApp ? "ok" : "fail",
  );
} catch (error) {
  report("production", `not verified (${error.message})`, "warn");
}

console.log(lines.join("\n"));
if (failed) process.exitCode = 1;
