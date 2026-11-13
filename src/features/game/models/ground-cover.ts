import type { BufferGeometry } from "three";

import { VoxelGrid } from "./voxel-grid";

/**
 * The small stuff underfoot, on the fine park only.
 *
 * Between one flower you can land on and the next there was nothing but grass
 * on bare ground. A real meadow is never that tidy: there are buttercups and
 * violets too small to bother a bee about, clumps of coarser grass, fallen
 * leaves, and stones. None of these can be met, pollinated or bumped into.
 * They are there so the ground is somewhere rather than a colour.
 */
export type CoverKind = "buttercup" | "violet" | "daisy" | "tuft" | "leaves" | "stone";

export const COVER_KINDS: CoverKind[] = ["buttercup", "violet", "daisy", "tuft", "leaves", "stone"];

/**
 * A wildflower too small to have a name card: a stalk, a leaf, one bloom.
 *
 * Deliberately crude. There are thousands of these and none is ever looked at
 * for long, so each is a couple of dozen faces: a straight stalk, one leaf, and
 * a flat cross of petals round an eye.
 */
function sprig(g: VoxelGrid, petal: string, eye: string) {
  const s = g.size;

  g.box([0, 1.3, 0], [s, 2.6, s], "#5f9a45");
  g.box([s * 1.5, 0.7, 0], [s * 2, s, s], "#67a552");
  g.box([0, 2.7, 0], [s * 3, s, s], petal);
  g.box([0, 2.7, 0], [s, s, s * 3], petal);
  g.box([0, 2.7 + s, 0], [s, s, s], eye);
}

const DRAW: Record<CoverKind, (g: VoxelGrid) => void> = {
  buttercup: (g) => sprig(g, "#f6d23a", "#e0a81e"),
  violet: (g) => sprig(g, "#8f7fd6", "#f3e9a8"),
  daisy: (g) => sprig(g, "#f7f4ea", "#f0c23e"),
  tuft: (g) => {
    // A clump of coarse grass, with one stem gone to seed.
    const s = g.size;
    const blades: [number, number, number, string][] = [
      [0, 0, 2.4, "#79b257"],
      [2, 1, 1.8, "#6aa34d"],
      [-2, 1, 2.1, "#79b257"],
      [1, -2, 1.6, "#6aa34d"],
    ];

    for (const [cx, cz, tall, color] of blades) {
      g.box([cx * s, tall / 2, cz * s], [s, tall, s], color);
    }

    g.box([-s, 1.9, -2 * s], [s, 3.8, s], "#9cb060");
    g.box([-s, 4, -2 * s], [s, 0.7, s], "#c9b877");
  },
  leaves: (g) => {
    const s = g.size;
    const colors = ["#b5823c", "#96642c", "#cfa456", "#a8562c"];
    const spots: [number, number][] = [[0, 0], [4, 1], [-3, 3], [1, -4]];

    spots.forEach(([cx, cz], index) => {
      g.box([cx * s, s / 2, cz * s], [s * 3, s, s * 2], colors[index]);
    });
  },
  stone: (g) => {
    g.ball([0, 0.2, 0], [0.9, 0.6, 0.75], "#9a9488", { half: "upper" });
    g.ball([0.9, 0.1, 0.5], [0.5, 0.35, 0.45], "#b3aa98", { half: "upper" });
  },
};

export function buildCoverGeometry(kind: CoverKind): BufferGeometry {
  const grid = new VoxelGrid(0.3, 1, true);

  DRAW[kind](grid);

  return grid.build({ grounded: true });
}
