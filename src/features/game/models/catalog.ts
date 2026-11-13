import type { BufferGeometry } from "three";

import { FUNGI } from "../data/fungi";
import { PLANTS } from "../data/plants";
import { buildPlantGeometry } from "./flora";
import { buildFoliageKind, foliageVariants, type FoliageKind } from "./foliage";
import { buildFungusGeometry } from "./fungi";
import { buildLandmark, LANDMARK_KINDS } from "./landmarks";
import type { Quality } from "./quality";

/**
 * Every model in the park, by name, for looking at.
 *
 * The game only ever shows a model where the scatter happened to put it, at
 * whatever hour it happens to be. Checking sixty species that way means sixty
 * flights. This is the same builders with nothing else attached, so the gallery
 * page can lay them out side by side and a spec can count their triangles
 * without starting a renderer.
 */
export type ModelSet = "plants" | "fungi" | "foliage" | "landmarks";

export const MODEL_SETS: readonly ModelSet[] = ["plants", "fungi", "foliage", "landmarks"];

export type CatalogEntry = {
  set: ModelSet;
  id: string;
  label: string;
  build: (quality: Quality) => BufferGeometry;
};

const FOLIAGE_KINDS: FoliageKind[] = [
  "hemlock", "oak", "shrub", "log", "stump", "acorn", "rock", "snag",
  "fern", "grass", "mushroom", "cattail", "branch", "leafLitter", "clover", "knotweed",
];

export function catalog(set: ModelSet): CatalogEntry[] {
  if (set === "plants") {
    return PLANTS.map((plant) => ({
      set,
      id: plant.id,
      label: plant.commonName,
      build: (quality) => buildPlantGeometry(plant, quality),
    }));
  }

  if (set === "fungi") {
    return FUNGI.map((fungus) => ({
      set,
      id: fungus.id,
      label: fungus.commonName,
      build: (quality) => buildFungusGeometry(fungus, quality),
    }));
  }

  if (set === "landmarks") {
    return LANDMARK_KINDS.map((kind) => ({
      set,
      id: kind,
      label: kind,
      build: (quality) => buildLandmark(kind, quality),
    }));
  }

  return FOLIAGE_KINDS.flatMap((kind) =>
    Array.from({ length: kind === "grass" ? 1 : foliageVariants("high") }, (_, variant) => ({
      set,
      id: `${kind}-${variant}`,
      label: `${kind} ${variant + 1}`,
      build: (quality: Quality) => buildFoliageKind(kind, quality, variant),
    })),
  );
}
