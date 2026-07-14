/**
 * A park, as data.
 *
 * The game was one park for its whole life, and it showed: the world bounds, the
 * height function, the creek, the areas and the landmarks all sat as module-level
 * constants in `terrain.ts`, and every function in `world/` read them straight out
 * of file scope. Nothing took a park as an argument because there was only ever
 * one, and none of it was wrong until the day there were two.
 *
 * This is the shape a park has to have. Frick and Schenley both fill it in, and
 * everything downstream (terrain mesh, scatter, collision, species, ambience)
 * works off whichever one is active rather than off Frick specifically.
 *
 * The noise kit at the bottom is shared on purpose. Both parks are the same
 * geology, a few miles apart: the same Pittsburgh hills cut by the same kind of
 * stream. They should be built out of the same rock.
 */

export type ParkId = "frick" | "schenley";

export type Area = {
  id: string;
  label: string;
  center: [number, number];
};

export type Park = {
  id: ParkId;
  label: string;
  /** Shown on the park picker. One sentence, in the game's voice. */
  blurb: string;

  world: { minX: number; maxX: number; minZ: number; maxZ: number };
  /** The surface of whatever water the park has. */
  waterLevel: number;
  /** High enough to climb out of the canopy and read the whole park from above. */
  ceiling: number;
  start: [number, number, number];

  /** The uplands. The map is partitioned by nearest centre. */
  areas: Area[];
  /**
   * The valley corridor, if the park has one. It overrides the uplands wherever
   * the water runs, so a ravine stays one continuous place rather than being
   * carved up by whichever hilltop happens to be nearest.
   */
  valley: { area: Area; halfWidth: number; centreLine: (z: number) => number };
  /**
   * Places that override even the valley: a lake in the bottom of a hollow.
   *
   * Without this, Panther Hollow Lake is simply part of Panther Hollow, and every
   * pickerelweed and buttonbush placed "at the lake" is rejected by the scatter
   * because `areaAt` disagrees with it about where it is standing. That is
   * precisely the bug that left Frick's four creekside plants nowhere in the
   * world at all, and I am not shipping it twice.
   */
  basins?: { area: Area; center: [number, number]; radius: number }[];

  height: (x: number, z: number) => number;
  /** Named positions for the park's furniture. */
  landmarks: Record<string, [number, number]>;
  /** Parametric trail curves, sampled once into points by `trailPointsOf`. */
  trails: ((t: number) => [number, number])[];

  /** Ground colour per area id. */
  biomeColor: Record<string, string>;
  /** How thickly each area is planted, 0 to 1. */
  density: Record<string, number>;
  /**
   * What KIND of place each area is.
   *
   * The scatter used to decide what grows where by matching the literal string
   * "fern-hollow", which meant Schenley's areas would all have fallen through to
   * the mown-lawn case and the wildest ravine in the city would have come out
   * planted with clover and acorns. An area's ecology is a property of the area,
   * not of its name.
   */
  biome: Record<string, Biome>;
};

export type Biome =
  /** Closed canopy, deep shade, rot and mushrooms. */
  | "deep-woods"
  /** Steep wooded slope. Hemlock, and things that have fallen down it. */
  | "slope-woods"
  /** Damp, disturbed, and losing ground to knotweed. */
  | "valley-floor"
  /** Mown and managed. Specimen trees, acorns under them, clover between. */
  | "mown";

/** Every area in a park, valley included. The valley is not in `areas`. */
export function allAreas(park: Park): Area[] {
  return [
    ...park.areas,
    park.valley.area,
    ...(park.basins ?? []).map((basin) => basin.area),
  ];
}

/**
 * The trail curves, flattened to points ONCE per park.
 *
 * `trailStrength` is called for every terrain face, every scatter cell and every
 * blade of grass: hundreds of thousands of times. Re-evaluating parametric curves
 * inside each of those calls would be tens of millions of trig operations for a
 * set of points that never change.
 */
const TRAIL_POINTS = new Map<ParkId, [number, number][]>();

export function trailPointsOf(park: Park): [number, number][] {
  const cached = TRAIL_POINTS.get(park.id);

  if (cached) {
    return cached;
  }

  const points = park.trails.flatMap((trail) => {
    const out: [number, number][] = [];

    for (let t = -320; t <= 320; t += 10) {
      out.push(trail(t));
    }

    return out;
  });

  TRAIL_POINTS.set(park.id, points);

  return points;
}

/* ------------------------------------------------------------------------- *
 * The shared noise kit. Same geology, a few miles apart.
 * ------------------------------------------------------------------------- */

const SEED = 1337;

export function hash(ix: number, iz: number) {
  let h =
    Math.imul(ix, 374761393) ^
    Math.imul(iz, 668265263) ^
    Math.imul(SEED, 1274126177);
  h = Math.imul(h ^ (h >>> 13), 1274126177);

  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

export function smoothstep(t: number) {
  return t * t * (3 - 2 * t);
}

function valueNoise(x: number, z: number) {
  const ix = Math.floor(x);
  const iz = Math.floor(z);
  const fx = smoothstep(x - ix);
  const fz = smoothstep(z - iz);

  const a = hash(ix, iz);
  const b = hash(ix + 1, iz);
  const c = hash(ix, iz + 1);
  const d = hash(ix + 1, iz + 1);

  return (
    a * (1 - fx) * (1 - fz) + b * fx * (1 - fz) + c * (1 - fx) * fz + d * fx * fz
  );
}

export function fbm(x: number, z: number, octaves: number) {
  let sum = 0;
  let amplitude = 1;
  let frequency = 1;
  let total = 0;

  for (let i = 0; i < octaves; i += 1) {
    sum += valueNoise(x * frequency, z * frequency) * amplitude;
    total += amplitude;
    amplitude *= 0.5;
    frequency *= 2;
  }

  return sum / total;
}

/** 1 at the centre of a region, easing to 0 at its radius. */
export function influence(
  x: number,
  z: number,
  cx: number,
  cz: number,
  radius: number,
) {
  const distance = Math.hypot(x - cx, z - cz);

  if (distance >= radius) {
    return 0;
  }

  return smoothstep(1 - distance / radius);
}

export function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}
