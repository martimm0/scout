import type { GameState } from "./game-store";

/**
 * Which gameplay events teach which ecology concept.
 *
 * Two of them: mutualism and pollination failure, are unlocked directly by the
 * store at the moment they happen, because they're taught by the act itself. The
 * rest are earned by accumulating enough of the park to have noticed the pattern.
 */

const count = (record: Record<string, boolean>) =>
  Object.values(record).filter(Boolean).length;

type ConceptRule = {
  id: string;
  earned: (state: GameState) => boolean;
};

const CONCEPT_RULES: ConceptRule[] = [
  {
    id: "native-plants",
    earned: (state) => count(state.discoveredPlants) >= 4,
  },
  {
    id: "bloom-windows",
    // You've seen enough flowers to notice they don't all bloom at once.
    earned: (state) => count(state.discoveredPlants) >= 8,
  },
  {
    id: "habitat-corridors",
    // Learned by flying the creek, which is the corridor.
    earned: (state) => Boolean(state.unlockedMapAreas["nine-mile-run"]),
  },
  {
    id: "invasive-species",
    earned: (state) => count(state.unlockedMapAreas) >= 3,
  },
  {
    id: "seasonal-cycles",
    earned: (state) => count(state.pollinatedPlants) >= 5,
  },
  {
    // Found a fungus. They are neither plant nor animal, and that is the lesson.
    id: "fungi",
    earned: (state) => count(state.discoveredFungi) >= 1,
  },
  {
    // Learned by being out at more than one hour and seeing what changes.
    id: "day-and-night",
    earned: (state) => count(state.seenPhases) >= 3,
  },
];

/** Journal entries that should exist but aren't yet unlocked. */
export function evaluateJournal(state: GameState): string[] {
  const pending: string[] = [];

  // Flying a species is how you learn about it. Switch to the hoverfly and its
  // journal entry opens; the others stay shut until you've been one.
  const flown = `pollinator:${state.pollinator.type}`;

  if (!state.unlockedJournalEntries[flown]) {
    pending.push(flown);
  }

  for (const rule of CONCEPT_RULES) {
    const key = `concept:${rule.id}`;

    if (!state.unlockedJournalEntries[key] && rule.earned(state)) {
      pending.push(key);
    }
  }

  return pending;
}
