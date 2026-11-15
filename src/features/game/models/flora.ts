import type { BufferGeometry } from "three";

import type { Plant } from "../data/plants";
import { PLANT_FORMS, type PlantForm } from "./plant-forms";
import { leaves, stem } from "./plant-kit";
import type { Quality } from "./quality";
import { buildBoxGeometry } from "./voxel";
import { VoxelGrid, type Vec3 } from "./voxel-grid";

/**
 * Forty-three plants, forty-three shapes.
 *
 * This file used to say "sixteen plants, six shapes", and argued that
 * hand-modelling each flower would look no better. It did look no better, as
 * boxes. On a voxel grid fine enough to hold a petal it looks a great deal
 * better, and the game is about telling these plants apart, so each now has a
 * form of its own in `plant-forms.ts`. What is left here is the compiling.
 */

/**
 * Voxel size in the plant's own units: high, then low. A plant is scaled seven
 * to fifteen times when it is placed, so even the fine size is a block the bee
 * could sit on. Tall plants get proportionally larger blocks, or a nine-unit
 * witch-hazel would cost as much as the rest of the meadow.
 */
const VOXEL: Record<Quality, number> = { ultra: 0.025, high: 0.034, low: 0.18 };

function voxelFor(plant: Plant, quality: Quality) {
  // The woodland ephemerals are a hand high and all their character is in one
  // small flower, so they get the finest grid of anything in the park.
  const small = quality !== "low" && plant.height < 1.7 ? 0.85 : 1;

  return VOXEL[quality] * small * Math.max(1, plant.height / 2.6);
}

/** A plant nobody has drawn yet still gets a stem, some leaves and a flower. */
const fallback: PlantForm = (g, { bloomColor, height, leafColor }) => {
  const at = stem(g, [0, 0, 0], [0, height * 0.94, 0], 0.05, "#4a7a3f");

  leaves(g, at, leafColor, { from: 0.15, to: 0.7, count: 4, length: 0.4, width: 0.15 });
  g.ball(at(1), [0.2, 0.14, 0.2], bloomColor, { rough: 0.2 });

  return [0, height * 0.94 + 0.14, 0];
};

function draw(plant: Plant, quality: Quality) {
  const fine = quality !== "low";
  const grid = new VoxelGrid(voxelFor(plant, quality), 1, !fine);
  const perch = (PLANT_FORMS[plant.id] ?? fallback)(grid, plant);

  return { grid, perch };
}

export function buildPlantGeometry(plant: Plant, quality: Quality): BufferGeometry {
  return draw(plant, quality).grid.build({ grounded: true });
}

const perches = new Map<string, Vec3>();

/**
 * Where on the plant a bee sets down, in the plant's own units.
 *
 * Usually the top of the bloom, but not always: the mayapple's flower is in the
 * fork under its leaves, and landing on the leaf would be landing on the wrong
 * thing. Worked out once per species, on the coarse grid, since the answer does
 * not depend on how finely the petals are drawn.
 */
export function plantPerch(plant: Plant): Vec3 {
  let perch = perches.get(plant.id);

  if (!perch) {
    perch = draw(plant, "low").perch;
    perches.set(plant.id, perch);
  }

  return perch;
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

/**
 * A dry seed head: a swollen pod on a short neck, brown and unshowy.
 *
 * It is the flower's afterlife, and the mark that you were here when it bloomed.
 * A plant you pollinated wears one once its season has passed, so the milkweed you
 * worked in July is a pod in October, set because of you.
 */
export function buildSeedHeadGeometry(): BufferGeometry {
  return buildBoxGeometry([
    { position: [0, 0.02, 0], size: [0.05, 0.16, 0.05], color: "#6f5230" },
    { position: [0, 0.2, 0], size: [0.2, 0.26, 0.16], color: "#8a6a3c" },
    { position: [0, 0.36, 0], size: [0.12, 0.12, 0.1], color: "#9c7c48" },
  ]);
}
