/**
 * Pollination: the verb the game is named for.
 *
 * Three light minigames, chosen per plant so a species always plays the same way
 * and you learn its rhythm. Roughly one attempt in five fails — and failure is
 * never the player being bad at a game. It's weather, timing, or a flower that
 * someone else got to first. That's what pollinating is actually like.
 */

import type { PlantArchetype } from "./plants";

export type MinigameKind = "hover" | "taps" | "cue";

/**
 * Which game each archetype plays. Learnable, not random.
 *
 * Typed against `PlantArchetype` rather than `string`, so adding an archetype is
 * a compile error here rather than a silent fallback to whatever the `??` said.
 */
export const MINIGAME_FOR_ARCHETYPE: Record<PlantArchetype, MinigameKind> = {
  // Big open landing pads — settle on them and hold still.
  daisy: "hover",
  // Dozens of tiny florets up a stalk. Work them one at a time.
  spike: "taps",
  // A dome of florets; follow the ones that open.
  umbel: "cue",
  // Low woodland flowers you have to hold yourself over.
  low: "hover",
  // A whole shrub of tiny blooms to work through.
  shrub: "taps",
  // A tree in flower — follow the blossoms.
  tree: "cue",
};

/**
 * The failure rate. Deliberately about one in five: often enough that success
 * means something, rare enough that it never feels like the game is stonewalling
 * you. Skill shifts it — playing the minigame well earns a bonus below.
 */
export const BASE_FAILURE_RATE = 0.2;

/**
 * Messages for a failed attempt.
 *
 * These carry the whole tone of the game. Every one of them is a fact about
 * pollination, and none of them says you did badly. A bee that misses a flower
 * hasn't failed at anything — it just flies to the next one.
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
  hover: {
    kind: "hover",
    duration: 4,
    instruction: "Hold the bee steady inside the ring.",
  },
  taps: {
    kind: "taps",
    duration: 5,
    instruction: "Tap Space to work each floret.",
  },
  cue: {
    kind: "cue",
    duration: 6,
    instruction: "Press the arrow the open flower points to.",
  },
};

/**
 * Resolve an attempt.
 *
 * `performance` is 0–1 from the minigame. Playing well cuts the failure rate but
 * never to zero — a bee at the top of its game still gets rained on. Playing
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
