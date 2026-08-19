/**
 * Pollination: the verb the game is named for.
 *
 * Three light minigames, chosen per plant so a species always plays the same way
 * and you learn its rhythm. Roughly one VISIT in five comes to nothing, and
 * failure is never the player being bad at a game. It's weather, timing, or a
 * flower that someone else got to first. That's what pollinating is actually
 * like.
 *
 * That one in five is now split across two places: a flower somebody else is
 * already on, which you can see before you land, and the roll at the end of a
 * minigame. `VISIT_FAILURE_RATE` below is the number the game promises, and
 * `BASE_FAILURE_RATE` is derived from it rather than typed in beside it.
 */

import { OCCUPIED_FRACTION } from "../world/foragers";
import { ANAGRAM_WORDS } from "./anagram-words";
import type { Plant, PlantArchetype } from "./plants";

/**
 * The games.
 *
 * Every one of them must meet the same curve, and this is not a style note. The
 * score feeds one resolver, so a game whose ceiling cannot be reached would make
 * its archetype permanently harder to pollinate than the others, invisibly, and
 * nobody would ever see why.
 *
 *   no play         0.0
 *   flailing        about 0.35
 *   competent       about 0.75
 *   excellent       1.0, and genuinely REACHABLE
 *
 * The last line is the one that bites. The three games this replaced all had
 * ceilings any awake player hit, which sounds like the opposite problem and is
 * the same one: everybody scored 1.0, so the resolver's 8% floor became the real
 * failure rate and the "one visit in five" the game is built on was never true.
 * A test plays each game optimally and asserts it can be maxed.
 */
export type MinigameKind = "memory" | "seeds" | "anagram";

/**
 * Which game each archetype plays. Learnable, not random.
 *
 * Typed against `PlantArchetype` rather than `string`, so adding an archetype is
 * a compile error here rather than a silent fallback to whatever the `??` said.
 */
export const MINIGAME_FOR_ARCHETYPE: Record<PlantArchetype, MinigameKind> = {
  // Dozens of tiny florets up a stalk, and a dome of them: keep track of which
  // you have already worked.
  spike: "memory",
  umbel: "memory",
  // Woody things drop things on you.
  shrub: "seeds",
  tree: "seeds",
  // Big open flowers you can take your time over.
  daisy: "anagram",
  low: "anagram",
};

/**
 * Which game this plant actually plays.
 *
 * Almost always the archetype's game. The exception is the anagram, which needs a
 * name that can make words: `ANAGRAM_WORDS` only has an entry for a plant whose
 * name clears the bar, so pawpaw (three distinct letters, makes "PAPA"),
 * jewelweed, heal-all and joe-pye-weed fall back rather than shipping a game that
 * cannot be won. Use this, never the map directly.
 */
export function minigameFor(plant: Plant): MinigameKind {
  const kind = MINIGAME_FOR_ARCHETYPE[plant.archetype];

  if (kind === "anagram" && !ANAGRAM_WORDS[plant.id]) {
    return "memory";
  }

  return kind;
}

/**
 * The failure rate AT THE MINIGAME. Not the whole story any more.
 *
 * One flower visit in five comes to nothing, and that number is now shared
 * between two places. A slice of it happens before you ever start a game: some
 * flowers have another insect on them, you can see that from outside, and
 * landing on one is a visit that came to nothing. See `world/foragers.ts`.
 *
 * So this is what is left over, and it is derived rather than typed in:
 *
 *   OCCUPIED_FRACTION + (1 - OCCUPIED_FRACTION) x BASE_FAILURE_RATE = 0.2
 *
 * Deriving it matters. Leaving this at 0.2 while adding a second way to fail
 * would have quietly pushed real visit failure to about one in four, and the
 * game would be making a claim its own mechanics did not honour, which is
 * precisely the bug the pollination minigames already had once. Rule 3 is only
 * worth anything if the arithmetic behind it is actually true.
 */
export const VISIT_FAILURE_RATE = 0.2;

export const BASE_FAILURE_RATE =
  (VISIT_FAILURE_RATE - OCCUPIED_FRACTION) / (1 - OCCUPIED_FRACTION);

/**
 * Messages for a failed attempt.
 *
 * These carry the whole tone of the game. Every one of them is a fact about
 * pollination, and none of them says you did badly. A bee that misses a flower
 * hasn't failed at anything: it just flies to the next one.
 */
export const FAILURE_MESSAGES = [
  "Too windy this time. The pollen blew right off you.",
  "This flower was already visited. Its pollen is spent.",
  "You missed the pollen window. Some flowers only release for an hour a day.",
  "Wrong angle. Try hovering closer to the centre.",
  "The anthers hadn't opened yet. Come back when the sun's higher.",
  "Rain last night washed the pollen away.",
] as const;

export const SUCCESS_MESSAGES = [
  "Pollen all over you. Carry it to the next one.",
  "A clean visit. The flower will set seed because of you.",
  "Loaded up. That's how a meadow keeps going.",
  "Dusted head to leg. Good work.",
] as const;

export type MinigameSpec = {
  kind: MinigameKind;
  /** Seconds the game runs before it resolves. */
  duration: number;
  /** What the player is told to do, in one line. */
  instruction: string;
};

export const MINIGAME_SPEC: Record<MinigameKind, MinigameSpec> = {
  memory: {
    kind: "memory",
    duration: 12,
    instruction: "Match the florets in pairs. Remember where you have been.",
  },
  seeds: {
    kind: "seeds",
    duration: 12,
    instruction: "Work the flower without getting hit. Arrows, or the pointer.",
  },
  anagram: {
    kind: "anagram",
    duration: 16,
    instruction: "Make three words from the flower's name. Four letters or more.",
  },
};

/**
 * Resolve an attempt.
 *
 * `performance` is 0–1 from the minigame. Playing well cuts the failure rate but
 * never to zero: a bee at the top of its game still gets rained on. Playing
 * badly raises it but never to certainty, so nobody gets stuck.
 */
export function resolvePollination(performance: number, roll: number) {
  const skillBonus = (performance - 0.5) * 0.24;
  const failureChance = Math.min(
    0.42,
    Math.max(0.06, BASE_FAILURE_RATE - skillBonus),
  );

  return roll >= failureChance;
}

export function pickMessage(messages: readonly string[], roll: number) {
  return messages[Math.floor(roll * messages.length) % messages.length];
}
