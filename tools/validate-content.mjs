import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { readAll, root, validId, assetPath } from "./lib.mjs";
import { permittedLyrics } from "../js/lyrics.js";
import { catalog } from "../js/catalog.js";
export function validate(data = readAll()) {
  const keys = new Set();
  const asset = (src) => {
    if (/^https:\/\//.test(src)) {
      new URL(src);
      return;
    }
    assert(fs.existsSync(assetPath(src)), `Missing asset: ${src}`);
  };
  const url = (s) => {
    assert(/^https:\/\//.test(s), `External links need HTTPS: ${s}`);
    new URL(s);
  };
  for (const kind of ["music", "cinema", "books", "darkroom", "notes"]) {
    const items = data[kind][kind === "music" ? "tracks" : "items"];
    assert(Array.isArray(items), `${kind}: expected array`);
    const ids = new Set();
    for (const item of items) {
      assert(validId(item.id), `Invalid ID: ${item.id}`);
      assert(!ids.has(item.id), `Duplicate ID: ${kind}/${item.id}`);
      ids.add(item.id);
      keys.add(kind + ":" + item.id);
      assert.equal(typeof item.published, "boolean");
      assert.equal(typeof item.placeholder, "boolean");
      assert(
        item.title?.trim() || item.alt?.trim(),
        `Missing title: ${item.id}`,
      );
      assert(
        !item.tags ||
          (Array.isArray(item.tags) &&
            item.tags.every((t) => typeof t === "string")),
        `Invalid tags: ${item.id}`,
      );
      if (item.image) {
        asset(item.image);
        assert(item.alt?.trim());
      }
      if (item.cover?.src) {
        asset(item.cover.src);
        assert(item.cover.alt?.trim());
      }
      for (const u of Object.values(item.links || {})) if (u) url(u);
      if (kind === "music") {
        assert(Array.isArray(item.sources), `Missing sources: ${item.id}`);
        for (const s of item.sources) {
          assert(
            ["local-authorized", "apple", "netease", "bilibili"].includes(
              s.provider,
            ),
            `Unknown provider: ${s.provider}`,
          );
          if (s.provider === "local-authorized") {
            asset(s.src);
            const r = s.rights;
            assert(
              r &&
                ["owned", "direct-permission", "public-domain"].includes(
                  r.kind,
                ) &&
                r.publicPlayback === true &&
                r.staticPublication === true &&
                r.attribution,
              `Missing audio permission: ${item.id}`,
            );
            if (r.expiresAt)
              assert(
                Date.parse(r.expiresAt) > Date.now(),
                `Expired audio: ${item.id}`,
              );
            assert(
              !s.offsetSeconds ||
                (Number.isFinite(s.offsetSeconds) && s.offsetSeconds >= 0),
            );
          } else {
            url(s.url);
            const hosts = {
              apple: ["music.apple.com"],
              netease: ["music.163.com"],
              bilibili: ["www.bilibili.com", "bilibili.com"],
            };
            assert(hosts[s.provider].includes(new URL(s.url).hostname));
            if (s.embed) {
              url(s.embed);
              const host = {
                apple: "embed.music.apple.com",
                netease: "music.163.com",
                bilibili: "player.bilibili.com",
              }[s.provider];
              assert(new URL(s.embed).hostname === host);
            }
          }
        }
      }
      if (kind === "darkroom") {
        asset(item.src);
        assert(item.alt?.trim());
        assert(item.width > 0 && item.height > 0);
        assert(
          data.darkroom.rolls.some((r) => r.id === item.rollId),
          `Unknown roll: ${item.id}`,
        );
        assert(
          item.rights?.staticPublication === true &&
            ["owned", "direct-permission", "public-domain"].includes(
              item.rights?.kind,
            ) &&
            item.rights.attribution,
          `Missing photo rights: ${item.id}`,
        );
        if (item.rights.expiresAt)
          assert(
            Date.parse(item.rights.expiresAt) > Date.now(),
            `Expired photo: ${item.id}`,
          );
        for (const v of [...(item.variants || []), ...(item.avif || [])]) {
          asset(v.src);
          assert(v.width > 0);
        }
      }
    }
  }
  const rollIds = new Set();
  for (const r of data.darkroom.rolls) {
    assert(validId(r.id) && r.title);
    assert(!rollIds.has(r.id));
    rollIds.add(r.id);
    if (r.coverId)
      assert(
        data.darkroom.items.some(
          (p) => p.id === r.coverId && p.rollId === r.id,
        ),
        "Invalid roll cover",
      );
  }
  for (const [id, entry] of Object.entries(data.lyrics.tracks)) {
    assert(keys.has("music:" + id));
    assert(
      permittedLyrics(entry),
      `Missing or expired lyric permission: ${id}`,
    );
    if (entry.lines.some((l) => "time" in l))
      assert(permittedLyrics(entry).timed, `Invalid lyric timing: ${id}`);
  }
  for (const r of data.relations.links) {
    assert(
      keys.has(r.from) && keys.has(r.to),
      `Broken relation ${r.from} -> ${r.to}`,
    );
    assert(r.from !== r.to, "Self relation");
  }
  asset(data.site.hero.portrait.src);
  for (const v of data.site.hero.portrait.variants) asset(v.src);
  assert.equal(
    fs.readFileSync(path.join(root, "CNAME"), "utf8").trim(),
    "burnlamp.is-my.id",
  );
  assert(fs.existsSync(path.join(root, ".nojekyll")));
  return catalog(data).length;
}
if (process.argv[1]?.endsWith("validate-content.mjs"))
  console.log(
    `PASS: content, media, rights, references and domain; ${validate()} real entries.`,
  );
