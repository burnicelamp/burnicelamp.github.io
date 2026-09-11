import fs from "node:fs";
import path from "node:path";
import { root, readAll, write, validId } from "./lib.mjs";
import { optimize } from "./optimize-images.mjs";
import { buildSearch } from "./build-search.mjs";
import { validate } from "./validate-content.mjs";
// Manifest is private input outside the public repository; originals never copied.
const manifestPath = path.resolve(process.argv[2] || "");
if (!process.argv[2])
  throw Error("Usage: node tools/ingest-photo.mjs PATH_TO_MANIFEST.json");
const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
if (manifestPath.startsWith(root + path.sep))
  throw Error("Keep the private import manifest outside the public repository");
const data = readAll(),
  room = data.darkroom;
const roll = manifest.roll;
if (!validId(roll?.id) || !roll.title)
  throw Error("roll requires a stable id and title");
if (!Array.isArray(manifest.photos) || !manifest.photos.length)
  throw Error("photos must not be empty");
if (manifest.coverId && !manifest.photos.some((p) => p.id === manifest.coverId))
  throw Error("coverId must reference an imported photo");
const ids = new Set(room.items.map((x) => x.id));
for (const p of manifest.photos) {
  if (!validId(p.id) || ids.has(p.id))
    throw Error("Missing or duplicate photo id");
  ids.add(p.id);
  if (!p.alt || !p.file) throw Error("Every photo needs file and alt");
  if (
    !["owned", "direct-permission", "public-domain"].includes(p.rights?.kind) ||
    p.rights.staticPublication !== true ||
    !p.rights.attribution
  )
    throw Error("Photo publication rights required");
  if (!/^\d{4}-\d{2}(-\d{2})?$/.test(p.date || ""))
    throw Error("Explicit date YYYY-MM or YYYY-MM-DD required");
  const original = path.resolve(path.dirname(manifestPath), p.file);
  if (original.startsWith(root + path.sep))
    throw Error("Keep original photos outside the public repository");
  if (!fs.existsSync(original)) throw Error("Original file missing");
}
const oldRoll = room.rolls.find((r) => r.id === roll.id);
if (!oldRoll) room.rolls.push({ ...roll, published: true });
else if (roll.title !== oldRoll.title)
  throw Error("Existing roll title differs; edit explicitly first");
for (const p of manifest.photos) {
  const stem = path.join(
    root,
    "assets",
    "darkroom",
    roll.id,
    `${p.date}-${p.id}`,
  );
  if (fs.existsSync(stem + "-480.webp"))
    throw Error("Refusing to overwrite photo");
  const media = await optimize(
    path.resolve(path.dirname(manifestPath), p.file),
    stem,
  );
  const relative = (s) => path.relative(root, s).split(path.sep).join("/");
  room.items.push({
    id: p.id,
    rollId: roll.id,
    published: true,
    placeholder: false,
    title: p.title || p.alt,
    alt: p.alt,
    date: p.date,
    location: p.location || "",
    caption: p.caption || "",
    tags: p.tags || [],
    rights: p.rights,
    ...media,
    src: relative(media.src),
    thumbnail: relative(media.thumbnail),
    variants: media.variants.map((v) => ({ ...v, src: relative(v.src) })),
    avif: media.avif.map((v) => ({ ...v, src: relative(v.src) })),
  });
}
if (manifest.coverId) {
  if (!manifest.photos.some((p) => p.id === manifest.coverId))
    throw Error("coverId must reference an imported photo");
  room.rolls.find((r) => r.id === roll.id).coverId = manifest.coverId;
}
validate(data);
write("darkroom", room);
buildSearch(data);
console.log(
  `Imported ${manifest.photos.length} photos. Metadata stripped; indexes rebuilt. Review the diff before commit/push.`,
);
