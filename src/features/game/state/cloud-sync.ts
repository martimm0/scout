"use client";

import { useEffect, useRef } from "react";

import { useGameStore, type GameState } from "./game-store";

/**
 * Autosave and resume.
 *
 * Saves are debounced rather than fired per event. The docs list seven "major
 * events" that should trigger a save (plant discovered, pollinated, area
 * unlocked, badge earned, journal entry unlocked, pollinator customised, session
 * end) — but pollinating one flower fires four of those at once, and posting four
 * near-identical documents in the same tick is just noise. Watching the state and
 * writing 1.5s after it settles covers every one of them and cannot miss a new
 * event type somebody adds later.
 */

const DEBOUNCE_MS = 1500;

export type CloudStatus =
  | "local"
  | "loading"
  | "synced"
  | "saving"
  | "error";

function toSaved(state: GameState) {
  return {
    pollinator: state.pollinator,
    discoveredPlants: state.discoveredPlants,
    discoveredFungi: state.discoveredFungi,
    unlockedParks: state.unlockedParks,
    quizPassed: state.quizPassed,
    seenPhases: state.seenPhases,
    seenSeasons: state.seenSeasons,
    pollinatedPlants: state.pollinatedPlants,
    unlockedMapAreas: state.unlockedMapAreas,
    unlockedBadges: state.unlockedBadges,
    unlockedJournalEntries: state.unlockedJournalEntries,
    stats: state.stats,
    tutorialSeen: state.tutorialSeen,
    savedAt: Date.now(),
  };
}

/**
 * Merge a cloud save into the local store.
 *
 * Progress is monotonic — you never un-discover a plant — so the merge is a
 * union rather than a replacement. That means a player who played signed-out on
 * this machine and then signs in keeps both halves of what they did, instead of
 * watching the server overwrite their afternoon.
 *
 * Exported so the suite can put a hostile save in front of the real function. The
 * first attempt at that test drove the UI instead, and passed against the bug: no
 * page it could reach mounts the sync, so no merge ever ran and it was really only
 * asserting that localStorage still said what the test had written into it.
 */
export function mergeInto(
  local: GameState,
  remote: Awaited<ReturnType<typeof toSaved>>,
) {
  /**
   * A genuinely monotonic union: OR, not spread.
   *
   * `{ ...a, ...b }` is the obvious way to write this and it is not a union, it is
   * "b wins". Every key in these records is only ever set to true by the game, so
   * the two behave identically in practice, which is what makes the difference easy
   * to miss. But `/api/progress` stores whatever JSON it is handed, so a row
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
    pollinatedPlants: union(local.pollinatedPlants, remote.pollinatedPlants),
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

/**
 * Keeps the store and the server in step. A no-op when the player is signed out
 * or cloud saves aren't configured — in which case localStorage is still doing
 * its job and nothing is lost.
 */
export function useCloudSync(
  signedIn: boolean,
  onStatus?: (status: CloudStatus) => void,
) {
  const loaded = useRef(false);
  const timer = useRef<number | null>(null);

  // Resume.
  useEffect(() => {
    if (!signedIn || loaded.current) {
      return;
    }

    loaded.current = true;
    onStatus?.("loading");

    // What the bee looked like when the request went out.
    const before = useGameStore.getState().pollinator;

    void (async () => {
      try {
        const response = await fetch("/api/progress");

        if (response.status === 501) {
          // Cloud saves aren't configured. Stay local, say so, don't panic.
          onStatus?.("local");

          return;
        }

        if (!response.ok) {
          onStatus?.("error");

          return;
        }

        const { progress } = await response.json();

        if (progress) {
          useGameStore.setState((state) => {
            const merged = mergeInto(state, progress);

            /**
             * Do not overwrite a bee the player has changed while we were asking.
             *
             * Progress is monotonic, so a union is always right for it: you never
             * un-discover a plant, and it does not matter who wins. The pollinator
             * is not. It is a value that gets replaced, and the remote wins the
             * merge, so a player who landed on the customize page and picked
             * butterfly before this request came back would watch it silently
             * turn into whatever the server had. The load was already in flight;
             * their click is newer than it.
             */
            return state.pollinator === before
              ? merged
              : { ...merged, pollinator: state.pollinator };
          });
        }

        onStatus?.("synced");
      } catch {
        onStatus?.("error");
      }
    })();
  }, [signedIn, onStatus]);

  // Autosave.
  useEffect(() => {
    if (!signedIn) {
      return;
    }

    const flush = () => {
      onStatus?.("saving");

      void fetch("/api/progress", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(toSaved(useGameStore.getState())),
      })
        .then((response) => onStatus?.(response.ok ? "synced" : "error"))
        .catch(() => onStatus?.("error"));
    };

    const unsubscribe = useGameStore.subscribe(() => {
      if (timer.current !== null) {
        window.clearTimeout(timer.current);
      }

      timer.current = window.setTimeout(flush, DEBOUNCE_MS);
    });

    // Session end. `visibilitychange` rather than `beforeunload` — the latter is
    // unreliable on mobile and increasingly ignored, and this fires when the tab
    // is backgrounded too, which is when most people actually leave.
    const onHide = () => {
      if (document.visibilityState === "hidden") {
        navigator.sendBeacon?.(
          "/api/progress",
          new Blob([JSON.stringify(toSaved(useGameStore.getState()))], {
            type: "application/json",
          }),
        );
      }
    };

    document.addEventListener("visibilitychange", onHide);

    return () => {
      unsubscribe();
      document.removeEventListener("visibilitychange", onHide);

      if (timer.current !== null) {
        window.clearTimeout(timer.current);
      }
    };
  }, [signedIn, onStatus]);
}
