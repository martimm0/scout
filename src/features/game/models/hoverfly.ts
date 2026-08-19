import { shade } from "./voxel";
import type { Colors, SpeciesSpec } from "./species";

/**
 * The hoverfly (Syrphidae). A fly wearing a bee's warning colours.
 *
 * The reason it doesn't just look like a recoloured bee:
 *
 *  - **Eyes.** A fly's eyes are enormous and meet across the top of its head.
 *    They are most of the animal's face. Get these right and it reads as a fly
 *    before anything else does.
 *  - **One pair of wings.** Flies are Diptera, two wings, not four. The hind
 *    pair evolved into halteres, little gyroscopic knobs, which is *why* it can
 *    hang in the air like that. The knobs are modelled.
 *  - **Flat, not fuzzy.** A bee is a fur coat. A hoverfly is bare and shiny,
 *    with hard painted bands rather than fluff.
 *  - **Stubby antennae.** Bee antennae are long feelers. A fly's are barely there.
 */

/**
 * Eyes dominate; the face is a thin dark wedge between them.
 *
 * Short and shallow on purpose. The first version was as tall and deep as the
 * thorax, and with dark eyes the whole front half of the animal fused into one
 * black brick: you couldn't tell it was a fly, or that it had a face.
 */
const HEAD_LAYERS = [
  ["..DDD..", ".DDDDD.", "..DDD.."],
  ["EEEDEEE", "EEEEEEE", ".EEEEE."],
  ["EEEDEEE", "EEEEEEE", ".EEEEE."],
  // The eyes meet over the crown. This is the fly tell, and it needs to be seen.
  ["GEEEEEG", ".EEEEE.", "..EEE.."],
];

// Bare and hard, not furred. A dark shell with a pale shoulder stripe.
const THORAX_LAYERS = [
  ["..DDD..", ".DDDDD.", ".DDDDD.", "..DDD.."],
  [".CDDDC.", "CDDDDDC", "CDDDDDC", ".CDDDC."],
  [".CDDDC.", "CDDDDDC", "CDDDDDC", ".CDDDC."],
  [".CDDDC.", "CDDDDDC", "CDDDDDC", ".CDDDC."],
  ["..DDD..", ".CCCCC.", ".CCCCC.", "..DDD.."],
];

// Flat and wide, with crisp painted bands. Not a bee's fat round barrel.
const ABDOMEN_LAYERS = [
  ["..BBB..", "..SSS..", "..BBB..", "..SSS..", "..BBB..", "..SSS..", "...S..."],
  [".BBBBB.", ".SSSSS.", ".BBBBB.", ".SSSSS.", ".BBBBB.", ".SSSSS.", "..SSS.."],
  ["BBBBBBB", "SSSSSSS", "BBBBBBB", "SSSSSSS", "BBBBBBB", ".SSSSS.", "..SSS.."],
  [".BBBBB.", ".SSSSS.", ".BBBBB.", ".SSSSS.", ".BBBBB.", ".SSSSS.", "..SSS.."],
  ["..BBB..", "..SSS..", "..BBB..", "..SSS..", "..BBB..", "..SSS..", "...S..."],
];

// One pair. Long, narrow, and clear.
const WING_LAYERS = [
  [
    "...WWWWWW.",
    ".WWWWWWWWW",
    "WWWWWWWWWW",
    ".WWWWWWWW.",
    "...WWWW...",
  ],
];

/**
 * Halteres: the vestigial hind wings, beating out of phase as gyroscopes. They
 * are the reason this thing can hold a position in a breeze, so they are here
 * where a bee's hind wings would be.
 */
const HALTERE_LAYERS = [["..D..", ".DDD.", "..D.."]];

const LEG_LAYERS = [
  [".L.....L.", ".........", ".L.....L.", ".........", ".L.....L."],
  ["..L...L..", ".........", "..L...L..", ".........", "..L...L.."],
];

const POLLEN_LAYERS = [
  [".........", ".........", ".........", ".........", "K.......K"],
  [".........", ".........", ".........", ".........", "K.......K"],
];

// Barely there. A bee's long feelers on a fly would be plain wrong.
const ANTENNA_LAYERS = [
  ["..A.A.."],
  ["..D.D.."],
];

export const HOVERFLY_SPEC: SpeciesSpec = {
  id: "hoverfly",
  label: "Hoverfly",
  flightNote: "Darts and stops dead. Nothing else in the park can hold still like this.",
  voxelSize: 0.052,
  detailSize: 0.038,
  supportsWingStyle: false,

  parts: {
    head: { layers: HEAD_LAYERS, origin: [3.5, 2, 1.5] },
    thorax: { layers: THORAX_LAYERS, origin: [3.5, 2.5, 2] },
    abdomen: { layers: ABDOMEN_LAYERS, origin: [3.5, 2.5, 0] },
    wing: { layers: WING_LAYERS, origin: [0, 0, 2], ao: false },
    hindWing: { layers: HALTERE_LAYERS, origin: [0, 0, 1], size: 0.038 },
    legs: { layers: LEG_LAYERS, origin: [4.5, 2, 2.5], size: 0.038 },
    pollen: { layers: POLLEN_LAYERS, origin: [4.5, 2, 2.5], size: 0.038 },
    antennae: { layers: ANTENNA_LAYERS, origin: [3.5, 0, 0.5], size: 0.038 },
  },

  offsets: {
    head: [0, 0.02, -0.19],
    thorax: [0, 0, 0],
    abdomen: [0, -0.015, 0.105],
    wing: [0.14, 0.13, -0.02],
    // Halteres sit behind and below the wings, where the hind pair used to be.
    hindWing: [0.1, 0.02, 0.1],
    legs: [0, -0.15, 0.02],
    pollen: [0, -0.15, 0.02],
    antennae: [0, 0.15, -0.3],
  },

  animation: {
    // A blur. Hoverflies beat their wings far faster than bees.
    wingSpeed: 1.35,
    wingAmplitude: 0.72,
    // Almost none. Holding perfectly still is this animal's entire trick.
    bob: 0.28,
    // Halteres don't sweep with the wings; they vibrate. Barely move them.
    hindWingFollow: 0.12,
    wingRest: 0.06,
  },

  wings: {
    opacity: 0.55,
    // Halteres are solid little knobs, not glass.
    hindOpacity: 1,
    tinted: true,
  },

  flight: {
    speed: 1.12,
    turn: 1.4,
    // Very snappy. It arrives and stops, rather than easing.
    responsiveness: 1.8,
  },

  palette: ({ bodyColor }: Colors) => ({
    // Bare shell, not fuzz: darker and harder than a bee's coat.
    D: "#4a4238",
    C: shade(bodyColor, 0.1),
    // A hoverfly's eyes are a warm red-amber, and they need to READ as eyes.
    // The first pass used near-black, which fused the whole head into one
    // featureless dark block.
    E: "#c25a38",
    G: "#ffe3cf",
  }),
};
