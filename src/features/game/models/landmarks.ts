import type { BufferGeometry } from "three";

import { buildBoxGeometry, type Box } from "./voxel";

/**
 * The things that make it Frick Park and not just any wood.
 *
 * All of these are real, and at insect scale they stop being park furniture and
 * become geography: the Blue Slide is a mountainside, the gatehouse is a cliff
 * with an arch through it, a park bench is a bridge you can fly under.
 */

const STONE = "#a89e8c";
const STONE_DARK = "#8a7f6d";
const SLATE = "#6f6a60";
const TIMBER = "#8a6a44";

/**
 * The Blue Slide. Generations of Pittsburgh children have come down this on
 * flattened cardboard. It is the most recognisable object in the park, and from
 * here it is a blue concrete hillside.
 */
function blueSlide(): Box[] {
  const boxes: Box[] = [];
  const lanes = 3;
  const steps = 14;

  // The slope itself, stepped down the hill in slabs.
  for (let i = 0; i < steps; i += 1) {
    const t = i / (steps - 1);

    boxes.push({
      position: [0, 34 - t * 32, -46 + t * 92],
      size: [58, 4, 8],
      // Worn paler down the middle where everyone actually slides.
      color: i % 2 === 0 ? "#4a86c8" : "#5390d2",
    });
  }

  // The raised concrete dividers between lanes.
  for (let lane = 0; lane < lanes - 1; lane += 1) {
    const x = -10 + lane * 20;

    for (let i = 0; i < steps; i += 1) {
      const t = i / (steps - 1);
      boxes.push({
        position: [x, 37 - t * 32, -46 + t * 92],
        size: [2.4, 3, 8],
        color: "#3d70a8",
      });
    }
  }

  // Retaining wall and the run-out at the bottom.
  boxes.push({ position: [0, 33, -52], size: [64, 12, 8], color: STONE });
  boxes.push({ position: [0, 1.5, 50], size: [64, 3, 16], color: "#7d8a92" });

  return boxes;
}

/**
 * The stone gatehouse at the Beechwood Boulevard entrance — the twin-pillared
 * gates you walk through to get into the park.
 */
function gatehouse(): Box[] {
  const boxes: Box[] = [];

  for (const side of [-1, 1]) {
    const x = side * 26;

    boxes.push({ position: [x, 20, 0], size: [16, 40, 16], color: STONE });
    boxes.push({ position: [x, 41, 0], size: [19, 3, 19], color: STONE_DARK });
    boxes.push({ position: [x, 44.5, 0], size: [8, 5, 8], color: STONE_DARK });
  }

  // The lintel across the top, with the gap you can fly through.
  boxes.push({ position: [0, 38, 0], size: [40, 6, 12], color: STONE_DARK });
  boxes.push({ position: [0, 1, 0], size: [72, 2, 22], color: "#9c9382" });

  return boxes;
}

/**
 * The Frick Environmental Center. Rebuilt in 2016 as a Living Building — net
 * zero water and energy — which is exactly the sort of thing this game should be
 * pointing at.
 */
function environmentalCenter(): Box[] {
  return [
    { position: [0, 12, 0], size: [76, 24, 46], color: "#c8bda4" },
    // Long low roof with a deep overhang.
    { position: [0, 25.5, 0], size: [86, 3, 56], color: TIMBER },
    { position: [0, 28.5, -6], size: [70, 3, 30], color: "#7a5f3e" },
    // Glazing along the front.
    { position: [0, 12, 23.5], size: [64, 15, 1.5], color: "#8fc4d8" },
    // Chimney / stair core.
    { position: [-28, 30, -10], size: [12, 14, 12], color: "#a89e8c" },
    // Rain garden cistern — the building harvests its own water.
    { position: [44, 7, 12], size: [14, 14, 14], color: "#6f7f6a" },
  ];
}

/**
 * The lawn bowling green — the only one in Pittsburgh — with its clipped hedge
 * and the little clubhouse beside it.
 */
function bowlingGreen(): Box[] {
  const boxes: Box[] = [
    { position: [0, 0.6, 0], size: [110, 1.2, 110], color: "#6fbf4c" },
  ];

  // Hedge around all four sides.
  for (const [x, z, w, d] of [
    [0, -56, 116, 5],
    [0, 56, 116, 5],
    [-56, 0, 5, 116],
    [56, 0, 5, 116],
  ] as const) {
    boxes.push({ position: [x, 4, z], size: [w, 8, d], color: "#3f7340" });
  }

  // Clubhouse.
  boxes.push({ position: [0, 9, -74], size: [30, 18, 18], color: "#d8d2c2" });
  boxes.push({ position: [0, 19, -74], size: [34, 3, 22], color: "#7a5f3e" });

  return boxes;
}

/** The clay tennis courts. Har-Tru, and a startling orange from above. */
function tennisCourts(): Box[] {
  const boxes: Box[] = [];

  for (const z of [-30, 30]) {
    boxes.push({ position: [0, 0.5, z], size: [70, 1, 40], color: "#b5714a" });
    // Net.
    boxes.push({ position: [0, 3, z], size: [1, 5, 42], color: "#4a4a44" });
    // Line markings.
    boxes.push({ position: [0, 1.1, z - 19], size: [70, 0.4, 1], color: "#e8e2d2" });
    boxes.push({ position: [0, 1.1, z + 19], size: [70, 0.4, 1], color: "#e8e2d2" });
  }

  // Chain-link surround — a wall, from here.
  for (const [x, z, w, d] of [
    [0, -54, 78, 2],
    [0, 54, 78, 2],
    [-39, 0, 2, 110],
    [39, 0, 2, 110],
  ] as const) {
    boxes.push({ position: [x, 9, z], size: [w, 18, d], color: "#7f8a7a" });
  }

  return boxes;
}

/** A park bench. At this scale, a bridge. */
function bench(): Box[] {
  return [
    { position: [0, 6, 0], size: [34, 1.6, 9], color: TIMBER },
    { position: [0, 11, -4], size: [34, 8, 1.6], color: TIMBER },
    { position: [-14, 3, 0], size: [2.4, 6, 9], color: SLATE },
    { position: [14, 3, 0], size: [2.4, 6, 9], color: SLATE },
  ];
}

/** A trail marker post, for orienting. */
function trailPost(): Box[] {
  return [
    { position: [0, 9, 0], size: [2.2, 18, 2.2], color: TIMBER },
    { position: [3, 15, 0], size: [8, 3.5, 0.8], color: "#e0d7bf" },
  ];
}

/** Stepping stones across Nine Mile Run. */
function steppingStone(): Box[] {
  return [
    { position: [0, 1.6, 0], size: [16, 3.2, 14], color: "#9a9184" },
    { position: [1, 3.4, 0.5], size: [11, 0.8, 9], color: "#a8a094" },
  ];
}

export type LandmarkKind =
  | "blueSlide"
  | "gatehouse"
  | "environmentalCenter"
  | "bowlingGreen"
  | "tennisCourts"
  | "bench"
  | "trailPost"
  | "steppingStone";

const BUILDERS: Record<LandmarkKind, () => Box[]> = {
  blueSlide,
  gatehouse,
  environmentalCenter,
  bowlingGreen,
  tennisCourts,
  bench,
  trailPost,
  steppingStone,
};

export function buildLandmarkGeometry(): Record<LandmarkKind, BufferGeometry> {
  return Object.fromEntries(
    (Object.keys(BUILDERS) as LandmarkKind[]).map((kind) => [
      kind,
      buildBoxGeometry(BUILDERS[kind]()),
    ]),
  ) as Record<LandmarkKind, BufferGeometry>;
}
