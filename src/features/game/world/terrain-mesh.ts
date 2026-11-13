import { BufferAttribute, BufferGeometry, Color, Vector3 } from "three";

import {
  areaAt,
  sample,
  terrainHeight,
  trailStrength,
  activePark,
  waterLevel,
  world,
} from "./terrain";

/**
 * Quad size. The world is 700x520, so this can't be 1.4, that would be 370k
 * triangles of ground. Four units per quad is coarse to a human and vast to a
 * bee, which is the register we want, and it is what the low quality draws.
 * High halves it: the banks of the run and the lips of the trails stop being
 * four-unit facets, for four times the triangles, which a desktop has to spare.
 */
const RESOLUTION = { low: 4, high: 2 } as const;

/** Something standing on the ground that keeps the light off it. */
export type Shade = { x: number; z: number; radius: number; depth: number };

const ROCK = "#8a8175";
const SHALLOWS = "#6d6a52";
/** Bare packed dirt. Thousands of feet a week keep it that way. */
const TRAIL = "#a68b63";

/**
 * One flat-shaded triangle at a time, coloured by where it sits rather than by
 * a texture: biome tint, greying out on steep faces where soil wouldn't hold,
 * and turning to silt as it drops toward the creek.
 */
export function buildTerrainGeometry(
  quality: "low" | "high" = "low",
  shades: Shade[] = [],
): BufferGeometry {
  const SIZE = RESOLUTION[quality];
  const park = activePark();
  const litter = new Color("#7d6b45");
  const sunny = new Color("#a9c46a");

  // Shade, bucketed so each face asks only about what stands near it.
  const BUCKET = 32;
  const buckets = new Map<number, Shade[]>();

  for (const shade of shades) {
    const reach = Math.ceil(shade.radius / BUCKET);
    const bx = Math.floor(shade.x / BUCKET);
    const bz = Math.floor(shade.z / BUCKET);

    for (let dx = -reach; dx <= reach; dx += 1) {
      for (let dz = -reach; dz <= reach; dz += 1) {
        const key = (bx + dx) * 4096 + (bz + dz);
        const list = buckets.get(key);

        if (list) {
          list.push(shade);
        } else {
          buckets.set(key, [shade]);
        }
      }
    }
  }

  /** How much light is kept off a point: 0 open ground, toward 1 under a trunk. */
  const shadeAt = (x: number, z: number) => {
    const list = buckets.get(Math.floor(x / BUCKET) * 4096 + Math.floor(z / BUCKET));
    let dark = 0;

    if (list) {
      for (const shade of list) {
        const reach = Math.hypot(x - shade.x, z - shade.z) / shade.radius;

        if (reach < 1) {
          // Deepest at the foot, gone by the edge.
          dark = Math.max(dark, shade.depth * (1 - reach * reach));
        }
      }
    }

    return dark;
  };
  const positions: number[] = [];
  const normals: number[] = [];
  const colors: number[] = [];

  const base = new Color();
  const rock = new Color(ROCK);
  const shallows = new Color(SHALLOWS);
  const trail = new Color(TRAIL);

  const a = new Vector3();
  const b = new Vector3();
  const c = new Vector3();
  const ab = new Vector3();
  const ac = new Vector3();
  const normal = new Vector3();

  const columns = Math.ceil((world().maxX - world().minX) / SIZE);
  const rows = Math.ceil((world().maxZ - world().minZ) / SIZE);

  // Sample the height field ONCE per grid corner and reuse it.
  //
  // The naive version calls terrainHeight for every triangle corner and then
  // terrainSlope (four more height lookups) for every face, around a quarter of
  // a million noise evaluations for a world this size, which cost nine seconds of
  // load. Each corner is shared by up to six triangles, so caching the grid and
  // taking the slope from neighbouring samples removes almost all of that work.
  const heights = new Float32Array((columns + 1) * (rows + 1));

  for (let column = 0; column <= columns; column += 1) {
    for (let row = 0; row <= rows; row += 1) {
      heights[column * (rows + 1) + row] = terrainHeight(
        world().minX + column * SIZE,
        world().minZ + row * SIZE,
      );
    }
  }

  const heightAt = (column: number, row: number) =>
    heights[
      Math.min(columns, Math.max(0, column)) * (rows + 1) +
        Math.min(rows, Math.max(0, row))
    ];

  /** Slope from the cached grid rather than four fresh noise lookups. */
  const slopeAt = (column: number, row: number) => {
    const dx = heightAt(column + 1, row) - heightAt(column - 1, row);
    const dz = heightAt(column, row + 1) - heightAt(column, row - 1);

    return Math.hypot(dx, dz) / (2 * SIZE);
  };

  const pushTriangle = (
    p: Vector3,
    q: Vector3,
    r: Vector3,
    slope: number,
  ) => {
    ab.subVectors(q, p);
    ac.subVectors(r, p);
    normal.crossVectors(ab, ac).normalize();

    const cx = (p.x + q.x + r.x) / 3;
    const cy = (p.y + q.y + r.y) / 3;
    const cz = (p.z + q.z + r.z) / 3;

    // A park that forgot to colour one of its areas gets grass, not black.
    base
      .set(park.biomeColor[areaAt(cx, cz).id] ?? "#6f8f52");

    // Steep ground goes to rock. Falls Ravine's walls are genuinely too steep to
    // hold much, so this reads as accurate rather than as a shader trick.
    base.lerp(rock, Math.min(1, Math.max(0, (slope - 0.5) * 1.6)));

    // Silt and gravel where the ground drops toward Nine Mile Run.
    const depth = cy - waterLevel();
    base.lerp(shallows, Math.min(1, Math.max(0, 1 - depth / 22)));

    // The trails. Frick Park is a trail network with a wood around it, and from
    // the air the paths are the thing you actually navigate by.
    base.lerp(trail, trailStrength(cx, cz) * 0.92);

    // The ground is not one colour for a hundred units. In broad drifts it runs
    // to leaf litter under the trees and to a sunnier green in the open, which
    // is all a wood floor and a lawn really are from above.
    const biome = park.biome[areaAt(cx, cz).id] ?? "mown";
    const drift = sample(Math.round(cx / 22), Math.round(cz / 22), 31);
    const trodden = trailStrength(cx, cz);

    if (biome === "deep-woods" || biome === "slope-woods") {
      base.lerp(litter, drift * 0.34 * (1 - trodden));
    } else {
      base.lerp(sunny, Math.max(0, drift - 0.45) * 0.5 * (1 - trodden));
    }

    // And it is darker under anything standing on it. Baked in, so even the
    // quality with no cast shadows has trees that sit ON the ground.
    const shaded = 1 - shadeAt(cx, cz);

    // A little per-face variation, or large flats read as dead colour fields.
    const jitter = (0.93 + sample(cx, cz, 5) * 0.14) * shaded;

    for (const vertex of [p, q, r]) {
      positions.push(vertex.x, vertex.y, vertex.z);
      normals.push(normal.x, normal.y, normal.z);
      colors.push(base.r * jitter, base.g * jitter, base.b * jitter);
    }
  };

  for (let column = 0; column < columns; column += 1) {
    for (let row = 0; row < rows; row += 1) {
      const x0 = world().minX + column * SIZE;
      const z0 = world().minZ + row * SIZE;
      const x1 = x0 + SIZE;
      const z1 = z0 + SIZE;

      const h00 = heightAt(column, row);
      const h10 = heightAt(column + 1, row);
      const h11 = heightAt(column + 1, row + 1);
      const h01 = heightAt(column, row + 1);
      const slope = slopeAt(column, row);

      // Wound counter-clockwise seen from above, so the face normals point at
      // the sky. Reverse these and the whole park is backface-culled into
      // invisibility, and you fly over an empty blue void.
      a.set(x0, h00, z0);
      b.set(x1, h10, z0);
      c.set(x1, h11, z1);
      pushTriangle(a.clone(), c.clone(), b.clone(), slope);

      a.set(x0, h00, z0);
      b.set(x1, h11, z1);
      c.set(x0, h01, z1);
      pushTriangle(a.clone(), c.clone(), b.clone(), slope);
    }
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute(
    "position",
    new BufferAttribute(new Float32Array(positions), 3),
  );
  geometry.setAttribute(
    "normal",
    new BufferAttribute(new Float32Array(normals), 3),
  );
  geometry.setAttribute("color", new BufferAttribute(new Float32Array(colors), 3));
  geometry.computeBoundingSphere();

  return geometry;
}
