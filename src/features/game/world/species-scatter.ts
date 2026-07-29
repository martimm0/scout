import { FUNGI, type Fungus } from "../data/fungi";
import { PLANTS, type Plant } from "../data/plants";
import { isActive, type TimeWindow } from "./daylight";
import { isInSeason, seasonWindow, type SeasonWindow } from "./season";
import {
  activePark,
  areaAt,
  areas,
  creekX,
  sample,
  terrainHeight,
  terrainSlope,
  waterLevel,
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
  /** The months it is out, read from the sourced bloom or fungus season. */
  season: SeasonWindow;
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

function homeOf(areaId: string) {
  const all = areas();

  return all.find((area) => area.id === areaId) ?? all[0];
}

/** True if this area is the park's water corridor: the creek, or the hollow. */
function isValley(areaId: string) {
  return areaId === activePark().valley.area.id;
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

    if (isValley(areaId)) {
      // Hug the water: a point along it, then out to one bank.
      //
      // The offsets are a FRACTION of the valley's own half-width, not the two
      // fixed numbers that used to be here. Those were Nine Mile Run's, and they
      // reached out to 86 units in a hollow that is only 58 wide, so every
      // candidate past the rim was rejected for standing in a different area than
      // the one it was being planted in. Staying inside the corridor keeps the
      // sampler and `areaAt` telling the same story.
      const { world: bounds, valley } = activePark();
      const along = bounds.minZ + sample(seed, count, 11) * (bounds.maxZ - bounds.minZ);
      const side = sample(seed, count, 12) < 0.5 ? -1 : 1;
      const offset =
        valley.halfWidth * (0.35 + sample(seed, count, 13) * 0.57);
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

    // A ravine's banks run steeper than anywhere else in the park. Holding them
    // to the meadow's slope limit rejected every single candidate, which quietly
    // left jewelweed, cardinal flower, Joe-Pye weed and the bluebells nowhere in
    // the world at all: four plants in the journal that could never be found, and
    // an "all sixteen" badge nobody could ever earn. Creekside plants grow on
    // banks. That is the entire point of them.
    const limit = isValley(areaId)
      ? activePark().valley.bankSlopeLimit
      : slopeLimit;

    if (height < waterLevel() + 6 || terrainSlope(x, z) > limit) {
      continue;
    }

    spots.push({ x, z, height, seed });
    placed += 1;
  }

  return spots;
}

export function scatterSpecies(): SpeciesInstance[] {
  const instances: SpeciesInstance[] = [];

  const park = activePark().id;

  for (const plant of PLANTS) {
    // Only the homes in THIS park. A species with no home here simply does not
    // grow here, which is the whole point of two parks with different flora.
    const home = plant.homes.find((entry) => entry.park === park);

    if (!home) {
      continue;
    }

    const spots = place(home.area, plant.count, 0, 0.75);
    const season = seasonWindow(plant.bloom);

    spots.forEach((spot, index) => {
      instances.push({
        key: `plant-${plant.id}-${index}`,
        species: { kind: "plant", plant },
        id: plant.id,
        commonName: plant.commonName,
        hook: plant.hook,
        window: plant.window,
        season,
        height: plant.height,
        position: [spot.x, spot.height - 0.6, spot.z],
        rotation: sample(spot.seed, plant.count, 16) * Math.PI * 2,
        scale: PLANT_SCALE * (0.85 + sample(spot.seed, plant.count, 17) * 0.35),
      });
    });
  }

  for (const fungus of FUNGI) {
    const home = fungus.homes.find((entry) => entry.park === park);

    if (!home) {
      continue;
    }

    // Fungi live on rotting wood and shaded ground, so they tolerate steeper,
    // rougher places than a flower will.
    const spots = place(home.area, fungus.count, 1, 0.95);
    const season = seasonWindow(fungus.season);

    spots.forEach((spot, index) => {
      instances.push({
        key: `fungus-${fungus.id}-${index}`,
        species: { kind: "fungus", fungus },
        id: fungus.id,
        commonName: fungus.commonName,
        hook: fungus.hook,
        window: fungus.window,
        season,
        height: fungus.height,
        position: [spot.x, spot.height - 0.4, spot.z],
        rotation: sample(spot.seed, fungus.count, 18) * Math.PI * 2,
        scale: FUNGUS_SCALE * (0.8 + sample(spot.seed, fungus.count, 19) * 0.5),
      });
    });
  }

  return instances;
}

/**
 * Whether a species can be WORKED right now: open at this hour and, for a flower,
 * actually in bloom. This is the question the Pollinate button asks. For what can
 * be FOUND, which is a different question, see `isFindable` below.
 */
export function isOut(
  instance: SpeciesInstance,
  hour: number,
  month: number,
): boolean {
  return isActive(instance.window, hour) && isInSeason(instance.season, month);
}

/**
 * Whether a species can be FOUND right now, which is a different question from
 * whether it can be worked, and conflating the two was a bad bug.
 *
 * A plant that is not flowering has not gone anywhere. A trout lily is still a
 * trout lily in July: leaves, and a name, and an entry worth reading. Gating
 * DISCOVERY on the bloom meant only seven of Frick's sixteen plants existed at all
 * in July, so a player could never reach the eight discoveries Schenley asks for,
 * and the game quietly soft-locked for anyone who started in the wrong month.
 *
 * A fungus is the opposite, and there the season really does gate it: mushrooms
 * come up and rot away, so one out of season is genuinely not there, and drawing a
 * ghost of it would be teaching a lie.
 *
 * So the journal fills all year round, and only the pollinating waits for the
 * bloom.
 */
export function isFindable(
  instance: SpeciesInstance,
  hour: number,
  month: number,
): boolean {
  if (!isActive(instance.window, hour)) {
    return false;
  }

  return instance.species.kind === "plant" || isInSeason(instance.season, month);
}

/** Where a bee would actually land on it: on top of the bloom, or the cap. */
export function landingHeight(instance: SpeciesInstance) {
  return instance.position[1] + instance.height * instance.scale;
}
