import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { validate } from "../tools/validate-content.mjs";
import { readAll, root } from "../tools/lib.mjs";
import { catalog, search, related } from "../js/catalog.js";
import { currentLine, permittedLyrics } from "../js/lyrics.js";
import { authorized } from "../js/providers.js";
const data = readAll();
assert.equal(validate(data), catalog(data).length);
const entries = catalog(data);
assert.equal(
  search(entries, "寸铁").length,
  entries.filter((e) => e.text.includes("寸铁")).length,
);
assert.equal(
  search(entries, "年份:2020 寸铁").length,
  entries.filter((e) => e.year === "2020" && e.text.includes("寸铁")).length,
);
assert.equal(
  search(entries, "年份:2026").length,
  entries.filter((e) => e.year === "2026").length,
);
assert.equal(
  search(entries, "类型:书页").length,
  entries.filter((e) => e.kind === "books").length,
);
assert.equal(search(entries, "不存在").length, 0);
const fixtures = [
  {
    key: "books:a",
    kind: "books",
    title: "测试书",
    text: "测试书 陀思妥耶夫斯基",
    author: "陀思妥耶夫斯基",
    tags: ["武汉"],
  },
  {
    key: "darkroom:b",
    kind: "darkroom",
    title: "武汉",
    text: "武汉 2026",
    location: "武汉",
    year: "2026",
    tags: ["武汉"],
  },
  { key: "music:c", kind: "music", title: "声音", text: "声音", tags: [] },
];
assert.equal(search(fixtures, "作者:陀思妥耶夫斯基")[0].key, "books:a");
assert.equal(search(fixtures, "地点：武汉 年份:2026")[0].key, "darkroom:b");
assert.equal(search(fixtures, 'author:"陀思妥耶夫斯基"')[0].key, "books:a");
assert.equal(
  related(fixtures, { links: [], automaticTags: true }, "books:a")[0].key,
  "darkroom:b",
);
assert.equal(
  related(
    fixtures,
    { links: [{ from: "books:a", to: "music:c", note: "明确关联" }] },
    "books:a",
  )[0].key,
  "music:c",
);
assert.equal(
  related(fixtures, { links: [], automaticTags: false }, "books:a").length,
  0,
);
const owned = {
  rights: {
    kind: "owned",
    publicDisplay: true,
    staticPublication: true,
    attribution: "原创测试",
  },
  lines: [
    { time: 2, text: "一" },
    { time: 5, text: "二" },
  ],
};
assert.equal(currentLine(owned.lines, 0), -1);
assert.equal(currentLine(owned.lines, 2), 0);
assert.equal(currentLine(owned.lines, 5), 1);
assert.equal(currentLine([], 999), -1);
assert(permittedLyrics(owned).timed);
assert.equal(
  permittedLyrics({
    ...owned,
    rights: { ...owned.rights, expiresAt: "2000-01-01" },
  }),
  null,
);
assert.equal(
  permittedLyrics({
    ...owned,
    rights: { ...owned.rights, staticPublication: false },
  }),
  null,
);
assert.equal(
  permittedLyrics({ ...owned, lines: [...owned.lines].reverse() }).timed,
  false,
);
const source = {
  provider: "local-authorized",
  src: "assets/music/test.wav",
  rights: {
    kind: "owned",
    staticPublication: true,
    publicPlayback: true,
    attribution: "test",
  },
};
assert(authorized(source));
assert(
  !authorized({
    ...source,
    rights: { ...source.rights, expiresAt: "2000-01-01" },
  }),
);
assert(
  !authorized({
    ...source,
    rights: { ...source.rights, staticPublication: false },
  }),
);
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
for (const t of data.music.tracks) assert(!html.includes(t.title));
assert(!html.includes("肖像"));
assert(!fs.existsSync(path.join(root, "content/life.json")));
const saved = JSON.parse(
  fs.readFileSync(path.join(root, "content/search-index.json"), "utf8"),
);
assert.deepEqual(saved.entries, entries);
assert(html.includes('fetchpriority="high"'));
assert(html.includes('rel="canonical"'));
console.log(
  "PASS: content schema, real-only catalog, advanced search, relations, lyric clock, rights boundaries, generated index, SEO and migration.",
);
