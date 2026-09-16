import { access, readFile } from "node:fs/promises";
import { constants } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
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
    windowsHide: true,
  });
  if (result.error || result.status !== 0) return null;
  return result.stdout.trim();
}

async function exists(relativePath) {
  try {
    await access(resolve(root, relativePath), constants.R_OK);
    return true;
  } catch {
    return false;
  }
}

async function getJson(url) {
  const response = await fetch(url, {
    headers: { Accept: "application/vnd.github+json", "User-Agent": "BURNLAMP-preflight" },
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

async function getSite() {
  const response = await fetch(`https://burnlamp.is-my.id/?preflight=${Date.now()}`, {
    cache: "no-store",
    redirect: "follow",
    signal: AbortSignal.timeout(15_000),
  });
  const html = await response.text();
  return {
    status: response.status,
    server: response.headers.get("server") || "unknown",
    hasApp: html.includes("js/app.js"),
  };
}

report("Node", process.version);

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
