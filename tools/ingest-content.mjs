import fs from "node:fs";
import { readAll, write } from "./lib.mjs";
import { validate } from "./validate-content.mjs";
import { buildSearch } from "./build-search.mjs";
const [kind, file] = process.argv.slice(2);
if (!["music", "cinema", "books", "notes"].includes(kind) || !file)
  throw Error(
    "Usage: node tools/ingest-content.mjs music|cinema|books|notes JSON_FILE",
  );
const data = readAll();
const items = JSON.parse(fs.readFileSync(file, "utf8"));
data[kind][kind === "music" ? "tracks" : "items"].push(
  ...(Array.isArray(items) ? items : [items]),
);
validate(data);
write(kind, data[kind]);
buildSearch(data);
console.log("Imported and validated content. Review before commit/push.");
