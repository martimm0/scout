/**
 * Frick Park, as a height function — at the scale of the thing flying over it.
 *
 * The world is ~700x520 units and a bee is under one unit long. Trees run 60-100
 * units, a flower stalk 15-25, a blade of grass 4. That ratio is the whole point:
 * you are an insect in a real park, and a place you could walk across in twenty
 * minutes is a continent. It also means the park can hide things from you, which
 * is what makes it worth flying back into.
 *
 * The map is cut around what's actually in Frick Park — the Environmental Center
 * and its gatehouse, the Blue Slide, the lawn bowling green, Nine Mile Run in the
 * valley, Falls Ravine, Fern Hollow — rather than around generic biomes.
 *
 * Everything is deterministic. Same coordinates, same park, every session.
 */

export const WORLD = {
  minX: -350,
  maxX: 350,
  minZ: -260,
  maxZ: 260,
};

/** Nine Mile Run, at the bottom of the valley. */
export const WATER_LEVEL = -88;

/** How far above the ground the bee is stopped from descending. */
export const GROUND_CLEARANCE = 0.6;

/**
 * High enough to climb out of the canopy and read the whole park from above.
 * Trees top out near 135 units, so a lower ceiling traps you in the leaves with
 * no way to get your bearings.
 */
export const CEILING = 260;

/** On the lawn outside the Environmental Center, by the Beechwood gates. */
export const START_POSITION: [number, number, number] = [-240, 34, 205];

export type AreaId =
  | "environmental-center"
  | "blue-slide"
  | "bowling-green"
  | "nine-mile-run"
  | "falls-ravine"
  | "fern-hollow";

export type Area = {
  id: AreaId;
  label: string;
  center: [number, number];
};

/**
 * Five uplands partition the map by nearest centre. Nine Mile Run overrides them
 * all wherever the creek runs, so the valley stays one continuous corridor rather
 * than being carved up by whichever hilltop happens to be closest.
 */
export const AREAS: Area[] = [
  {
    id: "environmental-center",
    label: "Frick Environmental Center",
    center: [-240, 205],
  },
  { id: "blue-slide", label: "Blue Slide Playground", center: [215, 175] },
  { id: "bowling-green", label: "Lawn Bowling Green", center: [245, -55] },
  { id: "falls-ravine", label: "Falls Ravine", center: [-215, -45] },
  { id: "fern-hollow", label: "Fern Hollow", center: [-140, -215] },
];

export const RAVINE_AREA: Area = {
  id: "nine-mile-run",
  label: "Nine Mile Run",
  center: [0, 0],
};

/** Landmarks, in world coordinates. The park's furniture, at insect scale. */
export const LANDMARKS = {
  /** The Blue Slide: a concrete hillside you'd need a whole afternoon to climb. */
  blueSlide: [215, 175] as [number, number],
  /** The Environmental Center building. */
  center: [-232, 190] as [number, number],
  /** The stone gatehouse at the Beechwood Boulevard entrance. */
  gatehouse: [-268, 226] as [number, number],
  /** The only lawn bowling green in Pittsburgh. */
  bowlingGreen: [245, -55] as [number, number],
  /** Clay courts, beside the green. */
  tennisCourts: [286, -14] as [number, number],
};

const SEED = 1337;

function hash(ix: number, iz: number) {
  let h =
    Math.imul(ix, 374761393) ^ Math.imul(iz, 668265263) ^ Math.imul(SEED, 1274126177);
  h = Math.imul(h ^ (h >>> 13), 1274126177);

  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function smoothstep(t: number) {
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

function fbm(x: number, z: number, octaves: number) {
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

/** The centre line of Nine Mile Run, meandering down the valley floor. */
export function creekX(z: number) {
  return 70 * Math.sin(z * 0.006) + 30 * Math.sin(z * 0.016 + 1.3);
}

/** How wide the valley corridor is, for area purposes. */
const VALLEY_HALF_WIDTH = 68;

/** 1 at the centre of a region, easing to 0 at its radius. */
function influence(x: number, z: number, cx: number, cz: number, radius: number) {
  const distance = Math.hypot(x - cx, z - cz);

  if (distance >= radius) {
    return 0;
  }

  return smoothstep(1 - distance / radius);
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

export function terrainHeight(x: number, z: number) {
  const distanceToCreek = Math.abs(x - creekX(z));

  let height = (fbm(x * 0.0022, z * 0.0022, 4) - 0.5) * 90;
  height += (fbm(x * 0.01, z * 0.01, 2) - 0.5) * 14;

  // Carve the valley. Flattening the noise as we approach the creek keeps the
  // valley floor flyable rather than lumpy.
  const valley = Math.exp(-(distanceToCreek * distanceToCreek) / (2 * 62 * 62));
  height = height * (1 - 0.85 * valley) - 95 * valley;

  // Ridges flanking the valley — the wooded slopes that make it a ravine from
  // the air rather than a ditch.
  const shoulder = Math.exp(-((distanceToCreek - 125) ** 2) / (2 * 55 * 55));
  height += 34 * shoulder;

  // The lawn at the Environmental Center is mown flat.
  const lawn = influence(x, z, -240, 205, 95);
  height = lerp(height, 26, lawn * 0.93);

  // The bowling green is a true plateau — it has to be dead level; that's the
  // entire point of a bowling green.
  const green = influence(x, z, 245, -55, 60);
  height = lerp(height, 30, green * 0.97);

  // The playground sits on a shelf, with the slide running off it.
  const playground = influence(x, z, 215, 175, 78);
  height = lerp(height, 18, playground * 0.88);

  return height;
}

/** Central difference on the height field. Used to avoid planting on cliffs. */
export function terrainSlope(x: number, z: number) {
  const step = 4;
  const dx = terrainHeight(x + step, z) - terrainHeight(x - step, z);
  const dz = terrainHeight(x, z + step) - terrainHeight(x, z - step);

  return Math.hypot(dx, dz) / (2 * step);
}

export function areaAt(x: number, z: number): Area {
  if (Math.abs(x - creekX(z)) < VALLEY_HALF_WIDTH) {
    return RAVINE_AREA;
  }

  let closest = AREAS[0];
  let best = Infinity;

  for (const area of AREAS) {
    const distance = Math.hypot(x - area.center[0], z - area.center[1]);

    if (distance < best) {
      best = distance;
      closest = area;
    }
  }

  return closest;
}

/** Deterministic pseudo-random in [0,1) keyed off a position and a channel. */
export function sample(x: number, z: number, channel: number) {
  return hash(
    Math.round(x * 71) + channel * 9173,
    Math.round(z * 71) - channel * 3121,
  );
}
