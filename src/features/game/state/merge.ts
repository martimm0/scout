import type { GameState } from "./game-store";
import { mergeMarks, type Mark } from "../world/marks";
import { mergeSeedlings } from "../world/seedlings";

/**
 * The part of the game state that is the save: what the client pushes, what
 * the route stores, and what the merge folds together.
 *
 * Its own module, with no "use client" and nothing that touches the browser,
 * because the route merges with it too.
 */
export type SaveFields = Pick<
  GameState,
  | "pollinator"
  | "discoveredPlants"
  | "discoveredFungi"
  | "unlockedParks"
  | "quizPassed"
  | "seenPhases"
  | "seenSeasons"
  | "seenWeather"
  | "winterKnown"
  | "pollinatedPlants"
  | "seedlings"
  | "marks"
  | "unlockedMapAreas"
  | "unlockedBadges"
  | "unlockedJournalEntries"
  | "stats"
  | "tutorialSeen"
>;

const RECORDS = [
  "discoveredPlants",
  "discoveredFungi",
  "unlockedParks",
  "quizPassed",
  "seenPhases",
  "seenSeasons",
  "seenWeather",
  "winterKnown",
  "pollinatedPlants",
  "unlockedMapAreas",
  "unlockedBadges",
  "unlockedJournalEntries",
] as const;

const STATS = [
  "pollinationAttempts",
  "pollinationSuccesses",
  "streak",
  "bestStreak",
  "quizzesTaken",
  "quizzesPassed",
  "questionsCorrect",
] as const;

const isObject = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

/**
 * Any stored or posted save, made whole.
 *
 * The client's own state is always complete; a row is not. Rows from before a
 * field existed lack it, and the route takes JSON from the network, where a
 * `marks` of `"x"` or a `null` inside it would throw out of the merge as a 500.
 * Every field comes back the right shape, empty where it was missing or wrong,
 * and an empty field is exactly what a union ignores.
 */
export function completeSave(raw: unknown): SaveFields {
  const save = isObject(raw) ? raw : {};
  const stats = isObject(save.stats) ? save.stats : {};
  const records = Object.fromEntries(
    RECORDS.map((field) => [field, isObject(save[field]) ? save[field] : {}]),
  ) as Pick<SaveFields, (typeof RECORDS)[number]>;

  return {
    ...records,
    pollinator: (isObject(save.pollinator)
      ? save.pollinator
      : {}) as SaveFields["pollinator"],
    seedlings: (isObject(save.seedlings)
      ? Object.fromEntries(
          Object.entries(save.seedlings).filter(
            ([, seedling]) =>
              isObject(seedling) && typeof seedling.at === "number",
          ),
        )
      : {}) as SaveFields["seedlings"],
    marks: (Array.isArray(save.marks)
      ? save.marks.filter(
          (mark): mark is Mark =>
            isObject(mark) &&
            typeof mark.at === "number" &&
            typeof mark.x === "number" &&
            typeof mark.z === "number",
        )
      : []) as Mark[],
    stats: Object.fromEntries(
      STATS.map((field) => {
        const value = Number(stats[field]);

        return [field, Number.isFinite(value) ? value : 0];
      }),
    ) as SaveFields["stats"],
    tutorialSeen: save.tutorialSeen === true,
  };
}

/**
 * Merge a cloud save into the local store.
 *
 * Progress is monotonic (you never un-discover a plant) so the merge is a
 * union rather than a replacement. That means a player whose last save never
 * reached the server gets it back the next time they sign in on this device,
 * instead of watching the server overwrite their afternoon.
 *
 * It runs in two places. The client folds the server's copy into the device's
 * on sign-in, and the route folds every incoming save into the row it already
 * holds, so a device that has been open since before another one found
 * something cannot write its older copy over the account.
 *
 * Exported so the suite can put a hostile save in front of the real function. The
 * first attempt at that test drove the UI instead, and passed against the bug: no
 * page it could reach mounts the sync, so no merge ever ran and it was really only
 * asserting that localStorage still said what the test had written into it.
 */
export function mergeInto(local: SaveFields, remote: Partial<SaveFields>): SaveFields {
  /**
   * A genuinely monotonic union: OR, not spread.
   *
   * `{ ...a, ...b }` is the obvious way to write this and it is not a union, it is
   * "b wins". Every key in these records is only ever set to true by the game, so
   * the two behave identically in practice, which is what makes the difference easy
   * to miss. But `/api/progress` stores any object it is handed under its size ceiling, so a row
   * carrying `{ trillium: false }` would have overwritten a trillium this player
   * had genuinely found, and the whole point of the merge is that progress only
   * ever goes up. ORing makes the property the comment below claims actually true
   * rather than incidentally true.
   */
  const union = (
    a: Record<string, boolean>,
    b: Record<string, boolean> | undefined,
  ) => {
    const merged: Record<string, boolean> = { ...a };

    for (const [key, value] of Object.entries(b ?? {})) {
      merged[key] = Boolean(value) || Boolean(merged[key]);
    }

    return merged;
  };

  return {
    // MERGED, not replaced. `remote.pollinator ?? local.pollinator` looks right
    // and is not: an empty object is truthy, so a partial or empty row on the
    // server replaced the whole bee, the palette lost its colours, and the voxel
    // builder threw "missing an entry for B" and took the entire scene down with
    // it. Spreading local underneath means a bad row can no longer produce a bee
    // that cannot be drawn.
    pollinator: {
      ...local.pollinator,
      ...(remote.pollinator as Partial<GameState["pollinator"]>),
    } as GameState["pollinator"],
    discoveredPlants: union(local.discoveredPlants, remote.discoveredPlants),
    discoveredFungi: union(local.discoveredFungi, remote.discoveredFungi),
    // A park you have earned on any device is earned. Union, never intersect.
    unlockedParks: union(local.unlockedParks, remote.unlockedParks),
    quizPassed: union(local.quizPassed, remote.quizPassed),
    seenPhases: union(local.seenPhases, remote.seenPhases),
    seenSeasons: union(local.seenSeasons, remote.seenSeasons),
    seenWeather: union(local.seenWeather, remote.seenWeather),
    winterKnown: union(local.winterKnown, remote.winterKnown),
    pollinatedPlants: union(local.pollinatedPlants, remote.pollinatedPlants),
    /**
     * Seed set on any device is seed set, and it keeps the EARLIER date.
     *
     * The rules live in `mergeSeedlings` rather than here, and they used to
     * live here, inline, which is how the cap got lost: this spread local over
     * remote and returned it, so two devices each sitting at the limit merged
     * to twice the limit and syncing was itself the way around the bound.
     */
    seedlings: mergeSeedlings(local.seedlings, remote.seedlings),
    /**
     * Marks are merged by spot and kept newest-first, then capped.
     *
     * Not monotonic like everything else here, and deliberately: a mark is
     * about where the forage is NOW, so it expires, and a union that never
     * dropped anything would hand a player back every pin they had ever
     * dropped on two devices. `mergeMarks` sorts by when each was danced
     * before it dedupes and caps; see it for why folding through `addMark`,
     * which this used to do, turned the record upside down.
     */
    // Both sides guarded: the suite hands this a half-built save on purpose,
    // and a spread of anything that is not an array throws.
    marks: mergeMarks(
      Array.isArray(local.marks) ? local.marks : [],
      Array.isArray(remote.marks) ? remote.marks : [],
      Date.now(),
    ),
    unlockedMapAreas: union(local.unlockedMapAreas, remote.unlockedMapAreas),
    unlockedBadges: union(local.unlockedBadges, remote.unlockedBadges),
    unlockedJournalEntries: union(
      local.unlockedJournalEntries,
      remote.unlockedJournalEntries,
    ),
    stats: {
      pollinationAttempts: Math.max(
        local.stats.pollinationAttempts,
        remote.stats?.pollinationAttempts ?? 0,
      ),
      pollinationSuccesses: Math.max(
        local.stats.pollinationSuccesses,
        remote.stats?.pollinationSuccesses ?? 0,
      ),
      streak: local.stats.streak,
      bestStreak: Math.max(local.stats.bestStreak, remote.stats?.bestStreak ?? 0),
      quizzesTaken: Math.max(
        local.stats.quizzesTaken,
        remote.stats?.quizzesTaken ?? 0,
      ),
      quizzesPassed: Math.max(
        local.stats.quizzesPassed,
        remote.stats?.quizzesPassed ?? 0,
      ),
      questionsCorrect: Math.max(
        local.stats.questionsCorrect,
        remote.stats?.questionsCorrect ?? 0,
      ),
    },
    tutorialSeen: local.tutorialSeen || Boolean(remote.tutorialSeen),
  };
}
