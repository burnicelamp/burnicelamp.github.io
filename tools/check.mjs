import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const full = process.argv.includes("--full");
const browserOnly = process.argv.includes("--browser-only");
const contentTasks = [
  "tools/build-search.mjs",
  "tools/validate-content.mjs",
  "tests/content-check.mjs",
];
const browserTasks = [
  "tests/browser-check.cjs",
  "tests/cinema-books-interaction-check.cjs",
  "tests/motion-check.cjs",
];
const tasks = browserOnly
  ? browserTasks
  : full
    ? [...contentTasks, ...browserTasks]
    : contentTasks;

for (const task of tasks) {
  console.log(`\n> ${process.execPath} ${task}`);
  const result = spawnSync(process.execPath, [resolve(root, task)], {
    cwd: root,
    env: process.env,
    stdio: "inherit",
    windowsHide: true,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

console.log(`\nPASS: ${tasks.length} BURNLAMP check(s) completed.`);
