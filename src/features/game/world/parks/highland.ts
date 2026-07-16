import { fbm, influence, lerp, type Park } from "../park";

/**
 * Highland Park: water on top of a hill.
 *
 * Frick is a wood with a creek at the bottom of it. Schenley is a lawn with a
 * hollow torn out of it. Highland inverts both: the water here is not down in a
 * ravine, it is UP, held a hundred and fifty feet above the Allegheny inside two
 * enormous walled reservoirs that supply the city its drinking water. You fly
 * over the rim of a wall and there is a lake on the other side of it, at the top,
 * where a lake has no business being.
 *
 * Then the ground falls away north to the river, and that slope is the wildest
 * ground in the park, with the zoo along the edge of it.
 *
 * The other two parks are organised around a stream in a valley. This one has no
 * valley at all, which is the point: it is built around a thing people made and
 * a hill they put it on.
 */

/**
 * The reservoir walls.
 *
 * Not a natural feature and not shaped like one: a reservoir is a flat disc of
 * water inside a raised ring, and the ring is the whole drama. Flying at it from
 * outside, it is a wall. Getting over it, there is a lake.
 */
function reservoir(
  x: number,
  z: number,
  cx: number,
  cz: number,
  radius: number,
  surface: number,
) {
  const distance = Math.hypot(x - cx, z - cz);

  // Outside its influence entirely.
  if (distance > radius + 34) {
    return null;
  }

  // The embankment: a ring wall standing proud of the plateau.
  if (distance > radius) {
    const along = (distance - radius) / 34;

    return lerp(surface + 16, 74, along);
  }

  // Inside: the basin, flat, with a lip at the edge.
  const lip = Math.min(1, (radius - distance) / 12);

  return lerp(surface + 16, surface - 8, lip);
}

/** The two reservoirs, and Lake Carnegie's fountain basin. */
const RESERVOIR_ONE: [number, number] = [-150, -60];
const RESERVOIR_TWO: [number, number] = [110, -110];
const LAKE_CARNEGIE: [number, number] = [-30, 90];

function height(x: number, z: number) {
  // The plateau the whole park sits on. High, and mostly level, because a
  // reservoir has to be.
  let value = (fbm(x * 0.003, z * 0.003, 4) - 0.5) * 44;
  value += (fbm(x * 0.012, z * 0.012, 2) - 0.5) * 9;
  value += 62;

  /**
   * The slope down to the Allegheny.
   *
   * The whole north edge of the park falls away, and it keeps falling: the river
   * is a hundred and fifty feet below the reservoir rim. This is a one-way tilt
   * rather than a valley, and it is what makes Highland read as a bluff instead
   * of a bowl.
   */
  const toRiver = Math.max(0, (z + 40) / -190);
  value = lerp(value, -72, Math.min(1, toRiver) ** 1.4);

  // The riverside flats: a floodplain, standing just clear of the water. It has
  // to be ABOVE the waterline, or the entire bottom of the map is a lake rather
  // than the wet meadow the jewelweed and the wingstem actually grow on.
  const flats = influence(x, z, 0, -228, 140);
  value = lerp(value, -76, flats * 0.85);

  // And then the Allegheny itself, along the very top edge of the map. This is
  // the only genuinely open water in the park at ground level: the reservoirs
  // carry their own, up on the hill, inside their walls.
  const river = Math.max(0, (z + 246) / -34);
  value = lerp(value, -104, Math.min(1, river));

  // Reservoir No. 1, the big one, and Reservoir No. 2 beside it.
  for (const [cx, cz, radius, surface] of [
    [RESERVOIR_ONE[0], RESERVOIR_ONE[1], 118, 46],
    [RESERVOIR_TWO[0], RESERVOIR_TWO[1], 82, 50],
  ] as const) {
    const shaped = reservoir(x, z, cx, cz, radius, surface);

    if (shaped !== null) {
      const distance = Math.hypot(x - cx, z - cz);
      const blend = distance > radius ? 0.9 : 1;
      value = lerp(value, shaped, blend);
    }
  }

  // Lake Carnegie: a shallow dish for the fountain to stand in. Its water is
  // part of the fountain model rather than the world's waterline, which is the
  // only way to have a lake most of the way up a hill.
  const lake = influence(x, z, LAKE_CARNEGIE[0], LAKE_CARNEGIE[1], 70);
  value = lerp(value, 30, lake * 0.9);

  // The entrance lawn, mown flat around the gates.
  const entrance = influence(x, z, -30, 190, 110);
  value = lerp(value, 58, entrance * 0.8);

  // The zoo terraces along the north-east edge.
  const zoo = influence(x, z, 210, 60, 120);
  value = lerp(value, 44, zoo * 0.75);

  return value;
}

export const HIGHLAND: Park = {
  id: "highland",
  label: "Highland Park",
  blurb:
    "Water on a hilltop. Two enormous walled reservoirs holding the city's drinking water, a fountain at the gates, and a wooded slope falling away to the Allegheny.",
  requires: { park: "schenley", fraction: 0.5 },

  world: { minX: -320, maxX: 320, minZ: -280, maxZ: 260 },
  /**
   * The Allegheny, along the north edge.
   *
   * A park gets ONE waterline, because the water is drawn as one plane across
   * the whole map, so it has to be the lowest water there is. Aiming it at Lake
   * Carnegie instead put it sixty units above the river flats and drowned the
   * entire floodplain: seventeen per cent of the park came out as open water,
   * against six in Frick. Lake Carnegie and both reservoirs carry their own
   * water inside their own models, which is what lets them sit up on a hill.
   */
  waterLevel: -88,
  ceiling: 260,
  // On the entrance lawn below the gates, looking up the park at the reservoir
  // wall. You cannot see the water from here, which is the entire joke: there is
  // a lake up there and the only clue is that the hill has a wall around it.
  start: [-30, 92, 190],

  areas: [
    { id: "reservoir-rim", label: "Reservoir Rim", center: [-150, -60] },
    { id: "lake-carnegie", label: "Lake Carnegie", center: [-30, 90] },
    { id: "allegheny-slope", label: "Allegheny Slope", center: [-60, -180] },
    { id: "riverside-flats", label: "Riverside Flats", center: [40, -250] },
    { id: "zoo-edge", label: "The Zoo Edge", center: [210, 60] },
    { id: "highland-gates", label: "The Entrance Gates", center: [-30, 200] },
  ],

  /**
   * Highland has no valley.
   *
   * The Park type wants one, because both of the other parks are organised around
   * a stream at the bottom of a ravine. This one is organised around a hill with
   * water on top. Rather than invent a creek that is not there, the valley points
   * at the far edge of the riverside flats: it is the Allegheny itself, running
   * along the bottom of the map, and it is the one genuinely low wet place here.
   */
  valley: {
    area: { id: "allegheny-shore", label: "The Allegheny Shore", center: [0, -270] },
    halfWidth: 30,
    centreLine: () => -9999,
    bankSlopeLimit: 2,
  },

  basins: [
    {
      area: {
        id: "reservoir-one",
        label: "Reservoir No. 1",
        center: RESERVOIR_ONE,
      },
      center: RESERVOIR_ONE,
      radius: 118,
    },
    {
      area: {
        id: "reservoir-two",
        label: "Reservoir No. 2",
        center: RESERVOIR_TWO,
      },
      center: RESERVOIR_TWO,
      radius: 82,
    },
  ],

  height,

  landmarks: {
    /** The walled lake at the top of the city. */
    reservoirOne: RESERVOIR_ONE,
    reservoirTwo: RESERVOIR_TWO,
    /** The fountain in the middle of Lake Carnegie. */
    fountain: LAKE_CARNEGIE,
    /** The Highland Avenue entrance, with its bronzes on the piers. */
    gates: [-30, 214],
    /** Highland Park Pool, which is the size of a small sea from here. */
    pool: [-190, 120],
    superPlayground: [80, 150],
    /** The Pittsburgh Zoo, along the north-east edge. */
    zoo: [210, 60],
    /** The reservoir pump house. */
    pumpHouse: [-150, 66],
    /** A trail shelter on the slope down to the river. */
    slopeShelter: [-90, -150],
  },

  /**
   * Highland's paths are loops. The reservoir walk is the most walked ground in
   * the East End, and it goes round and round and arrives nowhere, which is the
   * point of it.
   */
  trails: [
    // The reservoir loop, round the top of the embankment.
    (t) => [
      RESERVOIR_ONE[0] + 128 * Math.cos(t * 0.016),
      RESERVOIR_ONE[1] + 128 * Math.sin(t * 0.016),
    ],
    // The second reservoir's loop.
    (t) => [
      RESERVOIR_TWO[0] + 92 * Math.cos(t * 0.02),
      RESERVOIR_TWO[1] + 92 * Math.sin(t * 0.02),
    ],
    // Lake Drive, from the gates up to the reservoirs.
    (t) => [-30 + t * 0.15, 200 - t * 0.9],
    // The bridle trail, contouring down the slope to the river.
    (t) => [-60 + t * 1.1, -150 - t * 0.32],
  ],

  biomeColor: {
    // Gravel and clipped verge around the walk.
    "reservoir-rim": "#8fbc61",
    // The water itself. Deep, still, and municipal.
    "reservoir-one": "#3f6f96",
    "reservoir-two": "#3f6f96",
    // Mown lawn and a fountain.
    "lake-carnegie": "#93c56a",
    "highland-gates": "#9ecb63",
    // Oak and hickory going down to the river.
    "allegheny-slope": "#48733e",
    // Floodplain: silt, and whatever the river left last time.
    "riverside-flats": "#587d4a",
    "allegheny-shore": "#5d7f52",
    // Mown terraces and clipped hedges.
    "zoo-edge": "#7fb257",
  },

  biome: {
    "allegheny-slope": "slope-woods",
    "riverside-flats": "valley-floor",
    "allegheny-shore": "valley-floor",
    "reservoir-rim": "mown",
    "reservoir-one": "mown",
    "reservoir-two": "mown",
    "lake-carnegie": "mown",
    "highland-gates": "mown",
    "zoo-edge": "mown",
  },

  // The slope is where everything grows. The top of the park is a reservoir with
  // a path around it, and a reservoir is not a habitat.
  density: {
    "allegheny-slope": 0.88,
    "riverside-flats": 0.75,
    "allegheny-shore": 0.6,
    "lake-carnegie": 0.22,
    "zoo-edge": 0.28,
    "highland-gates": 0.18,
    "reservoir-rim": 0.12,
    // Nothing grows in the drinking water.
    "reservoir-one": 0,
    "reservoir-two": 0,
  },
};
