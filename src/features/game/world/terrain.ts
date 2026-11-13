import {
  allAreas,
  hash,
  smoothstep,
  trailPointsOf,
  type Area,
  type Park,
  type ParkId,
} from "./park";
import { FRICK } from "./parks/frick";
import { HIGHLAND } from "./parks/highland";
import { SCHENLEY } from "./parks/schenley";

/**
 * The park you are currently in.
 *
 * Every world function here reads the active park rather than a set of constants
 * baked into this file. The park is set once, before the scene mounts, and the
 * caches that hang off it (the collision grid, the scatter, the terrain mesh) are
 * keyed by park id rather than merely invalidated, because a cache that is
 * invalidated on switch is a cache that is stale on the switch somebody forgets.
 *
 * `terrainHeight`, `areaAt` and friends keep the names they always had, so the
 * hundreds of call sites in the frame loop, the scatter and the collision grid did
 * not have to learn about parks in order to keep working.
 */

export const PARKS: Record<ParkId, Park> = {
  frick: FRICK,
  schenley: SCHENLEY,
  highland: HIGHLAND,
};

export const PARK_LIST: Park[] = [FRICK, SCHENLEY, HIGHLAND];

let active: Park = FRICK;

export function activePark(): Park {
  return active;
}

export function setActivePark(id: ParkId) {
  active = PARKS[id] ?? FRICK;
}

export type { Area, Park, ParkId };

/**
 * An area id.
 *
 * Deliberately a bare string rather than the closed union it used to be. That
 * union named the six Frick areas, which meant a second park's areas could not be
 * typed at all, and it had leaked into the plant and fungus records, the scatter
 * densities and the biome colours.
 *
 * Area ids are globally unique across parks by construction: they are real place
 * names, and there is no Panther Hollow in Frick.
 */
export type AreaId = string;

/** How far above the ground the bee is stopped from descending. */
export const GROUND_CLEARANCE = 0.6;

export function world() {
  return active.world;
}

export function waterLevel() {
  return active.waterLevel;
}

export function ceiling() {
  return active.ceiling;
}

export function startPosition(): [number, number, number] {
  return active.start;
}

/** Every area in the active park, valley included. */
export function areas(): Area[] {
  return allAreas(active);
}

export function landmarks() {
  return active.landmarks;
}

/** The centre line of whatever water this park has. */
export function creekX(z: number) {
  return active.valley.centreLine(z);
}

export function terrainHeight(x: number, z: number) {
  return active.height(x, z);
}

/** How wide one column of the fine park's voxel ground is. */
export const GROUND_COLUMN = 2;

/**
 * The top of the voxel column that is DRAWN at this spot on the fine park.
 *
 * The real ground (`terrainHeight`) is a smooth field, and it is what the
 * flight floor, the collisions and every scatter are measured against. The
 * fine park draws it as flat-topped columns a whole unit at a time, so the
 * drawn ground is up to a unit under the real one on the flat and can be a
 * little over it at the foot of a steep bank. Anything that has to LOOK as if
 * it stands on the ground asks this, through `groundDrop`.
 *
 * `buildTerrainGeometry` builds its columns from the same sum, to the same
 * 32-bit precision, so the two cannot disagree about which step a cell is on.
 */
export function columnTop(x: number, z: number) {
  const { minX, minZ, maxX, maxZ } = active.world;
  const columns = Math.ceil((maxX - minX) / GROUND_COLUMN);
  const rows = Math.ceil((maxZ - minZ) / GROUND_COLUMN);
  const column = Math.min(columns - 1, Math.max(0, Math.floor((x - minX) / GROUND_COLUMN)));
  const row = Math.min(rows - 1, Math.max(0, Math.floor((z - minZ) / GROUND_COLUMN)));
  const x0 = minX + column * GROUND_COLUMN;
  const z0 = minZ + row * GROUND_COLUMN;

  return columnStep(
    Math.fround(terrainHeight(x0, z0)),
    Math.fround(terrainHeight(x0 + GROUND_COLUMN, z0)),
    Math.fround(terrainHeight(x0 + GROUND_COLUMN, z0 + GROUND_COLUMN)),
    Math.fround(terrainHeight(x0, z0 + GROUND_COLUMN)),
  );
}

/** One column's top from the heights at its four corners. */
export function columnStep(a: number, b: number, c: number, d: number) {
  return Math.floor((a + b + c + d) / 4);
}

/**
 * How far to move something planted at this spot so that it stands on the
 * ground as drawn. Nothing on the low park, whose ground is the real one.
 *
 * For drawing only. Where a thing IS, for finding it, landing on it and
 * bumping into it, does not change with the quality.
 */
export function groundDrop(x: number, z: number, quality: "low" | "high") {
  return quality === "high" ? columnTop(x, z) - terrainHeight(x, z) : 0;
}

/** Central difference on the height field. Used to avoid planting on cliffs. */
export function terrainSlope(x: number, z: number) {
  const step = 4;
  const dx = terrainHeight(x + step, z) - terrainHeight(x - step, z);
  const dz = terrainHeight(x, z + step) - terrainHeight(x, z - step);

  return Math.hypot(dx, dz) / (2 * step);
}

export function areaAt(x: number, z: number): Area {
  // A basin beats the valley it sits in: the lake is not merely "the hollow".
  for (const basin of active.basins ?? []) {
    if (Math.hypot(x - basin.center[0], z - basin.center[1]) < basin.radius) {
      return basin.area;
    }
  }

  const { area, halfWidth, centreLine } = active.valley;

  // The valley overrides the uplands wherever the water runs, so it stays one
  // continuous corridor rather than being carved up by whichever hilltop happens
  // to be nearest.
  if (Math.abs(x - centreLine(z)) < halfWidth) {
    return area;
  }

  let closest = active.areas[0];
  let best = Infinity;

  for (const candidate of active.areas) {
    const distance = Math.hypot(
      x - candidate.center[0],
      z - candidate.center[1],
    );

    if (distance < best) {
      best = distance;
      closest = candidate;
    }
  }

  return closest;
}

/** Half-width of a trail, in world units. */
const TRAIL_WIDTH = 9;
const TRAIL_REACH = TRAIL_WIDTH * 2;

/** How much a point belongs to a trail: 1 on the path, 0 off in the undergrowth. */
export function trailStrength(x: number, z: number) {
  let best = TRAIL_REACH * TRAIL_REACH;

  for (const [tx, tz] of trailPointsOf(active)) {
    const dx = x - tx;
    const dz = z - tz;
    // Squared distance. No square root until we actually need the number.
    const distance = dx * dx + dz * dz;

    if (distance < best) {
      best = distance;
    }
  }

  if (best >= TRAIL_REACH * TRAIL_REACH) {
    return 0;
  }

  return smoothstep(1 - Math.sqrt(best) / TRAIL_REACH);
}

/** Deterministic pseudo-random in [0,1) keyed off a position and a channel. */
export function sample(x: number, z: number, channel: number) {
  return hash(
    Math.round(x * 71) + channel * 9173,
    Math.round(z * 71) - channel * 3121,
  );
}
