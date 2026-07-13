import type { BufferGeometry } from "three";

import { buildVoxelGeometry, shade, tint, type VoxelPalette } from "./voxel";

/**
 * The bee, as text art.
 *
 * Each part is a stack of Y layers, bottom to top. Within a layer, rows read
 * front to back and characters read left to right. Row 0 is the bee's face.
 *
 *   B body   S stripe   D chitin   E eye   G eye glint
 *   F fuzz   W wing     L leg      K pollen   A antenna
 *
 * Cuteness lives in the proportions, not the detail. Three rules earned the
 * hard way:
 *
 *  - The head is FUZZ, not chitin. A dark head disappears against the dark
 *    abdomen bands and the bee reads as a striped blob with no face.
 *  - Bands are one voxel. Two-voxel bands turn the abdomen into a black slab.
 *  - Short and fat beats long and flat. A long body reads as an aircraft.
 *
 * Resist adding voxels — chunky reads better at chase-camera distance.
 */

export const VOXEL_SIZE = 0.055;

/**
 * Legs and antennae are built on a finer grid. At body scale a single voxel is
 * a chunky black club, and the bee ends up with six table legs and two horns.
 */
const DETAIL_SIZE = 0.04;

// Honey face plate (C), big black eyes wrapping the front corners, fuzzy golden
// crown on top. Three tones, and they have to stay three tones: an all-fuzz head
// is a blank cream wall, and a chitin-dark face plate merges with the black eyes
// into one featureless slab. The face has to sit between the two.
const HEAD_LAYERS = [
  // y0 — chin
  [
    "..CCC..",
    ".CCCCC.",
    ".FFFFF.",
    "..FFF..",
  ],
  // y1 — eyes begin
  [
    "EECCCEE",
    "EECCCEE",
    "FFFFFFF",
    ".FFFFF.",
  ],
  // y2
  [
    "EECCCEE",
    "EECCCEE",
    "FFFFFFF",
    ".FFFFF.",
  ],
  // y3 — one glint voxel at the top outer corner of each eye
  [
    "GECCCEG",
    "EEFFFEE",
    "FFFFFFF",
    ".FFFFF.",
  ],
  // y4 — fuzzy crown
  [
    ".FFFFF.",
    ".FFFFF.",
    ".FFFFF.",
    "..FFF..",
  ],
];

// A dark collar at the front (z0) separates the fuzzy head from the fuzzy
// thorax. Without it the two merge into one shapeless lump.
const THORAX_LAYERS = [
  [
    "..DDD..",
    ".FFFFF.",
    ".FFFFF.",
    "..FFF..",
  ],
  [
    ".DDDDD.",
    "FFFFFFF",
    "FFFFFFF",
    ".FFFFF.",
  ],
  [
    ".DDDDD.",
    "FFFFFFF",
    "FFFFFFF",
    ".FFFFF.",
  ],
  [
    ".DDDDD.",
    "FFFFFFF",
    "FFFFFFF",
    ".FFFFF.",
  ],
  [
    ".DDDDD.",
    "FFFFFFF",
    "FFFFFFF",
    ".FFFFF.",
  ],
  [
    "..DDD..",
    ".FFFFF.",
    ".FFFFF.",
    "..FFF..",
  ],
];

// Gold / black / gold / black / gold, then a stinger. One-voxel bands.
const ABDOMEN_LAYERS = [
  // y0 — belly
  [
    "..BBB..",
    "..SSS..",
    "..BBB..",
    "..SSS..",
    ".......",
    ".......",
  ],
  // y1
  [
    ".BBBBB.",
    ".SSSSS.",
    ".BBBBB.",
    ".SSSSS.",
    "..BBB..",
    ".......",
  ],
  // y2 — widest
  [
    "BBBBBBB",
    "SSSSSSS",
    "BBBBBBB",
    ".SSSSS.",
    ".BBBBB.",
    "...D...",
  ],
  // y3 — widest
  [
    "BBBBBBB",
    "SSSSSSS",
    "BBBBBBB",
    ".SSSSS.",
    ".BBBBB.",
    "...D...",
  ],
  // y4
  [
    ".BBBBB.",
    ".SSSSS.",
    ".BBBBB.",
    ".SSSSS.",
    "..BBB..",
    ".......",
  ],
  // y5 — back
  [
    "..BBB..",
    "..SSS..",
    "..BBB..",
    "..SSS..",
    ".......",
    ".......",
  ],
];

// One voxel thick, rooted at x=0 so it hinges at the shoulder. A paddle, not a
// helicopter blade — long thin wings make the bee look like an aircraft.
const WING_LAYERS = [
  [
    "..WWWW.",
    ".WWWWWW",
    "WWWWWWW",
    ".WWWWWW",
    "..WWWW.",
  ],
];

/** Long and tapered — a hoverfly's wing on a bee. */
const WING_LONG_LAYERS = [
  [
    "...WWWWW.",
    ".WWWWWWWW",
    "WWWWWWWWW",
    ".WWWWWWW.",
    "...WWW...",
  ],
];

/** Short, round and stubby. Bumblebee energy. */
const WING_STUBBY_LAYERS = [
  [
    ".WWWW.",
    "WWWWWW",
    "WWWWWW",
    ".WWWW.",
  ],
];

export const WING_STYLES = ["round", "long", "stubby"] as const;
export type WingStyle = (typeof WING_STYLES)[number];

const WING_BY_STYLE: Record<WingStyle, string[][]> = {
  round: WING_LAYERS,
  long: WING_LONG_LAYERS,
  stubby: WING_STUBBY_LAYERS,
};

/**
 * Accessories. Small, silly, and entirely the point — this is the one place in
 * the game that exists purely so the bee is *yours*.
 */
// X is the accent colour the player picks. R/Y/N are the flower's own colours.
// None of these letters may collide with the body palette — C is the head's face
// plate and G is the eye glint, and reusing either repaints the bee's face.
const CAP_LAYERS = [
  [
    ".XXXXX.",
    "XXXXXXX",
    "XXXXXXX",
    ".XXXXX.",
  ],
  [
    "..XXX..",
    ".XXXXX.",
    ".XXXXX.",
    "..XXX..",
  ],
  [
    ".......",
    "..XXX..",
    "..XXX..",
    ".......",
  ],
];

const FLOWER_LAYERS = [
  [
    "...N...",
    "..NNN..",
    "...N...",
  ],
  [
    "..R.R..",
    ".RRYRR.",
    "..R.R..",
  ],
];

const SCARF_LAYERS = [
  [
    "XXXXXXX",
    "XXXXXXX",
  ],
  [
    ".XXXXX.",
    "..XXX..",
  ],
];

export const ACCESSORIES = ["none", "cap", "flower", "scarf"] as const;
export type Accessory = (typeof ACCESSORIES)[number];

const HIND_WING_LAYERS = [
  [
    ".WWWW",
    "WWWWW",
    ".WWWW",
  ],
];

// Three pairs, splayed down and out. Barely visible in flight, but the
// silhouette is wrong without them.
const LEG_LAYERS = [
  // y0 — feet
  [
    ".L.....L.",
    ".........",
    ".L.....L.",
    ".........",
    ".L.....L.",
  ],
  // y1 — hips
  [
    "..L...L..",
    ".........",
    "..L...L..",
    ".........",
    "..L...L..",
  ],
];

// Pollen packed onto the hind legs, shown once the bee has pollinated something.
const POLLEN_LAYERS = [
  [
    ".........",
    ".........",
    ".........",
    ".........",
    "K.......K",
  ],
  [
    ".........",
    ".........",
    ".........",
    ".........",
    "K.......K",
  ],
];

// Short, leaning forward, with a heavier bulb at the tip. Tall antennae read as
// horns, which is a different animal entirely.
const ANTENNA_LAYERS = [
  [
    ".......",
    "..A.A..",
  ],
  [
    "..A.A..",
    ".......",
  ],
  [
    "..D.D..",
    ".......",
  ],
];

export type BeeGeometry = {
  head: BufferGeometry;
  thorax: BufferGeometry;
  abdomen: BufferGeometry;
  wing: BufferGeometry;
  hindWing: BufferGeometry;
  legs: BufferGeometry;
  pollen: BufferGeometry;
  antennae: BufferGeometry;
  /** Null when the pollinator isn't wearing anything. */
  accessory: BufferGeometry | null;
};

/** Where each accessory sits. A hat goes on the head; a scarf goes on the neck. */
const ACCESSORY_OFFSET: Record<Accessory, [number, number, number]> = {
  none: [0, 0, 0],
  cap: [0, 0.2, -0.2],
  flower: [0.12, 0.21, -0.2],
  scarf: [0, -0.04, -0.11],
};

/**
 * Where each part sits relative to the bee's centre, and — for the parts that
 * move — what it pivots around. The bee faces -Z, matching the flight loop's
 * forward vector, so it flies nose-first without a corrective yaw.
 */
export const BEE_OFFSETS = {
  head: [0, 0.03, -0.22],
  thorax: [0, 0, 0],
  abdomen: [0, -0.02, 0.11],
  wing: [0.15, 0.14, -0.02],
  hindWing: [0.13, 0.09, 0.07],
  legs: [0, -0.16, 0.02],
  pollen: [0, -0.16, 0.02],
  antennae: [0, 0.16, -0.29],
} as const satisfies Record<
  Exclude<keyof BeeGeometry, "accessory">,
  readonly [number, number, number]
>;

function beePalette(
  bodyColor: string,
  wingColor: string,
  accentColor: string,
): VoxelPalette {
  const chitin = "#2a2119";

  return {
    // Accessories.
    X: accentColor,
    R: "#e4759b",
    Y: "#f7e07a",
    N: "#5f9a45",
    B: bodyColor,
    S: chitin,
    D: chitin,
    A: chitin,
    L: chitin,
    E: "#181510",
    G: "#ffffff",
    C: shade(bodyColor, 0.3),
    F: tint(bodyColor, 0.42),
    K: "#f0a52e",
    W: wingColor,
  };
}

export function buildBeeGeometry(
  bodyColor: string,
  wingColor: string,
  wingStyle: WingStyle = "round",
  accessory: Accessory = "none",
  accentColor = "#c0413b",
): BeeGeometry {
  const palette = beePalette(bodyColor, wingColor, accentColor);
  const size = VOXEL_SIZE;

  const accessoryLayers: Record<Accessory, string[][] | null> = {
    none: null,
    cap: CAP_LAYERS,
    flower: FLOWER_LAYERS,
    scarf: SCARF_LAYERS,
  };

  const layers = accessoryLayers[accessory];

  return {
    head: buildVoxelGeometry({
      layers: HEAD_LAYERS,
      origin: [3.5, 2.5, 2],
      palette,
      size,
    }),
    thorax: buildVoxelGeometry({
      layers: THORAX_LAYERS,
      origin: [3.5, 3, 2],
      palette,
      size,
    }),
    abdomen: buildVoxelGeometry({
      layers: ABDOMEN_LAYERS,
      origin: [3.5, 3, 0],
      palette,
      size,
    }),
    // Wings are thin and translucent; baked AO would just read as dirt.
    wing: buildVoxelGeometry({
      ao: false,
      layers: WING_BY_STYLE[wingStyle] ?? WING_LAYERS,
      origin: [0, 0, 2],
      palette,
      size,
    }),
    accessory: layers
      ? buildVoxelGeometry({
          layers,
          origin: [3.5, 0, 1.5],
          palette,
          size,
        })
      : null,
    hindWing: buildVoxelGeometry({
      ao: false,
      layers: HIND_WING_LAYERS,
      origin: [0, 0, 1.5],
      palette,
      size,
    }),
    legs: buildVoxelGeometry({
      layers: LEG_LAYERS,
      origin: [4.5, 2, 2.5],
      palette,
      size: DETAIL_SIZE,
    }),
    pollen: buildVoxelGeometry({
      layers: POLLEN_LAYERS,
      origin: [4.5, 2, 2.5],
      palette,
      size: DETAIL_SIZE,
    }),
    antennae: buildVoxelGeometry({
      layers: ANTENNA_LAYERS,
      origin: [3.5, 0, 1],
      palette,
      size: DETAIL_SIZE,
    }),
  };
}

export function disposeBeeGeometry(geometry: BeeGeometry) {
  for (const part of Object.values(geometry)) {
    part?.dispose();
  }
}

export function accessoryOffset(accessory: Accessory) {
  return ACCESSORY_OFFSET[accessory];
}
