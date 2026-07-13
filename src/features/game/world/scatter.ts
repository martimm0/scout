import type { FoliageKind } from "../models/foliage";
import {
  areaAt,
  creekX,
  sample,
  terrainHeight,
  terrainSlope,
  WATER_LEVEL,
  WORLD,
  type AreaId,
} from "./terrain";

export type Placement = {
  position: [number, number, number];
  rotation: number;
  scale: number;
};

/** Spacing of the candidate grid for trees and large props. */
const CELL = 26;

/** Grass gets its own, much finer grid — it has to be everywhere. */
const GRASS_CELL = 7;

/**
 * How likely a tree-sized cell is to grow something. Fern Hollow earns its name;
 * the bowling green stays clipped, because a bowling green with a tree on it
 * isn't a bowling green.
 */
const DENSITY: Record<AreaId, number> = {
  "fern-hollow": 0.72,
  "falls-ravine": 0.5,
  "nine-mile-run": 0.22,
  "environmental-center": 0.12,
  "blue-slide": 0.16,
  "bowling-green": 0.06,
};

/** Anything steeper than this is bare — trees don't grow on the cliff faces. */
const MAX_SLOPE = 0.9;

function pickKind(area: AreaId, roll: number): FoliageKind {
  if (area === "fern-hollow") {
    if (roll < 0.3) return "hemlock";
    if (roll < 0.5) return "oak";
    if (roll < 0.74) return "fern";
    if (roll < 0.85) return "shrub";
    if (roll < 0.93) return "log";
    return "snag";
  }

  if (area === "falls-ravine") {
    if (roll < 0.42) return "hemlock";
    if (roll < 0.62) return "oak";
    if (roll < 0.74) return "fern";
    if (roll < 0.84) return "shrub";
    if (roll < 0.9) return "log";
    if (roll < 0.96) return "stump";
    return "snag";
  }

  if (area === "nine-mile-run") {
    if (roll < 0.3) return "oak";
    if (roll < 0.46) return "shrub";
    if (roll < 0.62) return "fern";
    if (roll < 0.78) return "log";
    return "stump";
  }

  // The mown, managed places: scattered specimen trees, and acorns beneath them.
  if (roll < 0.42) return "oak";
  if (roll < 0.58) return "shrub";
  if (roll < 0.86) return "acorn";
  return "stump";
}

export type FoliageScatter = Record<FoliageKind, Placement[]>;

function empty(): FoliageScatter {
  return {
    hemlock: [],
    oak: [],
    shrub: [],
    log: [],
    stump: [],
    acorn: [],
    rock: [],
    snag: [],
    fern: [],
    grass: [],
  };
}

/**
 * Walks a grid over the world and decides, deterministically, what grows where.
 * Nothing is placed underwater, on a cliff, or in the creek channel itself.
 */
export function scatterFoliage(): FoliageScatter {
  const result = empty();

  for (let x = WORLD.minX; x <= WORLD.maxX; x += CELL) {
    for (let z = WORLD.minZ; z <= WORLD.maxZ; z += CELL) {
      // Jitter off the grid, or the forest lines up in rows.
      const px = x + (sample(x, z, 1) - 0.5) * CELL * 0.9;
      const pz = z + (sample(x, z, 2) - 0.5) * CELL * 0.9;

      const area = areaAt(px, pz).id;
      const height = terrainHeight(px, pz);
      const channel = Math.abs(px - creekX(pz));

      // Stones in and along the creek bed.
      if (
        area === "nine-mile-run" &&
        channel < 34 &&
        height > WATER_LEVEL - 6 &&
        sample(x, z, 6) < 0.42
      ) {
        result.rock.push({
          position: [px, height - 1, pz],
          rotation: sample(x, z, 7) * Math.PI * 2,
          scale: 0.6 + sample(x, z, 8) * 1.1,
        });
        continue;
      }

      // Keep the creek channel clear so the valley stays flyable.
      if (channel < 22 || height < WATER_LEVEL + 4) {
        continue;
      }

      if (terrainSlope(px, pz) > MAX_SLOPE) {
        continue;
      }

      if (sample(x, z, 3) > DENSITY[area]) {
        continue;
      }

      const kind = pickKind(area, sample(x, z, 4));

      result[kind].push({
        position: [px, height - 1.5, pz],
        rotation: sample(x, z, 9) * Math.PI * 2,
        scale: 0.75 + sample(x, z, 10) * 0.55,
      });
    }
  }

  return result;
}

/**
 * Grass, everywhere it can grow. This is the model that does the most work in
 * the whole park: a lawn is nothing to a person and a forest to a bee, and
 * without it you have no sense of how small you are.
 */
export function scatterGrass(): Placement[] {
  const blades: Placement[] = [];

  for (let x = WORLD.minX; x <= WORLD.maxX; x += GRASS_CELL) {
    for (let z = WORLD.minZ; z <= WORLD.maxZ; z += GRASS_CELL) {
      const px = x + (sample(x, z, 21) - 0.5) * GRASS_CELL;
      const pz = z + (sample(x, z, 22) - 0.5) * GRASS_CELL;

      const height = terrainHeight(px, pz);

      if (height < WATER_LEVEL + 2) {
        continue;
      }

      // Bare on the cliffs, thin in deep shade, thick on the mown grass.
      const area = areaAt(px, pz).id;
      const density =
        area === "fern-hollow" || area === "falls-ravine"
          ? 0.35
          : area === "bowling-green"
            ? 0.95
            : 0.7;

      if (terrainSlope(px, pz) > 1 || sample(x, z, 23) > density) {
        continue;
      }

      blades.push({
        position: [px, height - 0.5, pz],
        rotation: sample(x, z, 24) * Math.PI * 2,
        // The bowling green is clipped short. Everywhere else runs wild.
        scale:
          (area === "bowling-green" ? 0.35 : 0.7) + sample(x, z, 25) * 0.75,
      });
    }
  }

  return blades;
}
