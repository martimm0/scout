import type { FoliageKind } from "../models/foliage";
import {
  activePark,
  areaAt,
  creekX,
  sample,
  terrainHeight,
  terrainSlope,
  trailStrength,
  waterLevel,
  world,
} from "./terrain";
import type { Biome } from "./park";

export type Placement = {
  position: [number, number, number];
  rotation: number;
  scale: number;
};

/** Spacing of the candidate grid for trees and large props. */
const CELL = 19;

/** Grass gets its own, much finer grid, it has to be everywhere. */
const GRASS_CELL = 7;

/**
 * How likely a tree-sized cell is to grow something. Fern Hollow earns its name;
 * the bowling green stays clipped, because a bowling green with a tree on it
 * isn't a bowling green.
 */

/** Anything steeper than this is bare, trees don't grow on the cliff faces. */
const MAX_SLOPE = 0.9;

/**
 * What grows where.
 *
 * Not a uniform sprinkle: the deep woods get mushrooms and leaf litter and
 * fallen branches, the creek margin gets cattails and knotweed, and the mown
 * lawns get clover and acorns. Reading the ground should tell you where you are
 * before you look up.
 */
function pickKind(biome: Biome, roll: number): FoliageKind {
  if (biome === "deep-woods") {
    if (roll < 0.22) return "hemlock";
    if (roll < 0.36) return "oak";
    if (roll < 0.54) return "fern";
    if (roll < 0.63) return "shrub";
    if (roll < 0.7) return "log";
    if (roll < 0.79) return "mushroom";
    if (roll < 0.88) return "leafLitter";
    if (roll < 0.95) return "branch";
    return "snag";
  }

  if (biome === "slope-woods") {
    if (roll < 0.3) return "hemlock";
    if (roll < 0.45) return "oak";
    if (roll < 0.56) return "fern";
    if (roll < 0.64) return "shrub";
    if (roll < 0.7) return "log";
    if (roll < 0.78) return "mushroom";
    if (roll < 0.86) return "leafLitter";
    if (roll < 0.92) return "branch";
    if (roll < 0.97) return "stump";
    return "snag";
  }

  if (biome === "valley-floor") {
    // The valley floor. Damp, disturbed, and losing ground to knotweed.
    if (roll < 0.2) return "oak";
    if (roll < 0.32) return "shrub";
    if (roll < 0.44) return "fern";
    if (roll < 0.56) return "log";
    if (roll < 0.72) return "knotweed";
    if (roll < 0.82) return "cattail";
    if (roll < 0.9) return "branch";
    if (roll < 0.96) return "mushroom";
    return "stump";
  }

  // The mown, managed places: specimen trees, acorns under them, clover between.
  if (roll < 0.3) return "oak";
  if (roll < 0.42) return "shrub";
  if (roll < 0.62) return "acorn";
  if (roll < 0.88) return "clover";
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
    mushroom: [],
    cattail: [],
    branch: [],
    leafLitter: [],
    clover: [],
    knotweed: [],
  };
}

/**
 * Walks a grid over the world and decides, deterministically, what grows where.
 * Nothing is placed underwater, on a cliff, or in the creek channel itself.
 */
export function scatterFoliage(): FoliageScatter {
  const park = activePark();
  const result = empty();

  for (let x = world().minX; x <= world().maxX; x += CELL) {
    for (let z = world().minZ; z <= world().maxZ; z += CELL) {
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
        height > waterLevel() - 6 &&
        sample(x, z, 6) < 0.42
      ) {
        result.rock.push({
          position: [px, height - 1, pz],
          rotation: sample(x, z, 7) * Math.PI * 2,
          scale: 0.6 + sample(x, z, 8) * 1.1,
        });
        continue;
      }

      // Cattails and knotweed crowd the water's edge, that's the whole point of
      // both of them, so they get placed closer in than anything else.
      if (
        area === "nine-mile-run" &&
        channel >= 12 &&
        channel < 30 &&
        height > waterLevel() + 1
      ) {
        const bank = sample(x, z, 11);

        result[bank < 0.55 ? "knotweed" : "cattail"].push({
          position: [px, height - 1, pz],
          rotation: sample(x, z, 12) * Math.PI * 2,
          scale: 0.8 + sample(x, z, 13) * 0.5,
        });
        continue;
      }

      // Keep the creek channel clear so the valley stays flyable.
      if (channel < 22 || height < waterLevel() + 4) {
        continue;
      }

      if (terrainSlope(px, pz) > MAX_SLOPE) {
        continue;
      }

      // Trails are walked bare. A hemlock in the middle of the path is not a
      // trail, and the whole point of them is that you can follow one.
      if (trailStrength(px, pz) > 0.45) {
        continue;
      }

      if (sample(x, z, 3) > (park.density[area] ?? 0.3)) {
        continue;
      }

      const kind = pickKind(park.biome[area] ?? "mown", sample(x, z, 4));

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
  const park = activePark();
  const blades: Placement[] = [];

  for (let x = world().minX; x <= world().maxX; x += GRASS_CELL) {
    for (let z = world().minZ; z <= world().maxZ; z += GRASS_CELL) {
      const px = x + (sample(x, z, 21) - 0.5) * GRASS_CELL;
      const pz = z + (sample(x, z, 22) - 0.5) * GRASS_CELL;

      const height = terrainHeight(px, pz);

      if (height < waterLevel() + 2) {
        continue;
      }

      /**
       * Bare on the cliffs, thin in deep shade, thick on the mown grass.
       *
       * Keyed off the BIOME, not off Frick's area names. This still read
       * `area === "fern-hollow"` after `pickKind` had been fixed, which meant
       * every area of every other park fell through to 0.7 and grew grass. In
       * Highland that put a lawn on the surface of the city's drinking water:
       * the reservoirs are declared at density 0 and the foliage scatter honours
       * that, but the grass scatter had never heard of it.
       */
      const area = areaAt(px, pz).id;
      const biome = park.biome[area] ?? "mown";
      const planted = park.density[area] ?? 0.3;

      // Nothing grows where nothing grows. A park that says an area is bare
      // means it.
      if (planted <= 0) {
        continue;
      }

      const density =
        biome === "deep-woods" || biome === "slope-woods"
          ? 0.35
          : biome === "mown"
            ? Math.min(0.95, 0.5 + planted)
            : 0.7;

      // Grass gets worn off the trails too, though not as completely.
      if (
        terrainSlope(px, pz) > 1 ||
        sample(x, z, 23) > density * (1 - trailStrength(px, pz) * 0.85)
      ) {
        continue;
      }

      blades.push({
        position: [px, height - 0.5, pz],
        rotation: sample(x, z, 24) * Math.PI * 2,
        // A mown lawn is clipped short. Everywhere else runs wild.
        scale:
          (biome === "mown" && planted < 0.25 ? 0.35 : 0.7) +
          sample(x, z, 25) * 0.75,
      });
    }
  }

  return blades;
}
