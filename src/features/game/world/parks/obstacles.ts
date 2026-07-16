import type { ParkId } from "../park";
import { FRICK } from "./frick";
import { HIGHLAND } from "./highland";
import { SCHENLEY } from "./schenley";

/**
 * The solid furniture of each park.
 *
 * A box on the ground, or a box hanging in the air. The second kind matters: a
 * bridge deck has to sit at an absolute height so you can fly UNDER it, which is
 * most of the point of a bridge when you are a centimetre long and it is a
 * hundred feet over your head.
 */
export type Obstacle = {
  at: [number, number];
  width: number;
  height: number;
  depth: number;
  /** Sink or raise the box relative to the ground under it. */
  lift?: number;
  /** Absolute [minY, maxY]. Use for anything that hangs rather than sits. */
  absolute?: [number, number];
};

const frick = FRICK.landmarks;
const schenley = SCHENLEY.landmarks;
const highland = HIGHLAND.landmarks;

const FRICK_OBSTACLES: Obstacle[] = [
  // The Environmental Center. The building body (76 x 46), not the roof
  // overhang: an overhang you cannot fly under is not an overhang.
  { at: frick.center, width: 76, height: 28, depth: 46 },
  // The gatehouse: two piers with a gap between them you can fly through, so it
  // is two boxes rather than one, which would wall it off.
  {
    at: [frick.gatehouse[0] - 26, frick.gatehouse[1]],
    width: 18,
    height: 46,
    depth: 18,
  },
  {
    at: [frick.gatehouse[0] + 26, frick.gatehouse[1]],
    width: 18,
    height: 46,
    depth: 18,
  },
  { at: frick.blueSlide, width: 64, height: 38, depth: 100 },
  // The bowling green clubhouse. The green itself is flat, so no collider.
  {
    at: [frick.bowlingGreen[0], frick.bowlingGreen[1] - 74],
    width: 34,
    height: 24,
    depth: 22,
  },
  // The tennis court fence. A wall, from here.
  { at: frick.tennisCourts, width: 80, height: 20, depth: 112 },
  { at: frick.pavilion, width: 72, height: 32, depth: 56 },
  { at: frick.culvert, width: 32, height: 20, depth: 16, lift: -4 },
  // The Fern Hollow Bridge deck, hanging over the hollow.
  {
    at: frick.fernHollowBridge,
    width: 304,
    height: 0,
    depth: 48,
    absolute: [84, 112],
  },
  // And its piers.
  ...[-96, -32, 32, 96].map(
    (offset): Obstacle => ({
      at: [frick.fernHollowBridge[0] + offset, frick.fernHollowBridge[1]],
      width: 18,
      height: 0,
      depth: 24,
      absolute: [-100, 92],
    }),
  ),
];

const SCHENLEY_OBSTACLES: Obstacle[] = [
  // Phipps: a very large amount of glass. Three linked houses rather than one
  // block, because the real thing is a spine with wings off it and a bee should
  // be able to get between them.
  { at: [schenley.phipps[0] - 34, schenley.phipps[1]], width: 46, height: 40, depth: 54 },
  { at: schenley.phipps, width: 40, height: 52, depth: 40 },
  { at: [schenley.phipps[0] + 34, schenley.phipps[1]], width: 46, height: 36, depth: 54 },

  // The flagpole on Flagstaff Hill. Thin, and taller than anything near it.
  { at: schenley.flagpole, width: 5, height: 70, depth: 5 },

  // The Panther Hollow Bridge. Schenley Drive, carried clean over the hollow.
  // Absolute height, because flying beneath it up the length of the hollow is
  // the single best thing in this park.
  {
    at: schenley.pantherHollowBridge,
    width: 260,
    height: 0,
    depth: 44,
    absolute: [92, 118],
  },
  // Its abutments, dropping the whole way to the floor of the hollow.
  ...[-112, 112].map(
    (offset): Obstacle => ({
      at: [
        schenley.pantherHollowBridge[0] + offset,
        schenley.pantherHollowBridge[1],
      ],
      width: 26,
      height: 0,
      depth: 30,
      absolute: [-120, 100],
    }),
  ),
  // The four bronze panthers, one on each corner. At this scale they are the
  // size of houses, and they are solid, and they are the reason to come.
  ...[
    [-104, -26],
    [-104, 26],
    [104, -26],
    [104, 26],
  ].map(
    ([dx, dz]): Obstacle => ({
      at: [
        schenley.pantherHollowBridge[0] + dx,
        schenley.pantherHollowBridge[1] + dz,
      ],
      width: 16,
      height: 0,
      depth: 26,
      absolute: [118, 140],
    }),
  ),

  // The boathouse at Panther Hollow Lake.
  { at: schenley.boathouse, width: 44, height: 22, depth: 30 },
  // The Oval: a running track inside a fence.
  { at: schenley.oval, width: 150, height: 14, depth: 96 },
  // The Westinghouse Memorial: a curved bronze wall around a still pond. Two
  // panels with a gap, so you can fly into the middle of it, which is the only
  // way to read what is written there.
  {
    at: [schenley.westinghouseMemorial[0] - 30, schenley.westinghouseMemorial[1] - 22],
    width: 20,
    height: 26,
    depth: 44,
  },
  {
    at: [schenley.westinghouseMemorial[0] + 30, schenley.westinghouseMemorial[1] - 22],
    width: 20,
    height: 26,
    depth: 44,
  },
  { at: schenley.visitorCenter, width: 54, height: 26, depth: 38 },
  { at: schenley.andersonPlayground, width: 60, height: 20, depth: 44 },
];

/**
 * Highland's furniture.
 *
 * The reservoirs are deliberately NOT walled off with a collider ring. The
 * terrain already raises the embankment, so the wall is real ground and the bee
 * has to climb it, which is the experience: you come over the top and there is a
 * lake. A box ring on top of that would be an invisible wall in the air above a
 * hill that is already there.
 */
const HIGHLAND_OBSTACLES: Obstacle[] = [
  // The gate piers, with the gap between them you can fly through.
  { at: [highland.gates[0] - 34, highland.gates[1]], width: 20, height: 48, depth: 20 },
  { at: [highland.gates[0] + 34, highland.gates[1]], width: 20, height: 48, depth: 20 },
  { at: highland.pumpHouse, width: 42, height: 26, depth: 32 },
  // The pool bath house. The water itself is flat, so no collider.
  { at: [highland.pool[0] - 70, highland.pool[1]], width: 32, height: 22, depth: 48 },
  // The zoo: a fence, and a very large cage.
  { at: [highland.zoo[0] - 30, highland.zoo[1]], width: 58, height: 42, depth: 58 },
  { at: [highland.zoo[0], highland.zoo[1] - 60], width: 182, height: 18, depth: 5 },
  { at: [highland.zoo[0] + 40, highland.zoo[1] + 20], width: 52, height: 30, depth: 42 },
  { at: highland.superPlayground, width: 60, height: 20, depth: 44 },
  { at: highland.slopeShelter, width: 72, height: 32, depth: 56 },
  // The fountain plinth, in the middle of its basin.
  { at: highland.fountain, width: 24, height: 46, depth: 24 },
];

export const OBSTACLES_BY_PARK: Record<ParkId, Obstacle[]> = {
  frick: FRICK_OBSTACLES,
  schenley: SCHENLEY_OBSTACLES,
  highland: HIGHLAND_OBSTACLES,
};
