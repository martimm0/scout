import { shade } from "./voxel";
import type { Colors, SpeciesSpec } from "./species";

/**
 * The moth. A hawk moth, in spirit.
 *
 * Almost every choice here is a deliberate contrast with the butterfly, because
 * that is the honest way to teach the difference. People think "moth" means
 * "drab butterfly" and it does not: they are two branches of one order, moths
 * enormously outnumber butterflies, and the differences are structural.
 *
 *  - **Feathered antennae, no club.** This is THE field mark, and it is the one
 *    the butterfly spec already calls out from the other side. A butterfly's
 *    antenna ends in a knob; a moth's is a comb, and on a male it is an
 *    extraordinary feathered fan that can pick up a female's scent from a
 *    kilometre away, molecule by molecule.
 *  - **A thick furred body.** Not a thread. A hawk moth is built like a cigar
 *    and the fur is not decoration: moths warm up by shivering their flight
 *    muscles before takeoff, and the fur is insulation that holds that heat in.
 *    It is what lets them fly on a night too cold for any bee.
 *  - **Narrow, swept wings held flat.** Where a butterfly holds a broad pair up
 *    in a V, a hawk moth's are long and pointed and folded back over the body
 *    like a jet. It is the fastest insect in the park.
 *  - **Dull colours, and a reason.** Nothing is advertising to a bird that
 *    cannot see it. The pattern is disruptive camouflage, for the daylight
 *    hours it spends motionless on bark being invisible.
 *
 * It flies the way it looks: fast, direct, and able to hold a hover at a flower
 * that would put a butterfly on the ground.
 */

const HEAD_LAYERS = [
  ["..FFF..", ".FFFFF.", "..FFF.."],
  [".EEFEE.", "EEEFEEE", ".EEFEE."],
  [".EEFEE.", "EEEFEEE", ".EEFEE."],
  ["..FFF..", ".FFFFF.", "..FFF.."],
];

/**
 * Thick and heavily furred. A hawk moth's thorax is the engine room, and the
 * fur over it is the insulation that keeps the shivering worth doing.
 */
const THORAX_LAYERS = [
  [".FFFFF.", ".FFFFF.", ".FFFFF."],
  ["FFFFFFF", "FFFFFFF", "FFFFFFF"],
  ["FFFFFFF", "FFFFFFF", "FFFFFFF"],
  [".FFFFF.", ".FFFFF.", ".FFFFF."],
];

/** A tapered cigar, banded, and nothing like the butterfly's thread. */
const ABDOMEN_LAYERS = [
  [".BBBBB.", ".SSSSS.", ".BBBBB.", ".SSSSS.", "..BBB..", "..SSS.."],
  ["BBBBBBB", "SSSSSSS", "BBBBBBB", "SSSSSSS", ".BBBBB.", "..SSS.."],
  [".BBBBB.", ".SSSSS.", ".BBBBB.", ".SSSSS.", "..BBB..", "..SSS.."],
];

/**
 * The forewing: long, pointed, swept back, and marked with the broken
 * grey-brown streaking that makes a resting hawk moth disappear into bark.
 */
const WING_LAYERS = [
  [
    "VVMVVVMVVV",
    "VBBVBBBVBB",
    "MBBBVBBBVB",
    "VBBBBVBBBV",
    ".MBBBBVBBV",
    "..VBBBBVBM",
    "...VVBBBVV",
    "....VVVVV.",
  ],
];

/** The hindwing: short and mostly hidden under the forewing at rest. */
const HIND_WING_LAYERS = [
  ["..VVMV.", ".VBBVBB", "VBBBVBB", ".VBBVBM", "..VVVV."],
];

const LEG_LAYERS = [
  [".L.....L.", ".........", ".L.....L.", ".........", "........."],
  ["..L...L..", ".........", "..L...L..", ".........", "........."],
];

const POLLEN_LAYERS = [
  [".........", ".........", ".........", ".........", "K.......K"],
  [".........", ".........", ".........", ".........", "K.......K"],
];

/**
 * Feathered. The whole point of the model.
 *
 * Widening rather than clubbing: each rung is broader than the one before, so
 * the silhouette reads as a comb from any angle. A moth that ended in a knob
 * would be a butterfly wearing the wrong palette, and the one field mark this
 * model exists to teach would be gone.
 */
const ANTENNA_LAYERS = [
  ["..A.A..", ".......", "......."],
  [".AA.AA.", ".......", "......."],
  [".AA.AA.", ".......", "......."],
  ["AAA.AAA", ".......", "......."],
  ["AAA.AAA", ".......", "......."],
  [".AA.AA.", ".......", "......."],
];

export const MOTH_SPEC: SpeciesSpec = {
  id: "moth",
  label: "Moth",
  flightNote: "Fast, furred, and awake when nothing else is.",
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
    abdomen: [0, -0.01, 0.08],
    // Swept BACK, unlike the butterfly's, which hinge forward and high. A hawk
    // moth carries its wings folded along the body.
    wing: [0.06, 0.03, 0.04],
    hindWing: [0.05, 0, 0.14],
    legs: [0, -0.1, 0.02],
    pollen: [0, -0.1, 0.02],
    antennae: [0, 0.11, -0.22],
  },

  animation: {
    /**
     * Fast enough to blur, which is the opposite end of the range from the
     * butterfly's countable beats. A hovering hawk moth is regularly mistaken
     * for a hummingbird, and the wingbeat is most of why.
     */
    wingSpeed: 1.45,
    wingAmplitude: 0.72,
    // Almost none. It holds station at a flower rather than floating about.
    bob: 0.5,
    hindWingFollow: 0.7,
    // Held flat and back at rest, not up in a V.
    wingRest: 0.08,
  },

  wings: {
    opacity: 1,
    hindOpacity: 1,
    // Patterned panels carried in vertex colours, like the butterfly's: tinting
    // them by a wing colour would wash the camouflage into a smear.
    tinted: false,
  },

  flight: {
    // The fastest thing you can fly, and the twitchiest.
    speed: 1.22,
    turn: 1.1,
    responsiveness: 0.95,
  },

  palette: ({ accentColor, bodyColor }: Colors) => ({
    B: bodyColor,
    // The streaking. Broken greys and browns rather than a monarch's hard black
    // veins: this is camouflage, not a warning.
    V: "#4a4038",
    M: "#b7ac97",
    // Thick pale fur over the shoulders and head.
    F: "#cbb897",
    S: "#3b332b",
    C: shade(bodyColor, 0.35),
    X: accentColor,
  }),
};
