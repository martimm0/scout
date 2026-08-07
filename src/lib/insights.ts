import { sql } from "@vercel/postgres";

import { readPartyCounters } from "./accounts";
import { databaseConfigured } from "./env";

/**
 * What the game looks like from above.
 *
 * Read-only, and derived entirely from the save files already in Postgres plus
 * a handful of party counters. Nothing new is recorded about anybody to make
 * this work.
 *
 * **This is an admin tool, not a feature, and the difference matters.** The
 * game has no leaderboard and never will, so nothing here ranks one player
 * against another: the per-player view is for answering "is this person stuck",
 * and the aggregate view is for answering "is this plant impossible to find".
 * A "top players" list would be the leaderboard the game refuses, entered
 * through the back door.
 */

export type ContentInsight = {
  id: string;
  found: number;
  pollinated: number;
  quizPassed: number;
};

export type Insights = {
  /** Sign-ups and activity, from the accounts table. */
  signupsByWeek: { week: string; accounts: number }[];
  activeLastWeek: number;
  activeLastMonth: number;
  neverPlayed: number;

  /** Collection, across everybody with a save. */
  medianSpeciesFound: number;
  medianPollinated: number;
  medianBadges: number;

  /** Which content is working. Sorted so the tail is what you look at. */
  species: ContentInsight[];
  unearnedBadges: { id: string; earned: number }[];

  /** Garden parties. Counters, because the room keeps nothing. */
  party: Record<string, number>;
};

const EMPTY: Insights = {
  signupsByWeek: [],
  activeLastWeek: 0,
  activeLastMonth: 0,
  neverPlayed: 0,
  medianSpeciesFound: 0,
  medianPollinated: 0,
  medianBadges: 0,
  species: [],
  unearnedBadges: [],
  party: {},
};

/** The middle value, which is the honest average for a long tail of players. */
function median(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }

  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);

  return sorted.length % 2
    ? sorted[middle]
    : Math.round((sorted[middle - 1] + sorted[middle]) / 2);
}

export async function getInsights(): Promise<Insights> {
  if (!databaseConfigured) {
    return EMPTY;
  }

  try {
    /**
     * One pass over the saves, counted in JavaScript rather than SQL.
     *
     * The progress blob is a JSONB object of `{ id: true }` records, and asking
     * Postgres to pivot that into per-species counts is a query nobody will be
     * able to read in six months. There are hundreds of players at most, so the
     * whole set fits in memory comfortably and the arithmetic is obvious.
     */
    const [{ rows: saves }, { rows: accounts }, party] = await Promise.all([
      sql<{ progress: Record<string, unknown> }>`
        SELECT progress FROM player_progress
      `,
      sql<{
        created_at: string;
        last_seen: string;
        has_save: boolean;
      }>`
        SELECT
          a.created_at,
          a.last_seen,
          (p.user_id IS NOT NULL) AS has_save
        FROM accounts a
        LEFT JOIN player_progress p ON p.user_id = a.user_id
      `,
      readPartyCounters(),
    ]);

    const keysOf = (blob: Record<string, unknown>, field: string) =>
      Object.entries((blob[field] as Record<string, boolean>) ?? {})
        .filter(([, on]) => on)
        .map(([id]) => id);

    const found = new Map<string, number>();
    const pollinated = new Map<string, number>();
    const quizzed = new Map<string, number>();
    const badges = new Map<string, number>();

    const bump = (map: Map<string, number>, id: string) =>
      map.set(id, (map.get(id) ?? 0) + 1);

    const speciesCounts: number[] = [];
    const pollinatedCounts: number[] = [];
    const badgeCounts: number[] = [];

    for (const row of saves) {
      const blob = row.progress ?? {};
      const plants = keysOf(blob, "discoveredPlants");
      const fungi = keysOf(blob, "discoveredFungi");
      const worked = keysOf(blob, "pollinatedPlants");
      const passed = keysOf(blob, "quizPassed");
      const earned = keysOf(blob, "unlockedBadges");

      for (const id of [...plants, ...fungi]) bump(found, id);
      for (const id of worked) bump(pollinated, id);
      for (const id of passed) bump(quizzed, id);
      for (const id of earned) bump(badges, id);

      speciesCounts.push(plants.length + fungi.length);
      pollinatedCounts.push(worked.length);
      badgeCounts.push(earned.length);
    }

    const ids = new Set([
      ...found.keys(),
      ...pollinated.keys(),
      ...quizzed.keys(),
    ]);

    const species: ContentInsight[] = [...ids]
      .map((id) => ({
        id,
        found: found.get(id) ?? 0,
        pollinated: pollinated.get(id) ?? 0,
        quizPassed: quizzed.get(id) ?? 0,
      }))
      // Rarest first: the tail is the interesting end. A species nobody has
      // found is either very well hidden or genuinely unreachable, and the
      // second of those has happened twice.
      .sort((a, b) => a.found - b.found);

    const now = Date.now();
    const daysAgo = (days: number) => now - days * 24 * 60 * 60 * 1000;

    const week = new Map<string, number>();

    for (const account of accounts) {
      const at = new Date(account.created_at);
      // ISO-ish week bucket: the Monday of that week, as a date string.
      const monday = new Date(at);

      monday.setDate(at.getDate() - ((at.getDay() + 6) % 7));
      const key = monday.toISOString().slice(0, 10);

      week.set(key, (week.get(key) ?? 0) + 1);
    }

    return {
      signupsByWeek: [...week.entries()]
        .map(([w, n]) => ({ week: w, accounts: n }))
        .sort((a, b) => a.week.localeCompare(b.week)),
      activeLastWeek: accounts.filter(
        (a) => new Date(a.last_seen).getTime() > daysAgo(7),
      ).length,
      activeLastMonth: accounts.filter(
        (a) => new Date(a.last_seen).getTime() > daysAgo(30),
      ).length,
      neverPlayed: accounts.filter((a) => !a.has_save).length,
      medianSpeciesFound: median(speciesCounts),
      medianPollinated: median(pollinatedCounts),
      medianBadges: median(badgeCounts),
      species,
      unearnedBadges: [...badges.entries()]
        .map(([id, earned]) => ({ id, earned }))
        .sort((a, b) => a.earned - b.earned),
      party,
    };
  } catch {
    // The admin page must still render if a query goes wrong. An empty chart is
    // better than a 500 on the one page you go to when something is wrong.
    return EMPTY;
  }
}
