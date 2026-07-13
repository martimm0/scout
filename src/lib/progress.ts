import { sql } from "@vercel/postgres";

import { databaseConfigured } from "./env";

/**
 * The save file.
 *
 * Deliberately tiny. Everything the game needs to remember is either a boolean
 * keyed by id ("have you found the trillium") or a small counter, so the whole
 * thing serialises to a few hundred bytes of JSON and there is nothing to
 * migrate when a plant or a badge is added — an unknown key simply isn't set.
 *
 * It is stored as a single JSONB column rather than normalised into tables. A
 * schema of `players`, `discovered_plants`, `unlocked_badges`… would be the
 * textbook answer and would buy us precisely nothing: we never query across
 * players, and we always read and write the whole document at once.
 */

export type SavedProgress = {
  pollinator: Record<string, unknown>;
  discoveredPlants: Record<string, boolean>;
  discoveredFungi: Record<string, boolean>;
  quizPassed: Record<string, boolean>;
  seenPhases: Record<string, boolean>;
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
  /** Wall-clock of the last write. Used to settle conflicts, not to display. */
  savedAt: number;
};

let schemaReady = false;

/**
 * Create the table on first use.
 *
 * One table, one row per player. Doing this lazily rather than in a migration
 * step keeps a fresh deploy to "set the env vars and go" — and `IF NOT EXISTS`
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
