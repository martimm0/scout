import type { Placement } from "./scatter";
import { sample, terrainHeight, terrainSlope, waterLevel, world } from "./terrain";

/**
 * Where the water's edge is, as places to put things.
 *
 * Walks a coarse grid and keeps the cells the waterline actually passes
 * through: ground just above the water gets pebbles, water just off the bank
 * gets the odd lily pad. Deterministic, like every other scatter, so the same
 * stones are on the same bank for everybody.
 */
const CELL = 6;

export function scatterShore(): { pebbles: Placement[]; lilyPads: Placement[] } {
  const pebbles: Placement[] = [];
  const lilyPads: Placement[] = [];
  const water = waterLevel();

  for (let x = world().minX; x <= world().maxX; x += CELL) {
    for (let z = world().minZ; z <= world().maxZ; z += CELL) {
      const px = x + (sample(x, z, 41) - 0.5) * CELL;
      const pz = z + (sample(x, z, 42) - 0.5) * CELL;
      const height = terrainHeight(px, pz);
      const above = height - water;

      if (above > -0.3 && above < 2.2 && terrainSlope(px, pz) < 1.2 && sample(x, z, 43) < 0.7) {
        pebbles.push({
          position: [px, height - 0.15, pz],
          rotation: sample(x, z, 44) * Math.PI * 2,
          scale: 0.6 + sample(x, z, 45) * 0.9,
        });
      } else if (above < -0.8 && above > -5 && sample(x, z, 46) < 0.16) {
        // Floating: on the surface, whatever the bed is doing underneath.
        lilyPads.push({
          position: [px, water + 0.04, pz],
          rotation: sample(x, z, 47) * Math.PI * 2,
          scale: 0.7 + sample(x, z, 48) * 0.7,
        });
      }
    }
  }

  return { pebbles, lilyPads };
}
