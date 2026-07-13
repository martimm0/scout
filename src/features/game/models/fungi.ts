import type { BufferGeometry } from "three";

import type { Fungus } from "../data/fungi";
import { buildBoxGeometry, shade, tint, type Box } from "./voxel";

/**
 * Six fungus shapes for eight species.
 *
 * A mushroom is not a small plant. It has no stem in the plant sense, no leaves,
 * and no flower, so none of the flora archetypes fit. What it has is a fruiting
 * body: the part you see is the fungus's equivalent of an apple, and the actual
 * organism is a web of threads through the wood or the soil, often for acres.
 */

function bracket(fungus: Fungus): Box[] {
  const { capColor, height, stemColor } = fungus;
  const boxes: Box[] = [];

  // Overlapping fans stacked up a rotting stub.
  boxes.push({
    position: [0, height * 0.5, -0.3],
    size: [0.5, height, 0.5],
    color: stemColor,
  });

  for (let i = 0; i < 4; i += 1) {
    const y = height * (0.25 + i * 0.22);
    const width = 1.5 - i * 0.18;

    boxes.push({
      position: [0, y, 0.25 + i * 0.04],
      size: [width, 0.12, 0.8],
      color: i % 2 === 0 ? capColor : shade(capColor, 0.18),
    });
    // The concentric band that gives a turkey tail its name.
    boxes.push({
      position: [0, y + 0.07, 0.5 + i * 0.04],
      size: [width * 0.8, 0.06, 0.3],
      color: tint(capColor, 0.35),
    });
    // The pale pore surface underneath.
    boxes.push({
      position: [0, y - 0.08, 0.25 + i * 0.04],
      size: [width * 0.9, 0.05, 0.7],
      color: "#e8e0cc",
    });
  }

  return boxes;
}

/** Great orange shelves, big enough to sit on. */
function shelf(fungus: Fungus): Box[] {
  const { capColor, height, stemColor } = fungus;
  const boxes: Box[] = [
    { position: [0, height * 0.5, -0.4], size: [0.7, height, 0.6], color: stemColor },
  ];

  for (const [i, [x, y, w]] of (
    [
      [0, 0.3, 1.9],
      [0.4, 0.6, 1.6],
      [-0.35, 0.85, 1.4],
      [0.15, 1.05, 1],
    ] as const
  ).entries()) {
    boxes.push({
      position: [x, height * y, 0.35],
      size: [w, 0.16, 1.1],
      color: i % 2 === 0 ? capColor : tint(capColor, 0.16),
    });
    boxes.push({
      position: [x, height * y - 0.1, 0.35],
      size: [w * 0.9, 0.06, 1],
      color: shade(capColor, 0.3),
    });
  }

  return boxes;
}

/** The classic toadstool: stem, gills, cap. */
function cap(fungus: Fungus): Box[] {
  const { capColor, height, stemColor } = fungus;

  return [
    // Stem, with the ring and the bulbous volva at the base — the two features
    // that identify a deadly Amanita, and which people miss.
    { position: [0, height * 0.45, 0], size: [0.28, height * 0.9, 0.28], color: stemColor },
    { position: [0, height * 0.12, 0], size: [0.5, 0.22, 0.5], color: tint(stemColor, 0.1) },
    { position: [0, height * 0.7, 0], size: [0.42, 0.1, 0.42], color: tint(stemColor, 0.2) },
    // Gills.
    { position: [0, height * 0.88, 0], size: [1.15, 0.12, 1.15], color: shade(capColor, 0.1) },
    // Cap.
    { position: [0, height * 0.96, 0], size: [1.3, 0.2, 1.3], color: capColor },
    { position: [0, height * 1.06, 0], size: [0.9, 0.14, 0.9], color: tint(capColor, 0.08) },
    { position: [0, height * 1.13, 0], size: [0.4, 0.08, 0.4], color: tint(capColor, 0.14) },
  ];
}

/** A white boulder in the grass. */
function puffball(fungus: Fungus): Box[] {
  const { capColor, height } = fungus;

  return [
    { position: [0, height * 0.4, 0], size: [1.5, height * 0.8, 1.5], color: capColor },
    { position: [0, height * 0.85, 0], size: [1.1, height * 0.3, 1.1], color: tint(capColor, 0.1) },
    { position: [0, height * 0.05, 0], size: [0.8, 0.2, 0.8], color: shade(capColor, 0.25) },
  ];
}

/** The honeycombed cone. Unmistakable, which is why people trust it. */
function morel(fungus: Fungus): Box[] {
  const { capColor, height, stemColor } = fungus;
  const boxes: Box[] = [
    { position: [0, height * 0.25, 0], size: [0.45, height * 0.5, 0.45], color: stemColor },
  ];

  // The pitted cone: a lattice of ridges with hollows between them.
  for (let tier = 0; tier < 5; tier += 1) {
    const t = tier / 4;
    const y = height * (0.5 + t * 0.62);
    const width = 0.95 - t * 0.55;

    boxes.push({
      position: [0, y, 0],
      size: [width, height * 0.14, width],
      color: tier % 2 === 0 ? capColor : shade(capColor, 0.28),
    });

    // Ridges standing proud of the pits.
    for (const [dx, dz] of [
      [width * 0.45, 0],
      [-width * 0.45, 0],
      [0, width * 0.45],
      [0, -width * 0.45],
    ] as const) {
      boxes.push({
        position: [dx, y, dz],
        size: [0.14, height * 0.16, 0.14],
        color: tint(capColor, 0.3),
      });
    }
  }

  return boxes;
}

/** A dense clump at the foot of a tree. The jack-o'-lantern grows like this. */
function cluster(fungus: Fungus): Box[] {
  const boxes: Box[] = [];
  const { capColor, height, stemColor } = fungus;

  const stalks: [number, number, number][] = [
    [0, 0, 1],
    [0.55, 0.3, 0.85],
    [-0.5, 0.35, 0.8],
    [0.25, -0.5, 0.7],
    [-0.3, -0.45, 0.65],
  ];

  for (const [x, z, s] of stalks) {
    const h = height * s;

    boxes.push({ position: [x, h * 0.45, z], size: [0.24, h * 0.9, 0.24], color: stemColor });
    // Gills, which is where the light comes from.
    boxes.push({
      position: [x, h * 0.85, z],
      size: [0.8 * s, 0.1, 0.8 * s],
      color: tint(capColor, 0.25),
    });
    boxes.push({
      position: [x, h * 0.94, z],
      size: [0.95 * s, 0.16, 0.95 * s],
      color: capColor,
    });
    boxes.push({
      position: [x, h * 1.03, z],
      size: [0.6 * s, 0.1, 0.6 * s],
      color: shade(capColor, 0.12),
    });
  }

  return boxes;
}

const BUILDERS: Record<Fungus["archetype"], (fungus: Fungus) => Box[]> = {
  bracket,
  shelf,
  cap,
  puffball,
  morel,
  cluster,
};

export function buildFungusGeometry(fungus: Fungus): BufferGeometry {
  return buildBoxGeometry(BUILDERS[fungus.archetype](fungus));
}
