import { BufferAttribute, BufferGeometry, Color, Vector3 } from "three";

import {
  areaAt,
  sample,
  terrainHeight,
  trailStrength,
  WATER_LEVEL,
  WORLD,
  type AreaId,
} from "./terrain";

/**
 * Quad size. The world is now 700x520, so this can't stay at 1.4 — that would be
 * 370k triangles of ground. Four units per quad is coarse to a human and vast to
 * a bee, which is exactly the register we want.
 */
const RESOLUTION = 4;

const BIOME_COLOR: Record<AreaId, string> = {
  // Mown lawn around the centre.
  "environmental-center": "#8cc063",
  // Trampled grass and wood chips around the playground.
  "blue-slide": "#9dbb62",
  // The bowling green: manicured to within an inch of its life.
  "bowling-green": "#7fc457",
  // The valley floor — silt, gravel and wet meadow.
  "nine-mile-run": "#5d8052",
  // Steep hemlock slopes.
  "falls-ravine": "#456f42",
  // Deep shade under a closed canopy.
  "fern-hollow": "#39632f",
};

const ROCK = "#8a8175";
const SHALLOWS = "#6d6a52";
/** Bare packed dirt. Thousands of feet a week keep it that way. */
const TRAIL = "#a68b63";

/**
 * One flat-shaded triangle at a time, coloured by where it sits rather than by
 * a texture: biome tint, greying out on steep faces where soil wouldn't hold,
 * and turning to silt as it drops toward the creek.
 */
export function buildTerrainGeometry(): BufferGeometry {
  const positions: number[] = [];
  const normals: number[] = [];
  const colors: number[] = [];

  const base = new Color();
  const rock = new Color(ROCK).convertSRGBToLinear();
  const shallows = new Color(SHALLOWS).convertSRGBToLinear();
  const trail = new Color(TRAIL).convertSRGBToLinear();

  const a = new Vector3();
  const b = new Vector3();
  const c = new Vector3();
  const ab = new Vector3();
  const ac = new Vector3();
  const normal = new Vector3();

  const columns = Math.ceil((WORLD.maxX - WORLD.minX) / RESOLUTION);
  const rows = Math.ceil((WORLD.maxZ - WORLD.minZ) / RESOLUTION);

  // Sample the height field ONCE per grid corner and reuse it.
  //
  // The naive version calls terrainHeight for every triangle corner and then
  // terrainSlope (four more height lookups) for every face — around a quarter of
  // a million noise evaluations for a world this size, which cost nine seconds of
  // load. Each corner is shared by up to six triangles, so caching the grid and
  // taking the slope from neighbouring samples removes almost all of that work.
  const heights = new Float32Array((columns + 1) * (rows + 1));

  for (let column = 0; column <= columns; column += 1) {
    for (let row = 0; row <= rows; row += 1) {
      heights[column * (rows + 1) + row] = terrainHeight(
        WORLD.minX + column * RESOLUTION,
        WORLD.minZ + row * RESOLUTION,
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

    return Math.hypot(dx, dz) / (2 * RESOLUTION);
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

    base.set(BIOME_COLOR[areaAt(cx, cz).id]).convertSRGBToLinear();

    // Steep ground goes to rock. Falls Ravine's walls are genuinely too steep to
    // hold much, so this reads as accurate rather than as a shader trick.
    base.lerp(rock, Math.min(1, Math.max(0, (slope - 0.5) * 1.6)));

    // Silt and gravel where the ground drops toward Nine Mile Run.
    const depth = cy - WATER_LEVEL;
    base.lerp(shallows, Math.min(1, Math.max(0, 1 - depth / 22)));

    // The trails. Frick Park is a trail network with a wood around it, and from
    // the air the paths are the thing you actually navigate by.
    base.lerp(trail, trailStrength(cx, cz) * 0.92);

    // A little per-face variation, or large flats read as dead colour fields.
    const jitter = 0.92 + sample(cx, cz, 5) * 0.16;

    for (const vertex of [p, q, r]) {
      positions.push(vertex.x, vertex.y, vertex.z);
      normals.push(normal.x, normal.y, normal.z);
      colors.push(base.r * jitter, base.g * jitter, base.b * jitter);
    }
  };

  for (let column = 0; column < columns; column += 1) {
    for (let row = 0; row < rows; row += 1) {
      const x0 = WORLD.minX + column * RESOLUTION;
      const z0 = WORLD.minZ + row * RESOLUTION;
      const x1 = x0 + RESOLUTION;
      const z1 = z0 + RESOLUTION;

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
