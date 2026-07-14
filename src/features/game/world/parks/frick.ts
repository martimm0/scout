import { fbm, influence, lerp, type Park } from "../park";

/**
 * Frick Park, as a height function, at the scale of the thing flying over it.
 *
 * The world is ~700x520 units and a bee is under one unit long. Trees run 60-100
 * units, a flower stalk 15-25, a blade of grass 4. That ratio is the whole point:
 * you are an insect in a real park, and a place you could walk across in twenty
 * minutes is a continent.
 *
 * The map is cut around what is actually in Frick Park (the Environmental Center
 * and its gatehouse, the Blue Slide, the lawn bowling green, Nine Mile Run in the
 * valley, Falls Ravine, Fern Hollow) rather than around generic biomes.
 *
 * Everything here is lifted unchanged from the single-park version. The park has
 * not moved a single unit; it has only stopped being the only one.
 */

/** The centre line of Nine Mile Run, meandering down the valley floor. */
function creek(z: number) {
  return 70 * Math.sin(z * 0.006) + 30 * Math.sin(z * 0.016 + 1.3);
}

function height(x: number, z: number) {
  const distanceToCreek = Math.abs(x - creek(z));

  let value = (fbm(x * 0.0022, z * 0.0022, 4) - 0.5) * 90;
  value += (fbm(x * 0.01, z * 0.01, 2) - 0.5) * 14;

  // Carve the valley. Flattening the noise as we approach the creek keeps the
  // valley floor flyable rather than lumpy.
  const valley = Math.exp(-(distanceToCreek * distanceToCreek) / (2 * 62 * 62));
  value = value * (1 - 0.85 * valley) - 95 * valley;

  // Ridges flanking the valley: the wooded slopes that make it a ravine from the
  // air rather than a ditch.
  const shoulder = Math.exp(-((distanceToCreek - 125) ** 2) / (2 * 55 * 55));
  value += 34 * shoulder;

  // The lawn at the Environmental Center is mown flat.
  const lawn = influence(x, z, -240, 205, 95);
  value = lerp(value, 26, lawn * 0.93);

  // The bowling green is a true plateau. It has to be dead level; that is the
  // entire point of a bowling green.
  const green = influence(x, z, 245, -55, 60);
  value = lerp(value, 30, green * 0.97);

  // The playground sits on a shelf, with the slide running off it.
  const playground = influence(x, z, 215, 175, 78);
  value = lerp(value, 18, playground * 0.88);

  return value;
}

export const FRICK: Park = {
  id: "frick",
  label: "Frick Park",
  blurb:
    "Six hundred acres of Pittsburgh, a creek at the bottom of it, and a slide that children have been coming down on flattened cardboard for generations.",

  world: { minX: -350, maxX: 350, minZ: -260, maxZ: 260 },
  waterLevel: -88,
  ceiling: 260,
  start: [-180, 34, 155],

  areas: [
    {
      id: "environmental-center",
      label: "Frick Environmental Center",
      center: [-240, 205],
    },
    { id: "blue-slide", label: "Blue Slide Playground", center: [215, 175] },
    { id: "bowling-green", label: "Lawn Bowling Green", center: [245, -55] },
    { id: "falls-ravine", label: "Falls Ravine", center: [-215, -45] },
    { id: "fern-hollow", label: "Fern Hollow", center: [-140, -215] },
  ],

  valley: {
    area: { id: "nine-mile-run", label: "Nine Mile Run", center: [0, 0] },
    halfWidth: 68,
    centreLine: creek,
    bankSlopeLimit: 1.4,
  },

  height,

  landmarks: {
    /** A concrete hillside you would need a whole afternoon to climb. */
    blueSlide: [215, 175],
    center: [-232, 190],
    /** The stone gatehouse at the Beechwood Boulevard entrance. */
    gatehouse: [-268, 226],
    bowlingGreen: [245, -55],
    tennisCourts: [286, -14],
    /**
     * Forbes Avenue, carried over the top of the hollow. It fell into the ravine
     * in January 2022 and was rebuilt inside a year. From the valley floor it is
     * the sky.
     */
    fernHollowBridge: [-30, -150],
    stoneSteps: [-92, 60],
    swings: [150, 205],
    pavilion: [-190, 90],
    /** A storm outfall into Nine Mile Run. The restoration story, in concrete. */
    culvert: [-52, 10],
  },

  /**
   * Frick Park is really a trail network with a wood around it: Tranquil, Falls
   * Ravine, Riverview, Homewood. They colour the ground bare and brown, they
   * clear the scatter so a trail is actually walkable, and they give a lost bee
   * something to follow home.
   */
  trails: [
    (t) => [creek(t) - 42 + 12 * Math.sin(t * 0.03), t],
    (t) => [creek(t) + 78 + 16 * Math.sin(t * 0.022 + 2), t],
    (t) => [-150 + t * 0.55, -60 + t * 0.9],
    (t) => [-230 + t * 1.6, 170 - t * 0.35],
  ],

  biomeColor: {
    // Mown lawn around the centre.
    "environmental-center": "#8cc063",
    // Trampled grass and wood chips around the playground.
    "blue-slide": "#9dbb62",
    // Manicured to within an inch of its life.
    "bowling-green": "#7fc457",
    // The valley floor: silt, gravel and wet meadow.
    "nine-mile-run": "#5d8052",
    // Steep hemlock slopes.
    "falls-ravine": "#456f42",
    // Deep shade under a closed canopy.
    "fern-hollow": "#39632f",
  },

  // The bowling green stays clipped, because a bowling green with a tree on it
  // is not a bowling green.
  biome: {
    "fern-hollow": "deep-woods",
    "falls-ravine": "slope-woods",
    "nine-mile-run": "valley-floor",
    "environmental-center": "mown",
    "blue-slide": "mown",
    "bowling-green": "mown",
  },

  density: {
    "fern-hollow": 0.85,
    "falls-ravine": 0.68,
    "nine-mile-run": 0.4,
    "environmental-center": 0.3,
    "blue-slide": 0.3,
    "bowling-green": 0.14,
  },
};
