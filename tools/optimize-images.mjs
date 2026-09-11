import fs from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
export function sharpModule() {
  return require(process.env.SHARP_MODULE || "sharp");
}
// sharp drops all metadata by default. Never call keepMetadata/withMetadata.
export async function optimize(input, outputStem) {
  const sharp = sharpModule();
  const meta = await sharp(input, { limitInputPixels: 80000000 }).metadata();
  if (!["jpeg", "png", "webp", "avif", "tiff", "heif"].includes(meta.format))
    throw Error("Unsupported photo format");
  const rotated = meta.orientation >= 5 && meta.orientation <= 8;
  const width = rotated ? meta.height : meta.width,
    height = rotated ? meta.width : meta.height;
  const sizes = [...new Set([480, 960, 1600].map((s) => Math.min(s, width)))];
  await fs.mkdir(path.dirname(outputStem), { recursive: true });
  const variants = [],
    avif = [];
  for (const size of sizes) {
    for (const format of ["webp", "avif"]) {
      const output = `${outputStem}-${size}.${format}`;
      const image = sharp(input, { limitInputPixels: 80000000 })
        .rotate()
        .resize({ width: size, withoutEnlargement: true });
      const info = await image[format]({
        quality: format === "webp" ? 82 : 55,
        effort: 4,
      }).toFile(output);
      const check = await sharp(output).metadata();
      if (check.exif || check.xmp || check.iptc)
        throw Error("Metadata stripping failed");
      (format === "webp" ? variants : avif).push({
        src: output,
        width: info.width,
        height: info.height,
      });
    }
  }
  return {
    width,
    height,
    variants,
    avif,
    src: variants.at(-1).src,
    thumbnail: variants[0].src,
  };
}
if (process.argv[1]?.endsWith("optimize-images.mjs")) {
  if (process.argv.length < 4)
    throw Error("Usage: node tools/optimize-images.mjs INPUT OUTPUT_STEM");
  console.log(
    JSON.stringify(await optimize(process.argv[2], process.argv[3]), null, 2),
  );
}
