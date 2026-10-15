import { sql } from "@vercel/postgres";

import { completeSave, mergeInto } from "@/features/game/state/merge";

import { databaseConfigured } from "./env";

/**
 * The save file.
 *
 * Deliberately tiny. Everything the game needs to remember is either a boolean
 * keyed by id ("have you found the trillium") or a small counter, so the whole
 * thing serialises to a few hundred bytes of JSON and there is nothing to
 * migrate when a plant or a badge is added, an unknown key simply isn't set.
 *
 * It is stored as a single JSONB column rather than normalised into tables. A
 * schema of `players`, `discovered_plants`, `unlocked_badges`… would be the
 * textbook answer and would buy us precisely nothing: we never query across
 * players, and we always read and write the whole document at once.
 */

/**
 * The largest save worth accepting, in bytes of request body.
 *
 * Measured, not guessed: a save with every field at its limit (every species
 * found and quizzed, every badge, area and journal entry, all 120 seedling
 * slots and all 12 marks, the longest real ids, worst-case float text) comes
 * to about 31.5 KB, two thirds of it seedlings. This is eight times that. The
 * seedling cap does not grow with the species list, so new parks add a few
 * hundred bytes of booleans each and nowhere near the ceiling.
 *
 * It exists because this route used to store whatever JSON it was handed. The
 * photos route has always capped its payload and answered 413; this one did
 * not, so any signed-in account could put a few megabytes into its row, and
 * with an account ceiling of a hundred that is most of a free-tier database.
 */
export const MAX_PROGRESS_BYTES = 256_000;

export type SavedProgress = {
  pollinator: Record<string, unknown>;
  discoveredPlants: Record<string, boolean>;
  discoveredFungi: Record<string, boolean>;
  unlockedParks: Record<string, boolean>;
  quizPassed: Record<string, boolean>;
  seenPhases: Record<string, boolean>;
  seenSeasons: Record<string, boolean>;
  seenWeather: Record<string, boolean>;
  winterKnown: Record<string, boolean>;
  pollinatedPlants: Record<string, boolean>;
  unlockedMapAreas: Record<string, boolean>;
  unlockedBadges: Record<string, boolean>;
  unlockedJournalEntries: Record<string, boolean>;
  stats: {
    pollinationAttempts: number;
    pollinationSuccesses: number;
    streak: number;
    bestStreak: number;
    quizzesTaken: number;
    quizzesPassed: number;
    questionsCorrect: number;
  };
  tutorialSeen: boolean;
  /**
   * The account the save belongs to. Stamped by the route from the session,
   * never taken from the payload; optional because every row written before
   * owners existed has none.
   */
  owner?: string;
  /**
   * The account's last admin reset that this save knows about. Sent by the
   * client, compared by the route, never stored: the account holds the truth.
   */
  resetAt?: number;
  /** Wall-clock of the last write. Not used to settle anything any more. */
  savedAt: number;
};

let schemaReady = false;

/**
 * Create the table on first use.
 *
 * One table, one row per player. Doing this lazily rather than in a migration
 * step keeps a fresh deploy to "set the env vars and go", and `IF NOT EXISTS`
 * makes it safe to run on every cold start.
 */
async function ensureSchema() {
  if (schemaReady) {
    return;
  }

  await sql`
    CREATE TABLE IF NOT EXISTS player_progress (
      user_id    TEXT PRIMARY KEY,
      progress   JSONB NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;

  schemaReady = true;
}

export async function loadProgress(
  userId: string,
): Promise<SavedProgress | null> {
  if (!databaseConfigured) {
    return null;
  }

  await ensureSchema();

  const { rows } = await sql<{ progress: SavedProgress }>`
    SELECT progress FROM player_progress WHERE user_id = ${userId}
  `;

  return rows[0]?.progress ?? null;
}

/**
 * Fold a save into the row, never over it.
 *
 * This used to replace the row with whatever arrived, last write wins. With one
 * device that is the same thing as a merge. With two it is not: a phone that had
 * been open since before the laptop found something would, on its next save (a
 * change, or simply being put in a pocket, which fires the hide beacon), write
 * its older copy over the account, and the laptop's find was gone from every
 * device that had not seen it yet. Progress only goes up, so the server keeps
 * the union, through the same `mergeInto` the client uses on sign-in.
 *
 * The bee is the one value that is replaced rather than unioned, and the
 * incoming save is the newer choice, so it wins; the streak is the sending
 * device's current run.
 *
 * Read, merge, then write only if nobody wrote in between (`updated_at` is the
 * version), and go round again if somebody did. Two saves landing together
 * would otherwise each merge against the same old row and the second would
 * drop the first's find, which is the bug again with a smaller window.
 *
 * The ceiling applies to what is STORED. The route checks each request, which
 * was enough while a save replaced the row; a merged row is the union of every
 * request, so two saves under the ceiling with different junk in them made a
 * row twice its size. A real save is an eighth of the ceiling, so a merge of
 * two real ones never comes near it.
 */
export async function saveProgress(
  userId: string,
  incoming: unknown,
  stamp: { owner: string; savedAt: number },
): Promise<"ok" | "too-big"> {
  if (!databaseConfigured) {
    return "ok";
  }

  await ensureSchema();

  const next = completeSave(incoming);

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const { rows } = await sql<{ progress: unknown; version: string }>`
      SELECT progress, updated_at::text AS version
      FROM player_progress WHERE user_id = ${userId}
    `;
    const current = rows[0];

    const merged = current
      ? mergeInto(completeSave(current.progress), next)
      : next;
    const document = JSON.stringify({
      ...merged,
      stats: { ...merged.stats, streak: next.stats.streak },
      ...stamp,
    });

    if (new TextEncoder().encode(document).length > MAX_PROGRESS_BYTES) {
      return "too-big";
    }

    const { rowCount } = current
      ? await sql`
          UPDATE player_progress
          SET progress = ${document}::jsonb, updated_at = clock_timestamp()
          WHERE user_id = ${userId} AND updated_at::text = ${current.version}
        `
      : await sql`
          INSERT INTO player_progress (user_id, progress, updated_at)
          VALUES (${userId}, ${document}::jsonb, clock_timestamp())
          ON CONFLICT (user_id) DO NOTHING
        `;

    if (rowCount) {
      return "ok";
    }
  }

  throw new Error("save-contended");
}
