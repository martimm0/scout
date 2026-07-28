import { readFile, writeFile } from "node:fs/promises";
import sharp from "sharp";

/**
 * Raster icons, from the one vector mark.
 *
 * The SVG is enough for Android and for the favicon, but not for iOS: Safari will
 * not use an SVG for a home screen icon and falls back to a screenshot of the
 * page, which is a poor first impression of a game about a bee.
 *
 * Two rules shape what comes out:
 *
 * 1. **Full bleed, square corners.** iOS applies its own rounded mask, so an icon
 *    that rounds its own corners ends up with corners inside corners and a ring of
 *    background showing through. The source mark has `rx="7"`; these do not.
 * 2. **The maskable one needs a safe zone.** A maskable icon can be cropped to a
 *    circle, and the bee spans nearly the full width of the source, so it is
 *    scaled to the middle 66% over a flat green field. Otherwise Android would
 *    shave its wings off.
 *
 * Sizes are exact multiples of the 32px art where it matters (512 = 16x), so the
 * pixels stay crisp; the 180 is downscaled from 512 with a nearest-neighbour
 * kernel rather than rendered directly, so it does not turn to mush.
 *
 * Run with: node scripts/build-icons.mjs
 */

const SOURCE = "src/app/icon.svg";
const GREEN = "#1f6b3b";

const svg = await readFile(SOURCE, "utf8");

/** The mark with square corners: iOS and Android both mask it themselves. */
const squared = svg.replace(/ rx="7"/, "");

/** The bee alone, with the background rect dropped, for compositing. */
const beeOnly = svg.replace(
  /<rect width="32" height="32" rx="7" fill="[^"]+" \/>/,
  "",
);

/** A flat field of the brand green, at any size. */
const field = (size) =>
  sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: GREEN,
    },
  });

// 1. The Apple touch icon. Square, full bleed, 180 is what iOS asks for.
const at512 = await sharp(Buffer.from(squared))
  .resize(512, 512)
  .png()
  .toBuffer();

await writeFile(
  "src/app/apple-icon.png",
  await sharp(at512)
    .resize(180, 180, { kernel: "nearest" })
    .png()
    .toBuffer(),
);

// 2. The `any` icon for the manifest, crisp at an exact 16x.
await writeFile("public/icon-512.png", at512);

// 3. The maskable icon: the bee at 66%, centred on the green, so a circular
//    crop cannot reach it.
const inner = Math.round(512 * 0.66);
const bee = await sharp(Buffer.from(beeOnly))
  .resize(inner, inner)
  .png()
  .toBuffer();

await writeFile(
  "public/icon-maskable-512.png",
  await field(512)
    .composite([{ input: bee, gravity: "centre" }])
    .png()
    .toBuffer(),
);

console.log(
  "wrote src/app/apple-icon.png, public/icon-512.png, public/icon-maskable-512.png",
);
