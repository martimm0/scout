#!/usr/bin/env node

/**
 * Fetch a species photograph from Wikimedia Commons, with its credit.
 *
 * The photo records have always said they were "generated from the Wikimedia
 * Commons API", and they were, but the thing that generated them was never in
 * the repository. So the next person to add a species had the choice of doing it
 * by hand from memory, which is exactly how an unlicensed image or a wrong
 * attribution gets in, or of writing this again.
 *
 * Usage:
 *
 *   node scripts/source-photo.mjs <slug> "<File:Name.jpg>"
 *   node scripts/source-photo.mjs --search "Silene noctiflora"
 *
 * The first form downloads the image to `public/images/plants/<slug>.jpg` at the
 * ~900px the rest of the set uses and prints the record to paste into
 * `plant-photos.ts` and the row for `CREDITS.md`. The second lists candidates
 * with their licences so you can pick one.
 *
 * **It refuses anything that is not reusable.** Only Public Domain, CC0, CC BY
 * and CC BY-SA pass; everything else exits non-zero without downloading. The
 * game's second rule is that every fact is sourced, and a photograph nobody
 * checked the licence on is the same failure wearing a different hat.
 */

const AGENT = "scout-photo-sourcing/1.0 (https://github.com/martimm0/scout)";
const API = "https://commons.wikimedia.org/w/api.php";

/** Licences the project may actually use. Anything else is a refusal. */
const ALLOWED = [/^public domain/i, /^cc0/i, /^cc by(?!-nc|-nd)/i];

async function api(params) {
  const url = `${API}?${new URLSearchParams({ format: "json", ...params })}`;
  const response = await fetch(url, { headers: { "User-Agent": AGENT } });

  if (!response.ok) {
    throw new Error(`Commons said ${response.status} for ${url}`);
  }

  return response.json();
}

/**
 * The author, as a person rather than as markup.
 *
 * Commons stores this as an HTML fragment: usually a link to a user page,
 * sometimes wrapped in a vCard div, sometimes prefixed with "No machine-readable
 * author provided" and a guess. Pasting that raw into the credits would put a
 * sentence of boilerplate where a name should be.
 */
function authorOf(html) {
  if (!html) {
    return "Unknown";
  }

  const text = html
    .replace(/<[^>]*>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();

  // "No machine-readable author provided. Taka assumed (based on ...)" is
  // Commons boilerplate around a name. Keep the name.
  const assumed = /No machine-readable author provided\.?\s*(.+?)\s+assumed/i.exec(
    text,
  );

  if (assumed) {
    return assumed[1].trim();
  }

  return text;
}

async function search(term) {
  const data = await api({
    action: "query",
    generator: "search",
    gsrsearch: term,
    gsrnamespace: "6",
    gsrlimit: "20",
    prop: "imageinfo",
    iiprop: "extmetadata|url|mime|size",
  });

  const pages = Object.values(data?.query?.pages ?? {});

  for (const page of pages) {
    const info = page.imageinfo?.[0];

    if (!info || info.mime !== "image/jpeg") {
      continue;
    }

    const licence = info.extmetadata?.LicenseShortName?.value ?? "";
    const ok = ALLOWED.some((pattern) => pattern.test(licence)) ? " " : "x";

    console.log(
      `${ok} ${String(info.width).padStart(5)}x${String(info.height).padEnd(5)} ` +
        `${licence.padEnd(16)} ${page.title}`,
    );
  }
}

async function fetchOne(slug, file) {
  const title = file.startsWith("File:") ? file : `File:${file}`;
  const data = await api({
    action: "query",
    titles: title,
    prop: "imageinfo",
    iiprop: "extmetadata|url|mime|size",
    // Commons resizes for us, which is how the set stays at a consistent width
    // without a local image toolchain.
    iiurlwidth: "900",
  });

  const page = Object.values(data?.query?.pages ?? {})[0];
  const info = page?.imageinfo?.[0];

  if (!info) {
    throw new Error(`no such file on Commons: ${title}`);
  }

  const meta = info.extmetadata ?? {};
  const licence = meta.LicenseShortName?.value ?? "";

  if (!ALLOWED.some((pattern) => pattern.test(licence))) {
    throw new Error(
      `refusing ${title}: licence is "${licence}", which is not one this project may use`,
    );
  }

  const image = await fetch(info.thumburl ?? info.url, {
    headers: { "User-Agent": AGENT },
  });

  if (!image.ok) {
    throw new Error(`could not download the image: ${image.status}`);
  }

  const { writeFile } = await import("node:fs/promises");
  const path = `public/images/plants/${slug}.jpg`;

  await writeFile(path, Buffer.from(await image.arrayBuffer()));

  const record = {
    src: `/images/plants/${slug}.jpg`,
    title: page.title.replace(/^File:/, ""),
    author: authorOf(meta.Artist?.value),
    license: licence,
    licenseUrl: (meta.LicenseUrl?.value ?? "").replace(/\/$/, ""),
    sourceUrl: info.descriptionurl,
  };

  console.log(`wrote ${path}`);
  console.log(`\n  "${slug}": ${JSON.stringify(record, null, 4)},\n`);
  console.log(
    `| … | … | \`${slug}.jpg\` | ${record.author} | ` +
      `[${record.license}](${record.licenseUrl}) | ` +
      `[Commons file page](${record.sourceUrl}) |`,
  );
}

const [first, second] = process.argv.slice(2);

if (first === "--search") {
  await search(second);
} else if (first && second) {
  await fetchOne(first, second);
} else {
  console.error("usage: source-photo.mjs <slug> <File:Name.jpg> | --search <term>");
  process.exit(1);
}
