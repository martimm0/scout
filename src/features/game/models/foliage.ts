import type { BufferGeometry } from "three";

import { buildBoxGeometry, type Box } from "./voxel";

/**
 * The park's furniture, sized for an insect.
 *
 * A bee here is under a unit long. So a hemlock is seventy units — a tower you
 * fly *around*, not over. A fallen log is a tunnel. An acorn is a boulder. A
 * blade of grass comes up past your head.
 *
 * That ratio is the entire trick. Nothing about a park is interesting at human
 * scale; everything about it is interesting at this one. Each model is built
 * around its base, so y=0 is where it meets the ground.
 */

const BARK = "#6b4f36";
const BARK_DARK = "#54402c";
const BARK_GREY = "#8a7a66";

function trunk(height: number, width: number, color = BARK): Box {
  return {
    position: [0, height / 2, 0],
    size: [width, height, width],
    color,
  };
}

/** Eastern hemlock. Falls Ravine is full of them, and they are enormous. */
function hemlock(): Box[] {
  const boxes: Box[] = [trunk(26, 5.5, BARK_DARK)];
  const tiers = 7;

  for (let i = 0; i < tiers; i += 1) {
    const t = i / (tiers - 1);
    const width = 42 - t * 34;
    const y = 24 + i * 8.5;

    boxes.push({
      position: [0, y, 0],
      size: [width, 9.5, width],
      color: i < 2 ? "#3f6d42" : i < 5 ? "#4a7d4d" : "#578b56",
    });
  }

  return boxes;
}

/** Red oak. Broad, heavy, and the ceiling of the woods. */
function oak(): Box[] {
  return [
    trunk(32, 7, BARK),
    { position: [0, 44, 0], size: [46, 26, 44], color: "#59964d" },
    { position: [-15, 52, 8], size: [26, 20, 24], color: "#64a457" },
    { position: [16, 49, -9], size: [24, 19, 23], color: "#4f8c46" },
    { position: [2, 59, 1], size: [28, 16, 26], color: "#6cae5c" },
  ];
}

/** Understorey shrub — spicebush and viburnum height. */
function shrub(): Box[] {
  return [
    { position: [0, 5, 0], size: [15, 10, 14], color: "#3f7340" },
    { position: [3.5, 11, -2], size: [11, 8, 10], color: "#4a8449" },
    { position: [-4, 10, 3], size: [9, 7, 9], color: "#376a3a" },
  ];
}

/**
 * A fallen log. At this scale it isn't scenery, it's terrain — a wall you go
 * around or a tunnel you thread.
 */
function log(): Box[] {
  return [
    { position: [0, 4, 0], size: [46, 8, 8], color: BARK },
    { position: [-24, 4, 0], size: [3, 7.5, 7.5], color: "#c2a878" },
    { position: [24, 4, 0], size: [3, 7.5, 7.5], color: "#c2a878" },
    // Moss on the weather side, which is how you tell a real one.
    { position: [0, 8, 0.5], size: [40, 1.5, 6], color: "#5f8f4a" },
  ];
}

/** A cut stump, rings and all. */
function stump(): Box[] {
  return [
    { position: [0, 4, 0], size: [11, 8, 11], color: BARK },
    { position: [0, 8.2, 0], size: [9.5, 0.8, 9.5], color: "#c2a878" },
    { position: [0, 8.7, 0], size: [4, 0.6, 4], color: "#a8905f" },
  ];
}

/** An acorn. A boulder, from here. */
function acorn(): Box[] {
  return [
    { position: [0, 2.4, 0], size: [4.4, 5, 4.4], color: "#c98f4a" },
    { position: [0, 5.4, 0], size: [5, 1.8, 5], color: "#6b4f2a" },
    { position: [0, 6.6, 0], size: [1, 1.4, 1], color: "#54402c" },
  ];
}

/** Creek-bed stone. */
function rock(): Box[] {
  return [
    { position: [0, 2.6, 0], size: [13, 5.2, 12], color: "#8a8175" },
    { position: [2.2, 6.2, 1.5], size: [8, 4.4, 7], color: "#9a9184" },
    { position: [-3, 5.2, -2.2], size: [6.5, 3.6, 6], color: "#7b7368" },
  ];
}

/** A standing dead trunk. Cheap, and it does a lot for a woodland's character. */
function snag(): Box[] {
  return [
    trunk(40, 5, BARK_GREY),
    { position: [6, 31, 0], size: [13, 2.6, 2.6], color: BARK_GREY },
    { position: [-5, 24, 1], size: [10, 2.2, 2.2], color: BARK_GREY },
  ];
}

/** Fern. Fern Hollow is named for these, and here they're small trees. */
function fern(): Box[] {
  const boxes: Box[] = [];
  const fronds = 5;

  for (let i = 0; i < fronds; i += 1) {
    const angle = (i / fronds) * Math.PI * 2;
    const lean = 5.5;

    boxes.push({
      position: [Math.cos(angle) * lean, 5, Math.sin(angle) * lean],
      size: [7, 1, 3],
      color: i % 2 === 0 ? "#4f8a3f" : "#5c9a4a",
    });
    boxes.push({
      position: [Math.cos(angle) * lean * 0.55, 8.5, Math.sin(angle) * lean * 0.55],
      size: [5, 0.9, 2.4],
      color: "#67a552",
    });
  }

  boxes.push({ position: [0, 4, 0], size: [1.4, 8, 1.4], color: "#3f6b32" });

  return boxes;
}

/**
 * Grass. The single most important model here — a lawn you could mow is, from
 * a bee's height, a forest of blades taller than you are. Nothing else sells the
 * scale as cheaply.
 */
function grass(): Box[] {
  return [
    { position: [0, 2.6, 0], size: [0.5, 5.2, 0.5], color: "#6aa84f" },
    { position: [1.1, 2.1, 0.5], size: [0.45, 4.2, 0.45], color: "#77b859" },
    { position: [-0.9, 1.8, -0.7], size: [0.4, 3.6, 0.4], color: "#5f9a45" },
    { position: [0.3, 1.5, 1.2], size: [0.4, 3, 0.4], color: "#7fc05e" },
  ];
}

export type FoliageKind =
  | "hemlock"
  | "oak"
  | "shrub"
  | "log"
  | "stump"
  | "acorn"
  | "rock"
  | "snag"
  | "fern"
  | "grass";

const BUILDERS: Record<FoliageKind, () => Box[]> = {
  hemlock,
  oak,
  shrub,
  log,
  stump,
  acorn,
  rock,
  snag,
  fern,
  grass,
};

export function buildFoliageGeometry(): Record<FoliageKind, BufferGeometry> {
  return Object.fromEntries(
    (Object.keys(BUILDERS) as FoliageKind[]).map((kind) => [
      kind,
      buildBoxGeometry(BUILDERS[kind]()),
    ]),
  ) as Record<FoliageKind, BufferGeometry>;
}
