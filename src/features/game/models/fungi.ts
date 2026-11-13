import type { BufferGeometry } from "three";

import type { Fungus } from "../data/fungi";
import { FUNGUS_FORMS, type FungusForm } from "./fungus-forms";
import type { Quality } from "./quality";
import { VoxelGrid, type Vec3 } from "./voxel-grid";

/**
 * Twenty-one fungi, twenty-one shapes.
 *
 * There were six shapes, and a lion's mane was a jack-o'-lantern in white. Each
 * species now has a form of its own in `fungus-forms.ts`; this file compiles
 * them.
 */

/** Voxel size in the fungus's own units: high, then low. */
const VOXEL: Record<Quality, number> = { high: 0.024, low: 0.09 };

/**
 * Forms are drawn at life proportions and then enlarged, all three axes alike.
 *
 * A fungus's listed height is a hand or less, and at that size on the forest
 * floor it would be invisible from the air. The old box models answered that by
 * being three times wider than they were tall. These keep their real
 * proportions and are simply bigger.
 */
const ENLARGE = 1.6;

/** A fungus nobody has drawn yet is still a cap on a stem. */
const fallback: FungusForm = (g, { capColor, height, stemColor }) => {
  g.column([0, 0, 0], height * 0.8, 0.05, 0.04, stemColor);
  g.ball([0, height * 0.8, 0], [0.2, 0.12, 0.2], capColor, { half: "upper" });

  return [0, height * 0.8 + 0.12, 0];
};

function draw(fungus: Fungus, quality: Quality) {
  const fine = quality === "high";
  const grid = new VoxelGrid(VOXEL[quality] * Math.max(1, fungus.height / 0.6), 1, !fine);
  const perch = (FUNGUS_FORMS[fungus.id] ?? fallback)(grid, fungus);

  return { grid, perch };
}

export function buildFungusGeometry(fungus: Fungus, quality: Quality): BufferGeometry {
  return draw(fungus, quality).grid.build({ grounded: true }).scale(ENLARGE, ENLARGE, ENLARGE);
}

const perches = new Map<string, Vec3>();

/** Where on the fungus a visitor sets down, in the fungus's own units. */
export function fungusPerch(fungus: Fungus): Vec3 {
  let perch = perches.get(fungus.id);

  if (!perch) {
    const [x, y, z] = draw(fungus, "low").perch;

    perch = [x * ENLARGE, y * ENLARGE, z * ENLARGE];
    perches.set(fungus.id, perch);
  }

  return perch;
}
