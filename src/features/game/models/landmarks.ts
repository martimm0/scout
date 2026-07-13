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


/**
 * The Fern Hollow Bridge.
 *
 * It collapsed on the morning of 28 January 2022, hours before the President was
 * due in town to talk about infrastructure. Nobody died. It was rebuilt and
 * reopened in under a year, and it is now the single most Pittsburgh object in
 * Pittsburgh — a city of four hundred bridges that dropped one into a ravine and
 * then put it back faster than anyone believed possible.
 *
 * It carries Forbes Avenue over the top of Fern Hollow. From down here it is the
 * sky.
 */
function fernHollowBridge(): Box[] {
  const boxes: Box[] = [];
  const SPAN = 300;
  const DECK_Y = 96;

  // The deck.
  boxes.push({ position: [0, DECK_Y, 0], size: [SPAN, 5, 44], color: "#8e8a82" });
  boxes.push({ position: [0, DECK_Y + 3.5, 0], size: [SPAN, 2, 38], color: "#5a5750" });

  // Parapets down both sides.
  for (const z of [-21, 21]) {
    boxes.push({ position: [0, DECK_Y + 6, z], size: [SPAN, 8, 3], color: "#a49f95" });
  }

  // Girders under the deck.
  for (const z of [-14, 0, 14]) {
    boxes.push({ position: [0, DECK_Y - 6, z], size: [SPAN, 8, 5], color: "#6f6a60" });
  }

  // Piers, marching down into the hollow.
  for (const x of [-96, -32, 32, 96]) {
    boxes.push({ position: [x, DECK_Y / 2 - 6, 0], size: [16, DECK_Y - 4, 22], color: "#9a9488" });
    boxes.push({ position: [x, DECK_Y - 12, 0], size: [24, 6, 30], color: "#8e8a82" });
  }

  // Abutments at both ends.
  for (const x of [-SPAN / 2 + 10, SPAN / 2 - 10]) {
    boxes.push({ position: [x, DECK_Y / 2, 0], size: [28, DECK_Y, 46], color: "#7f7a70" });
  }

  return boxes;
}

/** Stone steps down into the ravine. Frick is full of them, and they are steep. */
function stoneSteps(): Box[] {
  const boxes: Box[] = [];
  const steps = 16;

  for (let i = 0; i < steps; i += 1) {
    const t = i / (steps - 1);

    boxes.push({
      position: [0, 40 - t * 40, -40 + t * 80],
      size: [26, 4, 6],
      color: i % 2 === 0 ? STONE : STONE_DARK,
    });
  }

  // A handrail, because the drop is genuinely alarming.
  for (const x of [-15, 15]) {
    boxes.push({ position: [x, 46 - 20, 0], size: [2, 6, 84], color: "#5f5a52" });
  }

  return boxes;
}

/** Swings, beside the Blue Slide. */
function swings(): Box[] {
  const boxes: Box[] = [
    // A-frame.
    { position: [0, 20, 0], size: [56, 3, 3], color: SLATE },
  ];

  for (const x of [-26, 26]) {
    for (const z of [-9, 9]) {
      boxes.push({ position: [x, 10, z], size: [2.5, 20, 2.5], color: SLATE });
    }
  }

  // Two seats, hanging.
  for (const x of [-13, 13]) {
    boxes.push({ position: [x, 11, 0], size: [1, 16, 1], color: "#3f3b36" });
    boxes.push({ position: [x, 3, 0], size: [10, 1.5, 5], color: "#2f6fa8" });
  }

  return boxes;
}

/** A trail shelter. Somewhere to sit out a downpour. */
function pavilion(): Box[] {
  const boxes: Box[] = [
    { position: [0, 1, 0], size: [64, 2, 48], color: "#9c9382" },
    // Roof.
    { position: [0, 26, 0], size: [72, 3, 56], color: "#7a5f3e" },
    { position: [0, 29, 0], size: [50, 3, 38], color: "#6b5232" },
  ];

  for (const x of [-28, 28]) {
    for (const z of [-20, 20]) {
      boxes.push({ position: [x, 13, z], size: [4, 24, 4], color: TIMBER });
    }
  }

  // Picnic table under it.
  boxes.push({ position: [0, 8, 0], size: [30, 1.5, 12], color: TIMBER });
  boxes.push({ position: [0, 4, 0], size: [3, 8, 10], color: TIMBER });

  return boxes;
}

/**
 * A storm culvert, discharging into Nine Mile Run.
 *
 * The whole restoration story lives here: this stream was a sewer and a slag
 * dump for most of the twentieth century, and the outfalls are still there.
 */
function culvert(): Box[] {
  return [
    { position: [0, 9, 0], size: [30, 18, 14], color: "#7a7268" },
    // The mouth.
    { position: [0, 7, 8], size: [18, 12, 4], color: "#3a352e" },
    // Apron of rip-rap.
    { position: [0, 1, 18], size: [34, 3, 20], color: "#8a8175" },
    { position: [-8, 3, 22], size: [8, 4, 7], color: "#9a9184" },
    { position: [9, 3, 25], size: [7, 4, 6], color: "#7b7368" },
  ];
}

/**
 * A slag outcrop.
 *
 * Nine Mile Run's valley was filled with steel-mill slag — millions of tons of
 * it, dumped for decades. The restoration moved what it could and planted over
 * the rest, but the stuff is still under everything, and it still breaks the
 * surface. Glassy, sharp, and faintly wrong-coloured.
 */
function slag(): Box[] {
  return [
    { position: [0, 4, 0], size: [22, 8, 18], color: "#4a4048" },
    { position: [4, 9, -3], size: [13, 6, 11], color: "#5c5060" },
    { position: [-6, 8, 4], size: [10, 5, 9], color: "#3e3640" },
    // A vein of rust where the iron in it is still weathering out.
    { position: [1, 12, 1], size: [7, 2, 6], color: "#7a4a32" },
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
  | "steppingStone"
  | "fernHollowBridge"
  | "stoneSteps"
  | "swings"
  | "pavilion"
  | "culvert"
  | "slag";

const BUILDERS: Record<LandmarkKind, () => Box[]> = {
  blueSlide,
  gatehouse,
  environmentalCenter,
  bowlingGreen,
  tennisCourts,
  bench,
  trailPost,
  steppingStone,
  fernHollowBridge,
  stoneSteps,
  swings,
  pavilion,
  culvert,
  slag,
};

export function buildLandmarkGeometry(): Record<LandmarkKind, BufferGeometry> {
  return Object.fromEntries(
    (Object.keys(BUILDERS) as LandmarkKind[]).map((kind) => [
      kind,
      buildBoxGeometry(BUILDERS[kind]()),
    ]),
  ) as Record<LandmarkKind, BufferGeometry>;
}
