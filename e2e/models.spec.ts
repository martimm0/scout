import { expect, test } from "@playwright/test";

import { FUNGI } from "../src/features/game/data/fungi";
import { PLANTS } from "../src/features/game/data/plants";
import { catalog, MODEL_SETS } from "../src/features/game/models/catalog";
import { plantPerch } from "../src/features/game/models/flora";
import { fungusPerch } from "../src/features/game/models/fungi";
import { FUNGUS_FORMS } from "../src/features/game/models/fungus-forms";
import { PLANT_FORMS } from "../src/features/game/models/plant-forms";
import { triangleCount } from "../src/features/game/models/voxel-grid";

/**
 * The models, checked as data.
 *
 * None of this needs a browser: a model is a function from a species to a mesh,
 * so it is built here in Node and measured. Two things are pinned. Every
 * species is its OWN shape, which is the whole point of the forms and exactly
 * what six shared templates could not give. And nothing costs more than its
 * budget, at either quality, because a fine voxel grid will happily produce a
 * hundred thousand triangles for one mushroom if nobody is counting.
 */

/** The most triangles one model of each set may have: high, then low. */
const BUDGET: Record<string, [number, number]> = {
  plants: [12_000, 2_400],
  fungi: [12_000, 2_400],
  foliage: [12_500, 1_200],
  landmarks: [12_000, 800],
};

/**
 * A model's outline as a coarse block of filled cells, with size divided out.
 *
 * Two models from one template scaled to different heights fill the same cells;
 * two different forms do not. Colour is ignored on purpose: a trillium and a
 * bloodroot are both white, and must still differ.
 */
function silhouette(positions: ArrayLike<number>) {
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];

  for (let i = 0; i < positions.length; i += 1) {
    min[i % 3] = Math.min(min[i % 3], positions[i]);
    max[i % 3] = Math.max(max[i % 3], positions[i]);
  }

  const cells = new Set<number>();
  const GRID = 10;

  for (let i = 0; i < positions.length; i += 3) {
    let key = 0;

    for (let axis = 0; axis < 3; axis += 1) {
      const span = max[axis] - min[axis] || 1;

      key = key * GRID + Math.min(GRID - 1, Math.floor(((positions[i + axis] - min[axis]) / span) * GRID));
    }

    cells.add(key);
  }

  return cells;
}

/** How much two outlines share, 0 nothing to 1 identical. */
function overlap(a: Set<number>, b: Set<number>) {
  let shared = 0;

  for (const cell of a) {
    if (b.has(cell)) {
      shared += 1;
    }
  }

  return shared / (a.size + b.size - shared);
}

test.describe("the models", () => {
  // Pure Node: once is enough, whichever browser project picked the file up.
  test.skip(({ browserName }) => browserName !== "chromium", "no browser involved");

  test("every plant and every fungus has a form of its own", () => {
    for (const plant of PLANTS) {
      expect(PLANT_FORMS[plant.id], `${plant.commonName} has no form`).toBeTruthy();
    }

    for (const fungus of FUNGI) {
      expect(FUNGUS_FORMS[fungus.id], `${fungus.commonName} has no form`).toBeTruthy();
    }
  });

  test("no two species share a silhouette", () => {
    for (const set of ["plants", "fungi"] as const) {
      const shapes = catalog(set).map((entry) => ({
        label: entry.label,
        cells: silhouette(entry.build("high").getAttribute("position").array),
      }));

      for (let i = 0; i < shapes.length; i += 1) {
        for (let k = i + 1; k < shapes.length; k += 1) {
          expect(
            overlap(shapes[i].cells, shapes[k].cells),
            `${shapes[i].label} and ${shapes[k].label} are the same shape`,
          ).toBeLessThan(0.8);
        }
      }
    }
  });

  test("every model is inside its triangle budget, at both qualities", () => {
    test.setTimeout(120_000);

    for (const set of MODEL_SETS) {
      const [high, low] = BUDGET[set];

      for (const entry of catalog(set)) {
        expect(triangleCount(entry.build("high")), `${entry.label}, high`).toBeLessThanOrEqual(high);
        expect(triangleCount(entry.build("low")), `${entry.label}, low`).toBeLessThanOrEqual(low);
      }
    }
  });

  test("low is always cheaper than high", () => {
    for (const set of MODEL_SETS) {
      for (const entry of catalog(set)) {
        expect(triangleCount(entry.build("low")), entry.label).toBeLessThan(
          triangleCount(entry.build("high")),
        );
      }
    }
  });

  test("a bee lands on the model, not above or below it", () => {
    for (const plant of PLANTS) {
      const geometry = catalog("plants").find((entry) => entry.id === plant.id)!.build("low");

      geometry.computeBoundingBox();

      const [, y] = plantPerch(plant);

      expect(y, `${plant.commonName} perch is under the ground`).toBeGreaterThan(0);
      expect(y, `${plant.commonName} perch floats over the plant`).toBeLessThanOrEqual(
        geometry.boundingBox!.max.y + 0.2,
      );
    }

    for (const fungus of FUNGI) {
      const geometry = catalog("fungi").find((entry) => entry.id === fungus.id)!.build("low");

      geometry.computeBoundingBox();

      const [, y] = fungusPerch(fungus);

      expect(y, `${fungus.commonName} perch is under the ground`).toBeGreaterThan(0);
      expect(y, `${fungus.commonName} perch floats over it`).toBeLessThanOrEqual(
        geometry.boundingBox!.max.y + 0.2,
      );
    }
  });
});
