import { fbm, influence, lerp, type Park } from "../park";

/**
 * Schenley Park, a couple of miles west of Frick and a completely different
 * animal.
 *
 * Frick is a wood with a creek at the bottom of it. Schenley is a *city* park:
 * Phipps Conservatory sitting on the plateau in a hundred thousand panes of
 * glass, Flagstaff Hill mown flat and open where half of Pittsburgh goes
 * sledding, the Oval's running track, and then the ground simply falls away into
 * Panther Hollow, which is as wild as anything in Frick and a hundred feet deep.
 *
 * That contrast is the reason to build it. The two parks should not feel like the
 * same generator with different numbers: Frick is enclosed and wooded and asks you
 * to go down into it, and Schenley is wide open at the top and hides its wildness
 * in a crack in the ground.
 *
 * The geology is the same, because it really is: the same Pittsburgh hills cut by
 * the same kind of stream, so the same noise kit builds both.
 */

/**
 * Panther Hollow Run, which drains the hollow and ends in Panther Hollow Lake.
 *
 * Straighter than Nine Mile Run, and it runs at a diagonal rather than down the
 * middle, which is what stops Schenley reading as Frick with the labels swapped.
 */
function run(z: number) {
  return -40 + z * 0.38 + 34 * Math.sin(z * 0.009 + 0.6);
}

/** The lake, at the bottom end of the hollow. */
const LAKE: [number, number] = [30, 170];

function height(x: number, z: number) {
  const distanceToRun = Math.abs(x - run(z));

  // The plateau. Schenley's whole northern half sits UP, which is why the hollow
  // is such a shock: you are strolling past a conservatory and then the world
  // ends.
  let value = (fbm(x * 0.0026, z * 0.0026, 4) - 0.5) * 66;
  value += (fbm(x * 0.011, z * 0.011, 2) - 0.5) * 12;
  value += 34;

  // Panther Hollow. Steeper and narrower than Nine Mile Run: a crack rather than
  // a valley, which is exactly what it is on the ground.
  const hollow = Math.exp(-(distanceToRun * distanceToRun) / (2 * 46 * 46));
  value = value * (1 - 0.9 * hollow) - 104 * hollow;

  // The wooded shoulders climbing out of it.
  const shoulder = Math.exp(-((distanceToRun - 96) ** 2) / (2 * 42 * 42));
  value += 30 * shoulder;

  // Panther Hollow Lake: a wide flat basin at the bottom end, dug below the
  // waterline so it actually holds water rather than being a damp patch.
  const lake = influence(x, z, LAKE[0], LAKE[1], 88);
  value = lerp(value, -104, lake * 0.95);

  // Flagstaff Hill. A great smooth open dome, mown, treeless, and the one place
  // in either park where you can see everything at once.
  const flagstaff = influence(x, z, -170, 40, 130);
  value = lerp(value, 62, flagstaff * 0.85);

  // The Phipps plateau: glass needs level ground.
  const phipps = influence(x, z, -250, -140, 92);
  value = lerp(value, 58, phipps * 0.95);

  // Schenley Oval: a running track, so it is as flat as the bowling green and for
  // the same reason.
  const oval = influence(x, z, 230, -110, 105);
  value = lerp(value, 40, oval * 0.96);

  // Westinghouse Pond, a small still hollow of its own.
  const pond = influence(x, z, 250, 130, 52);
  value = lerp(value, -96, pond * 0.9);

  return value;
}

export const SCHENLEY: Park = {
  id: "schenley",
  label: "Schenley Park",
  blurb:
    "Glass and lawns on top, and then the ground opens into Panther Hollow, which is a hundred feet deep and as wild as anything in Frick.",
  requires: { park: "frick", fraction: 0.5 },

  world: { minX: -340, maxX: 340, minZ: -250, maxZ: 250 },
  // Panther Hollow Lake and Westinghouse Pond both sit at this surface.
  waterLevel: -96,
  ceiling: 260,
  // High on Flagstaff Hill, on the open grass, with two hundred and forty units
  // of clear air ahead and the nearest tree eighty-five units away. The most
  // Schenley thing there is: you can see the whole park, and then you find out
  // that the best part of it is the bit you cannot see, under your feet.
  start: [-120, 89, 30],

  areas: [
    { id: "phipps", label: "Phipps Conservatory", center: [-250, -140] },
    { id: "flagstaff-hill", label: "Flagstaff Hill", center: [-170, 40] },
    { id: "schenley-oval", label: "Schenley Oval", center: [230, -110] },
    {
      id: "westinghouse",
      label: "Westinghouse Memorial",
      center: [250, 130],
    },
    { id: "junction-hollow", label: "Junction Hollow", center: [-280, 190] },
    // The wooded stream ravine below Phipps, where the spring ephemerals are.
    { id: "phipps-run", label: "Phipps Run", center: [-150, -110] },
  ],

  basins: [
    {
      area: {
        id: "panther-hollow-lake",
        label: "Panther Hollow Lake",
        center: LAKE,
      },
      center: LAKE,
      radius: 105,
    },
  ],

  valley: {
    area: { id: "panther-hollow", label: "Panther Hollow", center: [0, 0] },
    halfWidth: 58,
    centreLine: run,
    // Measured. The hollow is genuinely this steep.
    bankSlopeLimit: 2.6,
  },

  height,

  landmarks: {
    /** A hundred thousand panes of glass on the edge of the plateau. */
    phipps: [-250, -140],
    /** The flagpole at the top of the sledding hill. */
    flagpole: [-170, 40],
    /**
     * Schenley Drive, carried clean over the hollow, with a bronze panther
     * crouched on each of its four corners. From the bottom of the hollow it is
     * the sky, and the panthers are the size of houses.
     */
    pantherHollowBridge: [10, 30],
    /** The lake at the bottom of the hollow. */
    boathouse: [30, 170],
    /** The running track, and the tennis courts beside it. */
    oval: [230, -110],
    /** A curved bronze wall around a still pond, to a man who electrified things. */
    westinghouseMemorial: [250, 130],
    visitorCenter: [-96, -30],
    andersonPlayground: [-40, 190],
    /** The Junction Hollow trail, and the railway that runs down it. */
    junctionTrail: [-280, 190],
  },

  /**
   * Schenley's paths do a different job to Frick's. Frick is a trail network with
   * a wood around it; Schenley is a road network with a park around it, and the
   * hollow is the one place you have to walk.
   */
  trails: [
    // The Panther Hollow Trail, along the bottom, beside the run.
    (t) => [run(t) + 14, t],
    // Bridle Trail, contouring the east wall of the hollow.
    (t) => [run(t) + 92 + 12 * Math.sin(t * 0.02), t],
    // Junction Hollow, down the west side, dead straight because the railway is.
    (t) => [-282 + 6 * Math.sin(t * 0.01), t],
    // Serpentine Drive, looping the top of Flagstaff Hill.
    (t) => [-170 + 150 * Math.cos(t * 0.012), 40 + 120 * Math.sin(t * 0.012)],
  ],

  biomeColor: {
    // Clipped lawn and gravel walks.
    phipps: "#93c56a",
    // Silt and shallows.
    "panther-hollow-lake": "#5c7f56",
    // Damp shade under the ravine below the conservatory.
    "phipps-run": "#436b3b",
    // Mown, treeless, and covered in people the moment it snows.
    "flagstaff-hill": "#9ecb63",
    // A running track: as manicured as grass gets.
    "schenley-oval": "#7fc457",
    // Still water and cut grass around the memorial.
    westinghouse: "#6f9a58",
    // The floor of the hollow: silt, roots and shade.
    "panther-hollow": "#4c7442",
    // Deep shade and railway cinders.
    "junction-hollow": "#3f6636",
  },

  // The hollow is where everything grows. The top of the park is mown to within
  // an inch of its life, which is true of the real place and is the whole
  // contrast with Frick.
  biome: {
    "panther-hollow": "valley-floor",
    "panther-hollow-lake": "valley-floor",
    "phipps-run": "deep-woods",
    "junction-hollow": "deep-woods",
    westinghouse: "mown",
    phipps: "mown",
    "flagstaff-hill": "mown",
    "schenley-oval": "mown",
  },

  density: {
    "panther-hollow": 0.9,
    "panther-hollow-lake": 0.45,
    "phipps-run": 0.8,
    "junction-hollow": 0.72,
    westinghouse: 0.34,
    phipps: 0.26,
    // Half of Pittsburgh sledges down this. It is mown, and it is bare.
    "flagstaff-hill": 0.04,
    "schenley-oval": 0.1,
  },
};
