import { sql } from "@vercel/postgres";

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
  /** Wall-clock of the last write. Used to settle conflicts, not to display. */
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

export async function saveProgress(userId: string, progress: SavedProgress) {
  if (!databaseConfigured) {
    return;
  }

  await ensureSchema();

  // Last write wins, but only if it is actually newer. Two tabs open on the same
  // account would otherwise take turns clobbering each other, and the player
  // would watch their journal flicker between two versions of the truth.
  await sql`
    INSERT INTO player_progress (user_id, progress, updated_at)
    VALUES (${userId}, ${JSON.stringify(progress)}::jsonb, now())
    ON CONFLICT (user_id) DO UPDATE
      SET progress = EXCLUDED.progress,
          updated_at = now()
      WHERE (player_progress.progress ->> 'savedAt')::bigint
            <= ${progress.savedAt}
  `;
}
