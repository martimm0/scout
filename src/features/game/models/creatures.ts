import type { BufferGeometry } from "three";

import { VoxelGrid } from "./voxel-grid";

/**
 * The park's bit players: a bird overhead, a moth at dusk, another bee on the
 * flower you wanted.
 *
 * They were unit cubes, stretched. A bird was a dark plank. Each is now a few
 * dozen voxels with a body and two wings, drawn wings out along X so one line
 * of shader (`flap` in world/wind.ts) can beat them, and scaled so the whole
 * animal is one unit across: the code that places them sets the size, as it
 * always did.
 */
export type CreatureKind = "bird" | "moth" | "bug";

/** How far from the centre line the wings begin, once the model is one unit wide. */
export const WING_ROOT: Record<CreatureKind, number> = { bird: 0.09, moth: 0.07, bug: 0.12 };

function bird(g: VoxelGrid) {
  // Seen from below, mostly: dark above, pale underneath, a fork in the tail.
  g.ball([0, 0.5, 0], [0.9, 0.8, 2.1], (_x, y) => (y < 0.35 ? "#d9d2c4" : "#3a3330"));
  g.ball([0, 0.75, -2], [0.75, 0.7, 0.8], "#3a3330");
  g.limb([0, 0.6, -2.6], [0, 0.5, -3.3], 0.22, 0.08, "#e0a23a");
  g.blade([0, 0.5, 1.8], [0.7, 0.5, 3.6], 0.8, "#2c2623");
  g.blade([0, 0.5, 1.8], [-0.7, 0.5, 3.6], 0.8, "#2c2623");

  for (const side of [-1, 1]) {
    // A swept wing, in two pieces so it has an elbow.
    g.blade([side * 0.6, 0.7, -0.6], [side * 2.9, 0.7, 0.1], 2.2, "#3a3330", { profile: (t) => 1 - t * 0.35 });
    g.blade([side * 2.7, 0.7, 0.1], [side * 5, 0.7, 1.3], 1.5, "#2c2623", { profile: (t) => 1 - t * 0.8 });
  }
}

function moth(g: VoxelGrid) {
  g.ball([0, 0.5, 0], [0.55, 0.5, 1.5], "#cdbb9c", { rough: 0.2 });
  g.ball([0, 0.55, -1.4], [0.45, 0.42, 0.45], "#b7a384");

  for (const side of [-1, 1]) {
    // Fore wing and hind wing, held flat, dusty and eyed.
    g.blade([side * 0.4, 0.6, -0.9], [side * 3.4, 0.6, -0.5], 2.5, (x, _y, z) =>
      Math.hypot(Math.abs(x) - 2.1, z + 0.6) < 0.45 ? "#6f5a42" : Math.abs(x) > 2.9 ? "#a8947a" : "#d8c8ac",
    { profile: (t) => 0.5 + t * 0.5 });
    g.blade([side * 0.4, 0.6, 0.4], [side * 2.4, 0.6, 1.5], 1.7, "#c9b89a", { profile: (t) => 0.6 + t * 0.4 });
    g.limb([side * 0.15, 0.8, -1.7], [side * 0.9, 1.1, -2.6], 0, 0, "#8a765a");
  }
}

function bug(g: VoxelGrid) {
  // A bee, at the size where a bee is three stripes and a blur.
  g.ball([0, 0.5, 0.4], [0.6, 0.55, 1], (_x, _y, z) => (Math.floor((z + 2) / 0.42) % 2 === 0 ? "#2a2119" : "#f0c23e"));
  g.ball([0, 0.55, -0.85], [0.5, 0.48, 0.5], "#e8c15a", { rough: 0.2 });
  g.ball([0, 0.5, -1.4], [0.36, 0.36, 0.3], "#2a2119");

  for (const side of [-1, 1]) {
    g.blade([side * 0.4, 1, -0.6], [side * 2.1, 1, 0.2], 1.1, "#e9f3f6");
  }
}

const DRAW: Record<CreatureKind, (g: VoxelGrid) => void> = { bird, moth, bug };

/** One creature, one unit across the wings, centred on its own middle. */
export function buildCreatureGeometry(kind: CreatureKind, fine: boolean): BufferGeometry {
  const grid = new VoxelGrid(fine ? 0.34 : 0.95, 1, !fine);

  DRAW[kind](grid);

  const geometry = grid.build();

  geometry.computeBoundingBox();

  const box = geometry.boundingBox;

  if (box) {
    const span = box.max.x - box.min.x || 1;

    geometry.translate(0, -(box.max.y + box.min.y) / 2, -(box.max.z + box.min.z) / 2);
    geometry.scale(1 / span, 1 / span, 1 / span);
  }

  return geometry;
}
