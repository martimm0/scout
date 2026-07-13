import type { BufferGeometry } from "three";

import type { Plant } from "../data/plants";
import { buildBoxGeometry, shade, tint, type Box } from "./voxel";

/**
 * Sixteen plants, six shapes. Each species is a set of numbers — height, bloom
 * colour, leaf colour, archetype — and the archetype decides what it grows into.
 * Hand-modelling sixteen flowers would look no better and would be sixteen times
 * the work to change.
 */

const STEM = "#4a7a3f";

function stem(height: number, color: string, width = 0.09): Box {
  return {
    position: [0, height / 2, 0],
    size: [width, height, width],
    color: shade(color, 0.15),
  };
}

/** Paired leaves stepping up the stalk. */
function leaves(height: number, color: string, pairs: number, span: number): Box[] {
  const boxes: Box[] = [];

  for (let i = 0; i < pairs; i += 1) {
    const y = height * (0.2 + (i / pairs) * 0.5);
    const side = i % 2 === 0 ? 1 : -1;
    const angle = i * 1.1;

    boxes.push({
      position: [Math.cos(angle) * span * side, y, Math.sin(angle) * span * side],
      size: [span * 1.5, 0.06, span * 0.8],
      color: i % 2 === 0 ? color : shade(color, 0.12),
    });
  }

  return boxes;
}

/** Petal ring around a raised centre. Coneflowers, asters, black-eyed Susans. */
function daisy(plant: Plant): Box[] {
  const { bloomColor, height, leafColor } = plant;
  const boxes: Box[] = [stem(height, STEM), ...leaves(height, leafColor, 4, 0.28)];
  const petals = 8;
  const radius = 0.34;

  for (let i = 0; i < petals; i += 1) {
    const angle = (i / petals) * Math.PI * 2;

    boxes.push({
      position: [Math.cos(angle) * radius, height, Math.sin(angle) * radius],
      size: [0.22, 0.06, 0.22],
      // Alternating tint keeps the ring from reading as a flat disc.
      color: i % 2 === 0 ? bloomColor : tint(bloomColor, 0.14),
    });
  }

  boxes.push({
    position: [0, height + 0.05, 0],
    size: [0.28, 0.16, 0.28],
    color: "#8a5a22",
  });

  return boxes;
}

/** A tapering column of bloom. Goldenrod, cardinal flower, bergamot. */
function spike(plant: Plant): Box[] {
  const { bloomColor, height, leafColor } = plant;
  const boxes: Box[] = [stem(height, STEM), ...leaves(height, leafColor, 4, 0.24)];
  const tiers = 5;

  for (let i = 0; i < tiers; i += 1) {
    const t = i / (tiers - 1);
    const width = 0.42 - t * 0.26;
    const y = height * 0.62 + i * (height * 0.09);

    boxes.push({
      position: [0, y, 0],
      size: [width, height * 0.1, width],
      color: i % 2 === 0 ? bloomColor : shade(bloomColor, 0.1),
    });
  }

  return boxes;
}

/** A rounded dome of tiny florets. Milkweed, Joe-Pye weed. */
function umbel(plant: Plant): Box[] {
  const { bloomColor, height, leafColor } = plant;
  const boxes: Box[] = [
    stem(height, STEM, 0.11),
    ...leaves(height, leafColor, 5, 0.32),
  ];

  const clusters: [number, number, number, number][] = [
    [0, height + 0.08, 0, 0.42],
    [0.22, height - 0.02, 0.16, 0.26],
    [-0.24, height - 0.04, -0.12, 0.24],
    [0.06, height - 0.1, -0.26, 0.22],
    [-0.1, height - 0.08, 0.26, 0.2],
  ];

  for (const [x, y, z, size] of clusters) {
    boxes.push({
      position: [x, y, z],
      size: [size, size * 0.7, size],
      color: bloomColor,
    });
  }

  return boxes;
}

/** Broad leaves near the ground with a small bloom above. Woodland ephemerals. */
function low(plant: Plant): Box[] {
  const { bloomColor, height, leafColor } = plant;
  const boxes: Box[] = [stem(height * 0.7, STEM, 0.07)];
  const blades = 3;

  for (let i = 0; i < blades; i += 1) {
    const angle = (i / blades) * Math.PI * 2 + 0.4;

    boxes.push({
      position: [
        Math.cos(angle) * 0.3,
        height * 0.28,
        Math.sin(angle) * 0.3,
      ],
      size: [0.62, 0.07, 0.5],
      color: i === 1 ? shade(leafColor, 0.1) : leafColor,
    });
  }

  boxes.push({
    position: [0, height * 0.72, 0],
    size: [0.3, 0.16, 0.3],
    color: bloomColor,
  });
  boxes.push({
    position: [0, height * 0.82, 0],
    size: [0.18, 0.1, 0.18],
    color: tint(bloomColor, 0.2),
  });

  return boxes;
}

/** A woody mass flecked with bloom. Spicebush. */
function shrubForm(plant: Plant): Box[] {
  const { bloomColor, height, leafColor } = plant;

  return [
    { position: [0, height * 0.18, 0], size: [0.18, height * 0.36, 0.18], color: "#6b5136" },
    { position: [0, height * 0.55, 0], size: [1.7, height * 0.5, 1.6], color: leafColor },
    { position: [0.5, height * 0.8, -0.3], size: [1, height * 0.3, 0.9], color: tint(leafColor, 0.1) },
    { position: [-0.5, height * 0.75, 0.35], size: [0.9, height * 0.28, 0.85], color: shade(leafColor, 0.1) },
    { position: [0.35, height * 0.95, 0.3], size: [0.3, 0.2, 0.3], color: bloomColor },
    { position: [-0.45, height * 0.88, -0.35], size: [0.26, 0.18, 0.26], color: bloomColor },
    { position: [0, height * 1.02, -0.1], size: [0.24, 0.16, 0.24], color: bloomColor },
  ];
}

/** A small flowering tree. Redbud. */
function treeForm(plant: Plant): Box[] {
  const { bloomColor, height } = plant;

  return [
    { position: [0, height * 0.3, 0], size: [0.5, height * 0.6, 0.5], color: "#6b4f36" },
    { position: [0, height * 0.72, 0], size: [3.4, height * 0.34, 3.2], color: bloomColor },
    { position: [-1.1, height * 0.86, 0.5], size: [1.8, height * 0.22, 1.7], color: tint(bloomColor, 0.16) },
    { position: [1.2, height * 0.82, -0.6], size: [1.7, height * 0.2, 1.6], color: shade(bloomColor, 0.1) },
    // Cauliflory: blossom straight off the trunk, which is the whole point of a redbud.
    { position: [0.4, height * 0.42, 0.2], size: [0.5, 0.3, 0.5], color: bloomColor },
    { position: [-0.35, height * 0.55, -0.25], size: [0.45, 0.28, 0.45], color: bloomColor },
  ];
}

const BUILDERS: Record<Plant["archetype"], (plant: Plant) => Box[]> = {
  daisy,
  spike,
  umbel,
  low,
  shrub: shrubForm,
  tree: treeForm,
};

export function buildPlantGeometry(plant: Plant): BufferGeometry {
  return buildBoxGeometry(BUILDERS[plant.archetype](plant));
}

/**
 * The mote that hovers over an undiscovered plant. Without it, spotting flora
 * from flight height is guesswork; with it, the map reads as a set of things to
 * go and look at.
 */
export function buildMoteGeometry(): BufferGeometry {
  return buildBoxGeometry([
    { position: [0, 0, 0], size: [0.22, 0.22, 0.22], color: "#fff3c4" },
  ]);
}
