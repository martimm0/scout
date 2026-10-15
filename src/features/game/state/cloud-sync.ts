"use client";

import { useEffect, useRef } from "react";

import { useGameStore, type GameState } from "./game-store";
import { mergeInto } from "./merge";

// Where the suite has always imported it from.
export { mergeInto };

/**
 * Autosave and resume.
 *
 * Saves are debounced rather than fired per event. The docs list seven "major
 * events" that should trigger a save (plant discovered, pollinated, area
 * unlocked, badge earned, journal entry unlocked, pollinator customised, session
 * end), but pollinating one flower fires four of those at once, and posting four
 * near-identical documents in the same tick is just noise. Watching the state and
 * writing 1.5s after it settles covers every one of them and cannot miss a new
 * event type somebody adds later.
 */

const DEBOUNCE_MS = 1500;

/**
 * How long to wait before pulling again after a pull failed, by attempt; the
 * last one repeats. Nothing is pushed until a pull has succeeded, so a single
 * failure must not be the end of saving for the session.
 */
const RETRY_MS = [2000, 5000, 15_000, 30_000, 60_000];

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
    seenWeather: state.seenWeather,
    winterKnown: state.winterKnown,
    pollinatedPlants: state.pollinatedPlants,
    seedlings: state.seedlings,
    marks: state.marks,
    unlockedMapAreas: state.unlockedMapAreas,
    unlockedBadges: state.unlockedBadges,
    unlockedJournalEntries: state.unlockedJournalEntries,
    stats: state.stats,
    tutorialSeen: state.tutorialSeen,
    // Declared, so the route can refuse a save that is not the session's own.
    owner: state.owner,
    // Declared, so the route can refuse a save from before an admin reset.
    resetAt: state.resetAt,
    savedAt: Date.now(),
  };
}

/**
 * Keeps the store and the server in step. A no-op when the player is signed out
 * or cloud saves aren't configured, in which case localStorage is still doing
 * its job and nothing is lost.
 */
export function useCloudSync(
  userId: string | null,
  onStatus?: (status: CloudStatus) => void,
) {
  const loaded = useRef(false);
  const timer = useRef<number | null>(null);
  /**
   * Whether this session's copy has been reconciled with the server's.
   *
   * Nothing is pushed until it has. Autosave used to start the moment the page
   * mounted, before the sign-in pull had merged anything, so the first change
   * could send a save the server had never been asked about: a stale device
   * pushing over progress another device had made, or, once a foreign save had
   * been cleared below, an empty one over the account's real save.
   */
  const reconciled = useRef(false);
  /**
   * Pull again: after a failed pull, and when the route refuses a push.
   *
   * The pull used to be made exactly once. Since pushes wait for it, one
   * failed request (a cold database, a dropped connection) left the page
   * saving nothing to the account for the rest of the session.
   */
  const pullAgain = useRef<(() => void) | null>(null);
  const retryTimer = useRef<number | null>(null);
  const mounted = useRef(false);

  useEffect(() => {
    mounted.current = true;

    return () => {
      mounted.current = false;

      if (retryTimer.current !== null) {
        window.clearTimeout(retryTimer.current);
        retryTimer.current = null;
      }
    };
  }, []);

  // Resume.
  useEffect(() => {
    if (!userId || loaded.current) {
      return;
    }

    loaded.current = true;

    let failures = 0;
    let pulling = false;

    const pull = async () => {
      if (pulling) {
        return;
      }

      pulling = true;
      reconciled.current = false;
      onStatus?.("loading");

      /**
       * Somebody else's save is not ours to merge.
       *
       * The union below exists so a player keeps progress they made on this
       * device that never reached the server. It cannot tell that apart from
       * progress a previous player left on a shared computer, so it used to
       * pour one account into the next. A save another account has claimed is
       * forgotten before the pull; one nobody has claimed (every save written
       * before owners existed) is adopted, which is the right call for the
       * overwhelming majority, whose device is their own.
       */
      const local = useGameStore.getState();

      if (local.owner && local.owner !== userId) {
        local.forgetLocalSave();
      }

      // What the bee looked like when the request went out.
      const before = useGameStore.getState().pollinator;

      try {
        const response = await fetch("/api/progress");

        if (response.status === 501) {
          // Cloud saves aren't configured. Stay local, say so, don't panic.
          onStatus?.("local");

          return;
        }

        if (!response.ok) {
          throw new Error(`pull ${response.status}`);
        }

        const { progress, resetAt } = (await response.json()) as {
          progress: Parameters<typeof mergeInto>[1] | null;
          resetAt?: number;
        };
        const accountReset = Number(resetAt) || 0;

        /**
         * The admin reset this account after this device's copy was made, so
         * that copy is exactly what the player asked to be rid of. Merging it
         * would put it all back.
         */
        if (accountReset > useGameStore.getState().resetAt) {
          useGameStore.getState().forgetLocalSave();
          useGameStore.setState({ resetAt: accountReset });
        }

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

        // Only now, with the server's copy merged in, is this save the account's.
        useGameStore.getState().claimLocalSave(userId);
        reconciled.current = true;
        failures = 0;

        onStatus?.("synced");
      } catch {
        onStatus?.("error");

        if (mounted.current) {
          const delay = RETRY_MS[Math.min(failures, RETRY_MS.length - 1)];

          failures += 1;
          retryTimer.current = window.setTimeout(() => {
            retryTimer.current = null;
            void pull();
          }, delay);
        }
      } finally {
        pulling = false;
      }
    };

    pullAgain.current = () => void pull();
    void pull();
  }, [userId, onStatus]);

  // Autosave.
  useEffect(() => {
    if (!userId) {
      return;
    }

    /**
     * Pushed only once reconciled, and only if the save is this account's.
     *
     * The second half is what stops a tab left open on a shared computer: its
     * memory still holds the last player's save, and if somebody else has
     * signed in since, the cookie it would send is theirs. The route refuses a
     * declared owner that disagrees with the session as well, so this is the
     * client being polite and the server being sure.
     */
    const mine = () =>
      reconciled.current && useGameStore.getState().owner === userId;

    const flush = () => {
      if (!mine()) {
        return;
      }

      onStatus?.("saving");

      void fetch("/api/progress", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(toSaved(useGameStore.getState())),
      })
        .then((response) => {
          // Refused as somebody else's or as from before a reset: this copy
          // is not the account's any more, so find out what is.
          if (response.status === 409) {
            reconciled.current = false;
            pullAgain.current?.();

            return;
          }

          onStatus?.(response.ok ? "synced" : "error");
        })
        .catch(() => onStatus?.("error"));
    };

    const unsubscribe = useGameStore.subscribe(() => {
      if (timer.current !== null) {
        window.clearTimeout(timer.current);
      }

      timer.current = window.setTimeout(flush, DEBOUNCE_MS);
    });

    // Session end. `visibilitychange` rather than `beforeunload`, the latter is
    // unreliable on mobile and increasingly ignored, and this fires when the tab
    // is backgrounded too, which is when most people actually leave.
    const onHide = () => {
      if (document.visibilityState === "hidden" && mine()) {
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
  }, [userId, onStatus]);
}
