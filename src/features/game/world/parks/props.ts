import type { LandmarkKind } from "../../models/landmarks";
import type { ParkId } from "../park";
import { FRICK } from "./frick";
import { SCHENLEY } from "./schenley";

/**
 * Where each park's furniture stands.
 *
 * These used to be written straight into the JSX of the scene, which was fine
 * while there was one park and impossible the moment there were two. A landmark
 * is data: a kind, a place, and which way it is facing.
 */
export type Prop = {
  kind: LandmarkKind;
  at: [number, number];
  rotation?: number;
  /** How far into the ground it settles. */
  sink?: number;
  /**
   * Hang it at a fixed height instead of on the terrain under it. Bridges span
   * the hollow; they do not follow the floor of it.
   */
  hangAt?: number;
};

const f = FRICK.landmarks;
const s = SCHENLEY.landmarks;

const FRICK_PROPS: Prop[] = [
  { kind: "blueSlide", at: f.blueSlide, rotation: 0.25 },
  { kind: "environmentalCenter", at: f.center, rotation: -0.15 },
  { kind: "gatehouse", at: f.gatehouse, rotation: 0.55 },
  { kind: "bowlingGreen", at: f.bowlingGreen },
  { kind: "tennisCourts", at: f.tennisCourts, rotation: 0.1 },
  { kind: "swings", at: f.swings, rotation: -0.3 },
  { kind: "pavilion", at: f.pavilion, rotation: 0.4 },
  { kind: "stoneSteps", at: f.stoneSteps, rotation: 1.2 },
  { kind: "culvert", at: f.culvert, rotation: -1.4, sink: 4 },
  { kind: "fernHollowBridge", at: f.fernHollowBridge, rotation: 0.12, hangAt: 0 },

  // Benches and trail posts along the way, for orientation.
  { kind: "bench", at: [-190, 168], rotation: 0.4 },
  { kind: "bench", at: [150, 120], rotation: -0.7 },
  { kind: "bench", at: [232, 22], rotation: 1.2 },
  { kind: "trailPost", at: [-150, 100], rotation: 0.2 },
  { kind: "trailPost", at: [-60, -120], rotation: 1.1 },
  { kind: "trailPost", at: [120, -160], rotation: -0.4 },

  // Stepping stones across Nine Mile Run.
  { kind: "steppingStone", at: [-6, 40], rotation: 0.3, sink: 2 },
  { kind: "steppingStone", at: [14, 44], rotation: -0.2, sink: 2 },
  { kind: "steppingStone", at: [34, 48], rotation: 0.5, sink: 2 },
];

const SCHENLEY_PROPS: Prop[] = [
  { kind: "phipps", at: s.phipps, rotation: 0.08 },
  { kind: "flagpole", at: s.flagpole },
  { kind: "boathouse", at: s.boathouse, rotation: -0.4 },
  { kind: "oval", at: s.oval, rotation: 0.05 },
  { kind: "westinghouseMemorial", at: s.westinghouseMemorial, rotation: 1.6 },
  { kind: "visitorCenter", at: s.visitorCenter, rotation: -0.5 },
  { kind: "swings", at: s.andersonPlayground, rotation: 0.3 },
  { kind: "pavilion", at: [-210, 130], rotation: -0.2 },

  // The Panther Hollow Bridge, hanging over the hollow at deck height, with a
  // bronze panther crouched on each of its four corners.
  { kind: "pantherHollowBridge", at: s.pantherHollowBridge, hangAt: 0 },
  { kind: "panther", at: [s.pantherHollowBridge[0] - 104, s.pantherHollowBridge[1] - 26], rotation: 0.2, hangAt: 118 },
  { kind: "panther", at: [s.pantherHollowBridge[0] - 104, s.pantherHollowBridge[1] + 26], rotation: 2.9, hangAt: 118 },
  { kind: "panther", at: [s.pantherHollowBridge[0] + 104, s.pantherHollowBridge[1] - 26], rotation: 0.2, hangAt: 118 },
  { kind: "panther", at: [s.pantherHollowBridge[0] + 104, s.pantherHollowBridge[1] + 26], rotation: 2.9, hangAt: 118 },

  { kind: "bench", at: [-120, 60], rotation: 0.6 },
  { kind: "bench", at: [60, 140], rotation: -0.9 },
  { kind: "bench", at: [200, -40], rotation: 1.4 },
  { kind: "trailPost", at: [-40, 90], rotation: 0.3 },
  { kind: "trailPost", at: [-270, 60], rotation: -0.6 },
  { kind: "trailPost", at: [120, -180], rotation: 0.9 },
  { kind: "steppingStone", at: [-10, -60], rotation: 0.2, sink: 2 },
  { kind: "steppingStone", at: [8, -52], rotation: -0.3, sink: 2 },
];

export const PROPS_BY_PARK: Record<ParkId, Prop[]> = {
  frick: FRICK_PROPS,
  schenley: SCHENLEY_PROPS,
};
