import type { BufferGeometry } from "three";

import { mottle, VoxelGrid } from "./voxel-grid";

/**
 * What lies along the water's edge: a scatter of wet pebbles, and lily pads on
 * the still places. The creek used to meet its bank in a straight line where a
 * blue sheet cut through a brown slope, and a waterline is never that tidy.
 */
export type ShoreKind = "pebbles" | "lilyPad";

function pebbles(g: VoxelGrid) {
  const stones: [number, number, number, number, string][] = [
    [0, 0, 1.6, 1, "#9a9488"],
    [2.3, 0.8, 1.1, 0.7, "#7f7a70"],
    [-1.9, 1.4, 1.2, 0.8, "#b3aa98"],
    [0.9, -2, 0.9, 0.6, "#8c8578"],
    [-1.2, -1.5, 0.7, 0.5, "#a69c8a"],
  ];

  for (const [x, z, r, tall, color] of stones) {
    g.ball([x, tall * 0.4, z], [r, tall, r * 0.9], mottle(color, 0.06), { half: "upper" });
  }
}

function lilyPad(g: VoxelGrid) {
  const green = "#4f9a52";

  // A flat round leaf with the one notch every lily pad has.
  g.column([0, 0, 0], 0.16, 2.2, 2.2, (x, _y, z) => (Math.hypot(x, z) > 1.8 ? "#3f8346" : green));
  g.blade([0, -0.2, 0], [2.6, -0.2, 0.9], 1, null, { thickness: 1.2, profile: (t) => t });
  // And, on some of them, the flower.
  g.ball([-0.5, 0.5, -0.3], [0.7, 0.42, 0.7], (_x, y) => (y > 0.62 ? "#f6e39a" : "#f7f1f4"), { half: "upper" });
}

const DRAW: Record<ShoreKind, (g: VoxelGrid) => void> = { pebbles, lilyPad };

export function buildShoreGeometry(kind: ShoreKind, fine: boolean): BufferGeometry {
  const grid = new VoxelGrid(fine ? 0.3 : 0.7, 1, !fine);

  DRAW[kind](grid);

  return grid.build({ grounded: true });
}
