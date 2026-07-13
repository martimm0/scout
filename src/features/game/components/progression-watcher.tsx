"use client";

import { useEffect } from "react";

import { trackEvent } from "@/lib/analytics";
import { playSound } from "../audio/sound";
import { BADGES_BY_ID, evaluateBadges } from "../data/badges";
import { useGameStore } from "../state/game-store";
import { evaluateJournal } from "../state/progression";
import styles from "./progression-watcher.module.css";

/**
 * Watches the store and awards what the player has earned.
 *
 * Everything unlockable is a pure function of game state, so this can simply
 * re-evaluate on every change rather than having each gameplay event remember to
 * fire its own unlocks. Add a badge to the data file and it starts working; no
 * call site has to know it exists.
 */
export function ProgressionWatcher() {
  const pendingBadges = useGameStore((state) => state.pendingBadges);
  const dismissBadge = useGameStore((state) => state.dismissBadge);

  useEffect(() => {
    const evaluate = () => {
      const state = useGameStore.getState();

      const journal = evaluateJournal(state);

      for (const entry of journal) {
        state.unlockJournalEntry(entry);
      }

      // Badges are evaluated after journal unlocks, because some badges are
      // about the journal — otherwise "Well Read" would always be one entry
      // behind the thing that earned it.
      const badges = evaluateBadges(useGameStore.getState());

      if (badges.length > 0) {
        state.queueBadges(badges);
        playSound("badge");

        for (const badge of badges) {
          trackEvent({ name: "badge_earned", badge });
        }
      }
    };

    evaluate();

    return useGameStore.subscribe(evaluate);
  }, []);

  // Announce one at a time, oldest first, so five at once doesn't become a wall.
  const badge = pendingBadges[0]
    ? BADGES_BY_ID.get(pendingBadges[0])
    : undefined;

  useEffect(() => {
    if (!badge) {
      return;
    }

    const timer = window.setTimeout(() => dismissBadge(badge.id), 4200);

    return () => window.clearTimeout(timer);
  }, [badge, dismissBadge]);

  if (!badge) {
    return null;
  }

  return (
    <aside aria-live="polite" className={styles.toast}>
      <span className={styles.icon} aria-hidden>
        ✦
      </span>
      <div>
        <p className={styles.label}>Badge earned</p>
        <p className={styles.name}>{badge.name}</p>
        <p className={styles.description}>{badge.description}</p>
      </div>
    </aside>
  );
}
