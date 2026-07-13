import type { GameState } from "../state/game-store";
import { PLANTS } from "./plants";

/**
 * Badges.
 *
 * Non-competitive by design: there is no leaderboard and there never will be.
 * Nothing here is scored against another player, and nothing is timed. They mark
 * what you've seen and what you've learned, and a few of them reward simply
 * being curious.
 */

export type Badge = {
  id: string;
  name: string;
  /** Shown once earned. */
  description: string;
  /** Shown while locked — intriguing, but not a walkthrough. */
  hint: string;
  earned: (state: GameState) => boolean;
};

const count = (record: Record<string, boolean>) =>
  Object.values(record).filter(Boolean).length;

export const BADGES: Badge[] = [
  {
    id: "first-flight",
    name: "First Flight",
    description: "You left the lawn and went looking.",
    hint: "Go somewhere.",
    earned: (state) => count(state.unlockedMapAreas) >= 2,
  },
  {
    id: "first-bloom",
    name: "First Bloom",
    description: "Your first successful pollination.",
    hint: "Pollinate anything at all.",
    earned: (state) => count(state.pollinatedPlants) >= 1,
  },
  {
    id: "ten-pollinated",
    name: "Ten Plants Pollinated",
    description: "Ten flowers will set seed because of you.",
    hint: "Keep going. Ten of them.",
    earned: (state) => count(state.pollinatedPlants) >= 10,
  },
  {
    id: "frick-park-explorer",
    name: "Frick Park Explorer",
    description: "You have flown every corner of the park.",
    hint: "Visit all six areas.",
    earned: (state) => count(state.unlockedMapAreas) >= 6,
  },
  {
    id: "blue-slide-visitor",
    name: "Blue Slide Visitor",
    description: "You found the most famous thing in the park.",
    hint: "Somewhere out east there's a hill that isn't a hill.",
    earned: (state) => Boolean(state.unlockedMapAreas["blue-slide"]),
  },
  {
    id: "creekside-visitor",
    name: "Creekside Visitor",
    description: "You followed Nine Mile Run through the valley.",
    hint: "Follow the water down.",
    earned: (state) => Boolean(state.unlockedMapAreas["nine-mile-run"]),
  },
  {
    id: "fern-hollow-wanderer",
    name: "Fern Hollow Wanderer",
    description: "You went into the deep shade and came back out.",
    hint: "There's a darker wood than the one you know.",
    earned: (state) => Boolean(state.unlockedMapAreas["fern-hollow"]),
  },
  {
    id: "native-plant-friend",
    name: "Native Plant Friend",
    description: "You have found every native plant in the park.",
    hint: "Find all sixteen.",
    earned: (state) => count(state.discoveredPlants) >= PLANTS.length,
  },
  {
    id: "meadow-scout",
    name: "Meadow Scout",
    description: "Five plants discovered.",
    hint: "Discovery is just getting close enough to look.",
    earned: (state) => count(state.discoveredPlants) >= 5,
  },
  {
    id: "steady-wings",
    name: "Steady Wings",
    description: "Five successful pollinations in a row.",
    hint: "String some good visits together.",
    earned: (state) => state.stats.bestStreak >= 5,
  },
  {
    id: "persistent",
    name: "Persistent",
    description:
      "You kept going after a failed visit. Most of pollinating is trying again.",
    hint: "Fail, and don't stop.",
    earned: (state) =>
      state.stats.pollinationAttempts - state.stats.pollinationSuccesses >= 1 &&
      state.stats.pollinationSuccesses >= 3,
  },
  {
    id: "well-read",
    name: "Well Read",
    description: "Fifteen journal entries unlocked.",
    hint: "The journal fills itself as you learn.",
    earned: (state) => count(state.unlockedJournalEntries) >= 15,
  },
  {
    id: "ecologist",
    name: "Ecologist",
    description: "You unlocked every ecology concept.",
    hint: "There is more to learn than the names of flowers.",
    earned: (state) =>
      Object.keys(state.unlockedJournalEntries).filter(
        (key) => key.startsWith("concept:") && state.unlockedJournalEntries[key],
      ).length >= 7,
  },
];

export const BADGES_BY_ID = new Map(BADGES.map((badge) => [badge.id, badge]));

/** Every badge whose condition is met but which isn't yet unlocked. */
export function evaluateBadges(state: GameState): string[] {
  return BADGES.filter(
    (badge) => !state.unlockedBadges[badge.id] && badge.earned(state),
  ).map((badge) => badge.id);
}
