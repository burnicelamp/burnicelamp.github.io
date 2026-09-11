import { catalog, related } from "../js/catalog.js";
import { readAll, write } from "./lib.mjs";
export function buildSearch(data = readAll()) {
  const entries = catalog(data);
  write("search-index", { version: 1, entries });
  write("relation-index", {
    version: 1,
    entries: Object.fromEntries(
      entries.map((e) => [
        e.key,
        related(entries, data.relations, e.key, {
          limit: data.relations.maxItems || 3,
        }).map((r) => ({ key: r.key, reason: r.reason })),
      ]),
    ),
  });
  return entries.length;
}
if (process.argv[1]?.endsWith("build-search.mjs"))
  console.log(`Generated indexes for ${buildSearch()} published real entries.`);
