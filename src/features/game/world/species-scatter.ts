import { FUNGI, type Fungus } from "../data/fungi";
import { PLANTS, type Plant } from "../data/plants";
import type { TimeWindow } from "./daylight";
import {
  areaAt,
  creekX,
  sample,
  terrainHeight,
  terrainSlope,
  WATER_LEVEL,
  AREAS,
  RAVINE_AREA,
} from "./terrain";

/**
 * Everything you can find in the park: flowers and fungi, in one list.
 *
 * They are different organisms and the game treats them differently at the point
 * of interaction (you pollinate a flower; you cannot pollinate a mushroom). But
 * for scattering, discovering, tagging and journalling they are the same thing,
 * so they share one type and one code path rather than two of everything.
 */

export type Species =
  | { kind: "plant"; plant: Plant }
  | { kind: "fungus"; fungus: Fungus };

export type SpeciesInstance = {
  key: string;
  species: Species;
  /** The id of the plant or fungus. Unique across both, by construction. */
  id: string;
  commonName: string;
  hook: string;
  window: TimeWindow;
  /** Authored height, before world scale. */
  height: number;
  position: [number, number, number];
  rotation: number;
  /** Final world scale. */
  scale: number;
};

/** Flowers are authored around a two-unit stalk and grown to insect scale. */
export const PLANT_SCALE = 8;

/**
 * Fungi are authored small and grown further, because a mushroom really is
 * enormous next to a bee. A giant puffball at this scale is a hill.
 */
export const FUNGUS_SCALE = 12;

/** How close you have to get before something counts as found. */
export const DISCOVERY_RADIUS = 9;

/** The creek banks are steep. Anything gentler than this excludes the habitat. */
const BANK_SLOPE_LIMIT = 1.4;

function homeOf(areaId: string) {
  if (areaId === "nine-mile-run") {
    return RAVINE_AREA;
  }

  return AREAS.find((area) => area.id === areaId) ?? AREAS[0];
}

/**
 * Rejection-sample positions inside a habitat: keep drawing candidates until one
 * lands in the right area, on ground that is not a cliff or a creek bed.
 * Deterministic, so the park is laid out the same way every visit and a player
 * can learn where things are and come back to them.
 */
function place(
  areaId: string,
  count: number,
  seedChannel: number,
  slopeLimit: number,
) {
  const home = homeOf(areaId);
  const spots: { x: number; z: number; height: number; seed: number }[] = [];

  let placed = 0;
  let attempt = 0;

  while (placed < count && attempt < 900) {
    const seed = attempt + placed * 31 + seedChannel * 977;
    attempt += 1;

    let x: number;
    let z: number;

    if (areaId === "nine-mile-run") {
      // Hug the creek: a point along it, then out to one bank. Starting at 34
      // rather than 26 keeps them out of the water: inside about 30 units of the
      // channel the ground is still below the waterline.
      const along = -240 + sample(seed, count, 11) * 480;
      const side = sample(seed, count, 12) < 0.5 ? -1 : 1;
      const offset = 34 + sample(seed, count, 13) * 52;
      x = creekX(along) + side * offset;
      z = along;
    } else {
      const angle = sample(seed, count, 14) * Math.PI * 2;
      const radius = 30 + sample(seed, count, 15) * 90;
      x = home.center[0] + Math.cos(angle) * radius;
      z = home.center[1] + Math.sin(angle) * radius;
    }

    if (areaAt(x, z).id !== areaId) {
      continue;
    }

    const height = terrainHeight(x, z);

    // Nine Mile Run is a ravine, and its banks run steeper than anywhere else in
    // the park. Holding them to the meadow's slope limit rejected every single
    // candidate, which quietly left jewelweed, cardinal flower, Joe-Pye weed and
    // the bluebells nowhere in the world at all: four plants in the journal that
    // could never be found, and an "all sixteen" badge nobody could ever earn.
    // Creekside plants grow on banks. That is the entire point of them.
    const limit = areaId === "nine-mile-run" ? BANK_SLOPE_LIMIT : slopeLimit;

    if (height < WATER_LEVEL + 6 || terrainSlope(x, z) > limit) {
      continue;
    }

    spots.push({ x, z, height, seed });
    placed += 1;
  }

  return spots;
}

export function scatterSpecies(): SpeciesInstance[] {
  const instances: SpeciesInstance[] = [];

  for (const plant of PLANTS) {
    const spots = place(plant.area, plant.count, 0, 0.75);

    spots.forEach((spot, index) => {
      instances.push({
        key: `plant-${plant.id}-${index}`,
        species: { kind: "plant", plant },
        id: plant.id,
        commonName: plant.commonName,
        hook: plant.hook,
        window: plant.window,
        height: plant.height,
        position: [spot.x, spot.height - 0.6, spot.z],
        rotation: sample(spot.seed, plant.count, 16) * Math.PI * 2,
        scale: PLANT_SCALE * (0.85 + sample(spot.seed, plant.count, 17) * 0.35),
      });
    });
  }

  for (const fungus of FUNGI) {
    // Fungi live on rotting wood and shaded ground, so they tolerate steeper,
    // rougher places than a flower will.
    const spots = place(fungus.area, fungus.count, 1, 0.95);

    spots.forEach((spot, index) => {
      instances.push({
        key: `fungus-${fungus.id}-${index}`,
        species: { kind: "fungus", fungus },
        id: fungus.id,
        commonName: fungus.commonName,
        hook: fungus.hook,
        window: fungus.window,
        height: fungus.height,
        position: [spot.x, spot.height - 0.4, spot.z],
        rotation: sample(spot.seed, fungus.count, 18) * Math.PI * 2,
        scale: FUNGUS_SCALE * (0.8 + sample(spot.seed, fungus.count, 19) * 0.5),
      });
    });
  }

  return instances;
}

/** Where a bee would actually land on it: on top of the bloom, or the cap. */
export function landingHeight(instance: SpeciesInstance) {
  return instance.position[1] + instance.height * instance.scale;
}
