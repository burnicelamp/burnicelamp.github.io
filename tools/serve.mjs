import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { root } from "./lib.mjs";
const mime = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".webp": "image/webp",
  ".avif": "image/avif",
  ".jpg": "image/jpeg",
  ".wav": "audio/wav",
  ".mp3": "audio/mpeg",
};
export function server() {
  return http.createServer((req, res) => {
    let pathname;
    try {
      pathname = decodeURIComponent(
        new URL(req.url, "http://localhost").pathname,
      );
    } catch {
      res.writeHead(400);
      res.end();
      return;
    }
    const file = path.resolve(
      root,
      "." + (pathname === "/" ? "/index.html" : pathname),
    );
    if (!file.startsWith(root + path.sep) || pathname.includes("/.")) {
      res.writeHead(403);
      res.end();
      return;
    }
    fs.readFile(file, (e, b) => {
      res.writeHead(e ? 404 : 200, {
        "Content-Type": mime[path.extname(file)] || "application/octet-stream",
        "Cache-Control": "no-store",
      });
      res.end(e ? "Not found" : b);
    });
  });
}
if (process.argv[1]?.endsWith("serve.mjs")) {
  const args = process.argv.slice(2);
  const option = (name) => {
    const index = args.indexOf(name);
    return index >= 0 ? args[index + 1] : undefined;
  };
  const port = Number(option("--port") || args.find((arg) => /^\d+$/.test(arg))) || 8000;
  const host = option("--host") || "127.0.0.1";
  server().listen(port, host, () => console.log(`Preview: http://${host}:${port}`));
}
