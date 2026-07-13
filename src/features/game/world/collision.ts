import { LANDMARKS, terrainHeight } from "./terrain";
import { scatterFoliage, type Placement } from "./scatter";

/**
 * Making the park solid.
 *
 * You could fly straight through an eighty-unit oak, which looked broken the
 * moment anybody noticed it. Now you cannot.
 *
 * Two rules keep this from becoming miserable:
 *
 *  1. **Only big things collide.** Trees, boulders, logs, buildings, the bridge.
 *     Grass, clover, leaf litter and mushroom caps are pass-through, because at
 *     insect scale a lawn is a thicket and colliding with every blade would make
 *     flying near the ground unbearable.
 *
 *  2. **Push out, do not stop.** The bee is nudged to the surface of whatever it
 *     hit and keeps whatever movement was parallel to it, so it slides along a
 *     trunk rather than sticking to it. Nothing bounces and nothing traps you.
 *
 * The colliders are derived from the same scatter that draws the trees, so they
 * cannot drift out of sync with what you can see.
 */

/** An upright cylinder. Trees, stumps, boulders. */
export type Cylinder = {
  x: number;
  z: number;
  radius: number;
  /** Absolute world height of the top. Fly over it and you are clear. */
  top: number;
  bottom: number;
};

/** An axis-aligned box. Buildings, the bridge, the slide. */
export type Obstacle = {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  minZ: number;
  maxZ: number;
};

/**
 * The collision radius and height of each foliage kind.
 *
 * Radii are deliberately a little tighter than the visual model. A collider that
 * matches the art exactly feels like it grabs you from a distance, because the
 * canopy of a voxel oak is a lumpy box and its corners stick out further than
 * your eye reads.
 */
const SOLID: Record<string, { radius: number; height: number }> = {
  hemlock: { radius: 9, height: 96 },
  oak: { radius: 11, height: 76 },
  snag: { radius: 4, height: 44 },
  stump: { radius: 6, height: 10 },
  rock: { radius: 7, height: 8 },
  log: { radius: 5, height: 10 },
  branch: { radius: 3, height: 5 },
  shrub: { radius: 7, height: 15 },
  knotweed: { radius: 6, height: 32 },
};

/** Everything else is scenery you can fly through. */
const PASS_THROUGH = new Set([
  "grass",
  "clover",
  "leafLitter",
  "acorn",
  "fern",
  "mushroom",
  "cattail",
]);

let cylinders: Cylinder[] | null = null;
let obstacles: Obstacle[] | null = null;

/**
 * A uniform grid over the world, so a lookup checks a dozen candidates instead
 * of two thousand.
 */
const CELL = 40;
let grid: Map<number, Cylinder[]> | null = null;

function key(x: number, z: number) {
  return Math.floor(x / CELL) * 100000 + Math.floor(z / CELL);
}

function buildCylinders(): Cylinder[] {
  const scatter = scatterFoliage();
  const result: Cylinder[] = [];

  for (const [kind, placements] of Object.entries(scatter) as [
    string,
    Placement[],
  ][]) {
    const solid = SOLID[kind];

    if (!solid || PASS_THROUGH.has(kind)) {
      continue;
    }

    for (const placement of placements) {
      const [x, y, z] = placement.position;

      result.push({
        x,
        z,
        radius: solid.radius * placement.scale,
        bottom: y,
        top: y + solid.height * placement.scale,
      });
    }
  }

  return result;
}

/** A box around a landmark, sitting on the ground beneath it. */
function boxAt(
  [x, z]: [number, number],
  width: number,
  height: number,
  depth: number,
  lift = 0,
): Obstacle {
  const ground = terrainHeight(x, z) + lift;

  return {
    minX: x - width / 2,
    maxX: x + width / 2,
    minY: ground,
    maxY: ground + height,
    minZ: z - depth / 2,
    maxZ: z + depth / 2,
  };
}

function buildObstacles(): Obstacle[] {
  const bridge = LANDMARKS.fernHollowBridge;

  return [
    // The Environmental Center. The building body (76 x 46), not the roof
    // overhang: an overhang you cannot fly under is not an overhang.
    boxAt(LANDMARKS.center, 76, 28, 46),
    // The gatehouse: two piers with a gap between them you can fly through, so
    // it is modelled as two boxes rather than one, which would wall it off.
    boxAt([LANDMARKS.gatehouse[0] - 26, LANDMARKS.gatehouse[1]], 18, 46, 18),
    boxAt([LANDMARKS.gatehouse[0] + 26, LANDMARKS.gatehouse[1]], 18, 46, 18),
    // The Blue Slide.
    boxAt(LANDMARKS.blueSlide, 64, 38, 100),
    // The bowling green clubhouse. The green itself is flat, so no collider.
    boxAt([LANDMARKS.bowlingGreen[0], LANDMARKS.bowlingGreen[1] - 74], 34, 24, 22),
    // The tennis court fence. A wall, from here.
    boxAt(LANDMARKS.tennisCourts, 80, 20, 112),
    // The pavilion.
    boxAt(LANDMARKS.pavilion, 72, 32, 56),
    // The culvert.
    boxAt(LANDMARKS.culvert, 32, 20, 16, -4),
    // The bridge deck. It hangs at a fixed height rather than on the ground, so
    // its box is absolute: you can fly UNDER it, which is most of the point.
    {
      minX: bridge[0] - 152,
      maxX: bridge[0] + 152,
      minY: 84,
      maxY: 112,
      minZ: bridge[1] - 24,
      maxZ: bridge[1] + 24,
    },
    // And its piers.
    ...[-96, -32, 32, 96].map((offset) => ({
      minX: bridge[0] + offset - 9,
      maxX: bridge[0] + offset + 9,
      minY: -100,
      maxY: 92,
      minZ: bridge[1] - 12,
      maxZ: bridge[1] + 12,
    })),
  ];
}

function ensureBuilt() {
  if (grid) {
    return;
  }

  cylinders = buildCylinders();
  obstacles = buildObstacles();
  grid = new Map();

  for (const cylinder of cylinders) {
    // A tree can straddle cell boundaries, so register it in every cell its
    // radius touches. Missing one is how you get a tree that is solid from the
    // north and hollow from the west.
    const minCol = Math.floor((cylinder.x - cylinder.radius) / CELL);
    const maxCol = Math.floor((cylinder.x + cylinder.radius) / CELL);
    const minRow = Math.floor((cylinder.z - cylinder.radius) / CELL);
    const maxRow = Math.floor((cylinder.z + cylinder.radius) / CELL);

    for (let col = minCol; col <= maxCol; col += 1) {
      for (let row = minRow; row <= maxRow; row += 1) {
        const cell = col * 100000 + row;
        const list = grid.get(cell);

        if (list) {
          list.push(cylinder);
        } else {
          grid.set(cell, [cylinder]);
        }
      }
    }
  }
}

export type Resolved = { x: number; y: number; z: number; hit: boolean };

/**
 * Push a position out of anything it is inside.
 *
 * `clearance` is the bee's own radius. Resolving against a point would let half
 * the animal sink into a trunk before anything happened.
 */
export function resolveCollision(
  x: number,
  y: number,
  z: number,
  clearance = 0.6,
): Resolved {
  ensureBuilt();

  let outX = x;
  let outZ = z;
  let hit = false;

  // Trees and the like: push out horizontally, unless you are over the top.
  const candidates = grid!.get(key(x, z));

  if (candidates) {
    for (const cylinder of candidates) {
      if (y > cylinder.top || y < cylinder.bottom) {
        continue;
      }

      const dx = outX - cylinder.x;
      const dz = outZ - cylinder.z;
      const reach = cylinder.radius + clearance;
      const distanceSq = dx * dx + dz * dz;

      if (distanceSq >= reach * reach) {
        continue;
      }

      const distance = Math.sqrt(distanceSq);

      // Dead centre of the trunk: no direction to push, so pick one rather than
      // dividing by zero and sending the bee to NaN, which is unrecoverable.
      if (distance < 0.001) {
        outX = cylinder.x + reach;
        hit = true;
        continue;
      }

      outX = cylinder.x + (dx / distance) * reach;
      outZ = cylinder.z + (dz / distance) * reach;
      hit = true;
    }
  }

  // Buildings: push out along whichever face is nearest, which is the cheapest
  // way to slide along a wall rather than stick to it.
  let outY = y;

  for (const box of obstacles!) {
    if (
      outX < box.minX - clearance ||
      outX > box.maxX + clearance ||
      outY < box.minY - clearance ||
      outY > box.maxY + clearance ||
      outZ < box.minZ - clearance ||
      outZ > box.maxZ + clearance
    ) {
      continue;
    }

    const toMinX = outX - (box.minX - clearance);
    const toMaxX = box.maxX + clearance - outX;
    const toMinY = outY - (box.minY - clearance);
    const toMaxY = box.maxY + clearance - outY;
    const toMinZ = outZ - (box.minZ - clearance);
    const toMaxZ = box.maxZ + clearance - outZ;

    const smallest = Math.min(toMinX, toMaxX, toMinY, toMaxY, toMinZ, toMaxZ);

    if (smallest === toMinX) outX = box.minX - clearance;
    else if (smallest === toMaxX) outX = box.maxX + clearance;
    else if (smallest === toMinY) outY = box.minY - clearance;
    else if (smallest === toMaxY) outY = box.maxY + clearance;
    else if (smallest === toMinZ) outZ = box.minZ - clearance;
    else outZ = box.maxZ + clearance;

    hit = true;
  }

  return { x: outX, y: outY, z: outZ, hit };
}
