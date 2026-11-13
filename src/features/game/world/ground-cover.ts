import type { CoverKind } from "../models/ground-cover";
import type { Placement } from "./scatter";
import {
  activePark,
  areaAt,
  columnTop,
  sample,
  terrainHeight,
  terrainSlope,
  trailStrength,
  waterLevel,
  world,
} from "./terrain";

/**
 * Where the small stuff goes. Deterministic, like every other scatter.
 *
 * Wildflowers in the open, fallen leaves under the trees, stones along the
 * trails where feet have kicked them. Nothing on a cliff, in the water, or
 * anywhere a park says nothing grows.
 */
const CELL = 5;

export function scatterCover(): Record<CoverKind, Placement[]> {
  const park = activePark();
  const out: Record<CoverKind, Placement[]> = {
    buttercup: [],
    violet: [],
    daisy: [],
    tuft: [],
    leaves: [],
    stone: [],
  };

  for (let x = world().minX; x <= world().maxX; x += CELL) {
    for (let z = world().minZ; z <= world().maxZ; z += CELL) {
      const px = x + (sample(x, z, 51) - 0.5) * CELL;
      const pz = z + (sample(x, z, 52) - 0.5) * CELL;
      const height = terrainHeight(px, pz);
      const area = areaAt(px, pz).id;
      const planted = park.density[area] ?? 0.3;

      if (height < waterLevel() + 2 || terrainSlope(px, pz) > 0.9 || planted <= 0) {
        continue;
      }

      const roll = sample(x, z, 53);
      const biome = park.biome[area] ?? "mown";
      const woods = biome === "deep-woods" || biome === "slope-woods";
      const trodden = trailStrength(px, pz);
      let kind: CoverKind | null = null;

      if (trodden > 0.5) {
        // Bare, apart from what has been kicked to the edge of it.
        kind = roll < 0.12 ? "stone" : null;
      } else if (woods) {
        kind = roll < 0.3 ? "leaves" : roll < 0.36 ? "violet" : roll < 0.42 ? "stone" : null;
      } else {
        kind =
          roll < 0.1 ? "buttercup" : roll < 0.19 ? "daisy" : roll < 0.25 ? "violet" : roll < 0.4 ? "tuft" : roll < 0.43 ? "stone" : null;
      }

      if (kind) {
        out[kind].push({
          // On the step as it is drawn (this is the fine park's alone), and
          // sunk a hair so nothing shows daylight under it.
          position: [px, columnTop(px, pz) - 0.1, pz],
          rotation: sample(x, z, 54) * Math.PI * 2,
          scale: 0.7 + sample(x, z, 55) * 0.8,
        });
      }
    }
  }

  return out;
}
