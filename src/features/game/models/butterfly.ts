import { shade } from "./voxel";
import type { Colors, SpeciesSpec } from "./species";

/**
 * The butterfly. A monarch, in spirit.
 *
 * A butterfly is mostly wings, and everything else has to get out of their way:
 *
 *  - **Two huge pairs.** Forewings and hindwings, both enormous, both patterned
 *    with dark veins and a rim of white spots. This is the whole silhouette.
 *  - **A slim body.** No bee barrel, no fly shell. A thin thread of an abdomen
 *    that would look ridiculous on anything else.
 *  - **Clubbed antennae.** The single feature that separates a butterfly from a
 *    moth, so they get a proper knob on the end.
 *  - **A coiled proboscis** under the head, the drinking straw it feeds through.
 *
 * It flies the way it looks: slowly, floatily, and with an enormous bob. It is
 * the least efficient pollinator in the park and by far the nicest to watch.
 */

const HEAD_LAYERS = [
  ["..DDD..", ".DDDDD.", "..DDD.."],
  [".EEDEE.", "EEEDEEE", ".EEDEE."],
  [".EEDEE.", "GEEDEEG", ".EEDEE."],
  ["..DDD..", ".DDDDD.", "..DDD.."],
];

// Small and furred: butterflies are surprisingly fuzzy across the shoulders.
const THORAX_LAYERS = [
  ["..FFF..", "..FFF..", "..FFF.."],
  [".FFFFF.", ".FFFFF.", ".FFFFF."],
  [".FFFFF.", ".FFFFF.", ".FFFFF."],
  ["..FFF..", "..FFF..", "..FFF.."],
];

// A thread. Long, thin, tapering, banded.
const ABDOMEN_LAYERS = [
  ["..SSS..", "..BBB..", "..SSS..", "..BBB..", "..SSS..", "...S...", "...S..."],
  ["..SSS..", "..BBB..", "..SSS..", "..BBB..", "..SSS..", "..SSS..", "...S..."],
  ["..SSS..", "..BBB..", "..SSS..", "..BBB..", "..SSS..", "...S...", "...S..."],
];

/**
 * The forewing. Body colour panelled by dark veins (V), rimmed with white
 * spots (M), which is exactly how you know a monarch from across a meadow.
 */
const WING_LAYERS = [
  [
    "...VVMVVM.",
    "..VBBVBBVM",
    ".VBBBVBBBV",
    "VBBBBVBBBM",
    "VBBBBVBBBV",
    ".VBBBVBBVM",
    "..VVBVBVV.",
    "...VVVVV..",
  ],
];

/** The hindwing: smaller, rounder, and just as loud. */
const HIND_WING_LAYERS = [
  [
    "..VVMVM.",
    ".VBBVBBV",
    "VBBBVBBM",
    "VBBBVBBV",
    ".VBBVBBM",
    "..VVVVV.",
  ],
];

// Thin, tucked, and mostly out of the way.
const LEG_LAYERS = [
  [".L.....L.", ".........", ".L.....L.", ".........", "........."],
  ["..L...L..", ".........", "..L...L..", ".........", "........."],
];

const POLLEN_LAYERS = [
  [".........", ".........", ".........", ".........", "K.......K"],
  [".........", ".........", ".........", ".........", "K.......K"],
];

/**
 * Long, with a club on the end. The club is the whole point: it is what makes it
 * a butterfly rather than a moth.
 */
const ANTENNA_LAYERS = [
  [".......", ".......", "..A.A.."],
  [".......", "..A.A..", "......."],
  ["..A.A..", ".......", "......."],
  ["..A.A..", ".......", "......."],
  // The club.
  ["..D.D..", ".......", "......."],
  ["..D.D..", ".......", "......."],
];

export const BUTTERFLY_SPEC: SpeciesSpec = {
  id: "butterfly",
  label: "Butterfly",
  flightNote: "Slow, floating, and hopeless in a breeze. Worth it anyway.",
  voxelSize: 0.05,
  detailSize: 0.036,
  supportsWingStyle: false,

  parts: {
    head: { layers: HEAD_LAYERS, origin: [3.5, 2, 1.5] },
    thorax: { layers: THORAX_LAYERS, origin: [3.5, 2, 1.5] },
    abdomen: { layers: ABDOMEN_LAYERS, origin: [3.5, 1.5, 0] },
    wing: { layers: WING_LAYERS, origin: [0, 0, 4], ao: false },
    hindWing: { layers: HIND_WING_LAYERS, origin: [0, 0, 3], ao: false },
    legs: { layers: LEG_LAYERS, origin: [4.5, 2, 2.5], size: 0.036 },
    pollen: { layers: POLLEN_LAYERS, origin: [4.5, 2, 2.5], size: 0.036 },
    antennae: { layers: ANTENNA_LAYERS, origin: [3.5, 0, 1], size: 0.036 },
  },

  offsets: {
    head: [0, 0.02, -0.16],
    thorax: [0, 0, 0],
    abdomen: [0, -0.01, 0.07],
    // The wings are huge, so they hinge close in and sit high on the shoulder.
    wing: [0.06, 0.06, -0.02],
    hindWing: [0.05, 0.02, 0.12],
    legs: [0, -0.1, 0.02],
    pollen: [0, -0.1, 0.02],
    antennae: [0, 0.11, -0.22],
  },

  animation: {
    // Slow and enormous. You can count the beats.
    wingSpeed: 0.32,
    wingAmplitude: 1.15,
    // A big, lazy float. This is most of what makes it read as a butterfly.
    bob: 2.4,
    // Hindwings are hooked to the forewings and sweep almost as far.
    hindWingFollow: 0.88,
    // Held high at rest: that upward V is the resting butterfly pose.
    wingRest: 0.5,
  },

  wings: {
    // Opaque. You are looking AT them, not through them.
    opacity: 1,
    hindOpacity: 1,
    tinted: false,
  },

  flight: {
    speed: 0.82,
    turn: 0.72,
    // Floaty. It drifts to a stop rather than braking.
    responsiveness: 0.45,
  },

  palette: ({ accentColor, bodyColor }: Colors) => ({
    // Wing panels take the BODY colour, not the wing colour, a monarch's wings
    // are the animal. The "wing colour" would render them as glass.
    B: bodyColor,
    V: "#231a12",
    M: "#f6f1e4",
    // Dark fuzz across the shoulders. A tint of the body colour came out
    // bubblegum pink, which is not a thing a butterfly has.
    F: "#4a3c2c",
    S: "#231a12",
    C: shade(bodyColor, 0.35),
    X: accentColor,
  }),
};
