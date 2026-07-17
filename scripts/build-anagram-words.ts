/**
 * Precompute the anagram word lists.
 *
 * The anagram game asks you to make words from a plant's own name, so it has to
 * know whether what you typed is a real word. Shipping a dictionary to do that
 * would be a download for a runtime lookup, so instead this works out, once, at
 * build time, every word each plant's name can make, and emits them as data.
 *
 * That is smaller than a dictionary (only words those letters can reach), it is
 * an O(1) Set lookup at runtime, it is deterministic, and, most usefully, it
 * REPORTS WHICH NAMES CANNOT SUPPORT THE GAME. Pawpaw has three distinct letters
 * and can make "PAW". Heal-All has four. Without this check those plants would
 * ship an unwinnable minigame, and the only way anyone would find out is by
 * landing on one.
 *
 * The word list is a dev dependency (ENABLE, via `word-list`), not
 * /usr/share/dict/words, which is macOS-only and is Webster's Second: full of
 * archaic words and proper nouns, so it would both accept nonsense and lie about
 * how many words a name can really make.
 *
 * Run: npx tsx scripts/build-anagram-words.ts
 */
import { readFileSync, writeFileSync } from "node:fs";

import { words as popularWords } from "popular-english-words";
import wordListPath from "word-list";

import { PLANTS } from "../src/features/game/data/plants";
import {
  ANAGRAM_MIN_LENGTH,
  ANAGRAM_MIN_WORDS,
} from "../src/features/game/data/anagram";

/** The letters of a name, with everything that is not a letter thrown away. */
function lettersOf(name: string) {
  return name.toUpperCase().replace(/[^A-Z]/g, "");
}

/** Can `word` be spelled from `pool`, respecting how many of each letter there are? */
function canSpell(word: string, pool: Map<string, number>) {
  const need = new Map<string, number>();

  for (const letter of word) {
    need.set(letter, (need.get(letter) ?? 0) + 1);
  }

  for (const [letter, count] of need) {
    if ((pool.get(letter) ?? 0) < count) {
      return false;
    }
  }

  return true;
}

/**
 * Real words that people actually know.
 *
 * The intersection of two lists, and it needs to be both.
 *
 * ENABLE alone (272,713 words at 4+ letters) accepts ALAE, HALLAL and LALL. Using
 * it made two things wrong at once: the emitted table came to 278KB, which is
 * larger than the dictionary it was meant to avoid shipping, and the "can this
 * name support the game" check counted words no player could ever produce. It
 * said Heal-All had eleven words. Heal-All has HEAL, HALE and HALL.
 *
 * The popularity list alone would accept Wikipedia jargon like "infoboxes".
 *
 * Together: a real word, common enough to be guessed.
 */
const POPULAR_CUTOFF = 30_000;

const enable = new Set(
  readFileSync(wordListPath, "utf8")
    .split("\n")
    .map((word) => word.trim().toUpperCase()),
);

const words = popularWords
  .getMostPopular(POPULAR_CUTOFF)
  .map((word: string) => word.toUpperCase())
  .filter(
    (word: string) =>
      word.length >= ANAGRAM_MIN_LENGTH &&
      /^[A-Z]+$/.test(word) &&
      enable.has(word),
  );

console.log(
  `dictionary: ${words.length} words of ${ANAGRAM_MIN_LENGTH}+ letters ` +
    `(the ${POPULAR_CUTOFF} most common, kept only if ENABLE agrees they are words)`,
);

const table: Record<string, string[]> = {};
const tooThin: string[] = [];

for (const plant of PLANTS) {
  const letters = lettersOf(plant.commonName);
  const pool = new Map<string, number>();

  for (const letter of letters) {
    pool.set(letter, (pool.get(letter) ?? 0) + 1);
  }

  // A word made of the name's own letters is not a word made of the name.
  const makeable = words
    .filter((word) => word !== letters && canSpell(word, pool))
    .sort();

  if (makeable.length < ANAGRAM_MIN_WORDS) {
    tooThin.push(
      `${plant.id} (${plant.commonName}): only ${makeable.length} words` +
        (makeable.length ? ` [${makeable.join(", ")}]` : ""),
    );

    continue;
  }

  table[plant.id] = makeable;
}

const rows = Object.entries(table)
  .map(([id, list]) => `  "${id}": ${JSON.stringify(list)},`)
  .join("\n");

writeFileSync(
  "src/features/game/data/anagram-words.ts",
  `/**
 * Every word each plant's name can make. GENERATED. Do not edit by hand.
 *
 * Run \`npx tsx scripts/build-anagram-words.ts\` to rebuild. See that script for
 * why this is precomputed rather than looked up in a shipped dictionary.
 *
 * A plant missing from this table cannot support the anagram game, and
 * \`minigameFor()\` gives it a different one. That is not hypothetical: Pawpaw's
 * name has three distinct letters in it.
 */
export const ANAGRAM_WORDS: Record<string, readonly string[]> = {
${rows}
};
`,
);

console.log(`\\nwrote ${Object.keys(table).length} plants`);

if (tooThin.length) {
  console.log(`\\ncannot support the anagram (${tooThin.length}):`);
  for (const line of tooThin) console.log(`  ${line}`);
}
