import { PLANTS, type Plant } from "../data/plants";
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

export type PlantInstance = {
  /** Unique per placement; several instances share one plant id. */
  key: string;
  plant: Plant;
  position: [number, number, number];
  rotation: number;
  /** Final world scale, already multiplied by PLANT_SCALE. */
  scale: number;
};

/**
 * Flowers are authored at roughly human scale (a two-unit stalk) and then grown
 * to the scale of the world the bee actually lives in. A milkweed ends up around
 * eighteen units tall against a bee under one unit long — you fly *up* a flower.
 */
export const PLANT_SCALE = 8;

/**
 * How close the bee has to get to a bloom before it counts as found.
 *
 * This was 9, which sounds generous until you remember the world is 700x520 and
 * a flower is a needle in it. A bee could cross three whole areas without ever
 * passing within 9 units of a bloom — verified by flying it. Twenty-two is about
 * one flower-height of slack, which is close enough to feel deliberate and loose
 * enough that arriving at a plant actually registers.
 */
export const DISCOVERY_RADIUS = 22;

/**
 * Rejection-samples positions inside each plant's home habitat: keep drawing
 * candidate points until one lands in the right area, on ground that isn't a
 * cliff or a creek bed. Deterministic — the park is laid out the same way on
 * every load, so a player can learn where things are and come back to them.
 */
export function scatterPlants(): PlantInstance[] {
  const instances: PlantInstance[] = [];

  for (const plant of PLANTS) {
    const home =
      plant.area === "nine-mile-run"
        ? RAVINE_AREA
        : (AREAS.find((area) => area.id === plant.area) ?? AREAS[0]);

    let placed = 0;
    let attempt = 0;

    // Bounded so a bad habitat definition can't spin forever; a species that
    // can't find room simply ends up with fewer instances.
    while (placed < plant.count && attempt < 900) {
      const seed = attempt + placed * 31;
      attempt += 1;

      let x: number;
      let z: number;

      if (plant.area === "nine-mile-run") {
        // Hug the creek: pick a point along it, then step out to one bank.
        const along = -240 + sample(seed, plant.count, 11) * 480;
        const side = sample(seed, plant.count, 12) < 0.5 ? -1 : 1;
        const offset = 26 + sample(seed, plant.count, 13) * 34;
        x = creekX(along) + side * offset;
        z = along;
      } else {
        const angle = sample(seed, plant.count, 14) * Math.PI * 2;
        const radius = 30 + sample(seed, plant.count, 15) * 90;
        x = home.center[0] + Math.cos(angle) * radius;
        z = home.center[1] + Math.sin(angle) * radius;
      }

      if (areaAt(x, z).id !== plant.area) {
        continue;
      }

      const height = terrainHeight(x, z);

      if (height < WATER_LEVEL + 6 || terrainSlope(x, z) > 0.75) {
        continue;
      }

      instances.push({
        key: `${plant.id}-${placed}`,
        plant,
        position: [x, height - 0.6, z],
        rotation: sample(seed, plant.count, 16) * Math.PI * 2,
        scale: PLANT_SCALE * (0.85 + sample(seed, plant.count, 17) * 0.35),
      });

      placed += 1;
    }
  }

  return instances;
}
