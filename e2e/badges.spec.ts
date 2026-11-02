import { expect, test } from "@playwright/test";

import { BADGES } from "../src/features/game/data/badges";
import { CONCEPTS } from "../src/features/game/data/journal";
import { useGameStore } from "../src/features/game/state/game-store";

/** What a badge says it is for, against what it checks. */

const earned = (id: string, entries: Record<string, boolean>) =>
  BADGES.find((badge) => badge.id === id)!.earned({
    ...useGameStore.getState(),
    unlockedJournalEntries: entries,
  });

test("Ecologist waits for every ecology concept", () => {
  /**
   * It checked for nine, which was every concept when it was written. Setting
   * seed and the waggle dance came after, so it said "you unlocked every
   * ecology concept" with two rows still locked in the journal's Ecology tab.
   */
  const all = Object.fromEntries(
    CONCEPTS.map((concept) => [`concept:${concept.id}`, true]),
  );

  expect(earned("ecologist", all), "every concept, and no badge").toBe(true);

  for (const concept of CONCEPTS) {
    const missing = { ...all, [`concept:${concept.id}`]: false };

    expect(
      earned("ecologist", missing),
      `awarded with ${concept.id} still locked`,
    ).toBe(false);
  }
});
