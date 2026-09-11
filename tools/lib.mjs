import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
export const root = path.resolve(
  fileURLToPath(new URL("../", import.meta.url)),
);
export const read = (name) =>
  JSON.parse(
    fs
      .readFileSync(path.join(root, "content", name + ".json"), "utf8")
      .replace(/^\uFEFF/, ""),
  );
export const names = [
  "site",
  "music",
  "lyrics",
  "cinema",
  "books",
  "darkroom",
  "notes",
  "relations",
];
export const readAll = () => Object.fromEntries(names.map((n) => [n, read(n)]));
export function write(name, data) {
  fs.writeFileSync(
    path.join(root, "content", name + ".json"),
    JSON.stringify(data, null, 2) + "\n",
  );
}
export const validId = (id) =>
  typeof id === "string" && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id);
export function assetPath(src) {
  if (typeof src !== "string" || !src.startsWith("assets/"))
    throw Error("Expected assets/ path: " + src);
  const p = path.resolve(root, src);
  if (!p.startsWith(path.join(root, "assets") + path.sep))
    throw Error("Unsafe asset path: " + src);
  return p;
}
