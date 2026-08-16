import type { BufferGeometry } from "three";

import { buildVoxelGeometry, shade, tint, type VoxelPalette } from "./voxel";

/**
 * A pollinator species, as data.
 *
 * The bee, the hoverfly, the butterfly and the moth are the same machine with
 * different numbers in it: the same text-art voxel pipeline, the same part names, the same
 * animation rig. What differs is the art, the proportions, and how the thing
 * flies — and all three of those live in a spec object rather than in a fork of
 * the model component.
 *
 * That is the whole reason the bee was authored as data in the first place.
 */

export const WING_STYLES = ["round", "long", "stubby"] as const;
export type WingStyle = (typeof WING_STYLES)[number];

export const ACCESSORIES = [
  "none",
  "cap",
  "flower",
  "scarf",
  "lantern",
  "crown",
  "goggles",
  "backpack",
  "antennaeBow",
  "raincoat",
] as const;
export type Accessory = (typeof ACCESSORIES)[number];

export type PartName =
  | "head"
  | "thorax"
  | "abdomen"
  | "wing"
  | "hindWing"
  | "legs"
  | "pollen"
  | "antennae";

export type Part = {
  layers: string[][];
  origin: [number, number, number];
  /** Defaults to the species' body voxel size. */
  size?: number;
  ao?: boolean;
};

export type SpeciesAnimation = {
  /** Multiplies the base wingbeat. A hoverfly's blur; a butterfly's slow sweep. */
  wingSpeed: number;
  wingAmplitude: number;
  /** How much the body bobs. A hoverfly holds dead still; a butterfly floats. */
  bob: number;
  /** How far the hind wings follow the fore wings. 0 for a fly, which has none. */
  hindWingFollow: number;
  /** Resting angle of the wings. Butterflies hold theirs high. */
  wingRest: number;
};

/** How a species handles. This is what makes choosing one a real choice. */
export type SpeciesFlight = {
  speed: number;
  turn: number;
  /** How quickly it reaches its speed. High is darty, low is floaty. */
  responsiveness: number;
};

export type SpeciesWings = {
  opacity: number;
  hindOpacity: number;
  /**
   * Whether the wing material is tinted by the player's wing colour.
   *
   * A bee's and a hoverfly's wings are glass — tint away. A butterfly's wings
   * are the ANIMAL: patterned panels with veins and spots, carried in the vertex
   * colours. Multiplying those by a wing colour would wash the pattern out into
   * a stained-glass smear, so a butterfly's material stays white and lets the
   * pattern speak.
   */
  tinted: boolean;
};

export type SpeciesSpec = {
  id: "bee" | "hoverfly" | "butterfly" | "moth";
  label: string;
  /** One line, in the customize screen and the journal. */
  flightNote: string;
  voxelSize: number;
  detailSize: number;
  /** Wing style is a bee thing. A butterfly's wings are the butterfly. */
  supportsWingStyle: boolean;
  parts: Record<Exclude<PartName, "hindWing">, Part> & {
    hindWing: Part | null;
  };
  offsets: Record<PartName, [number, number, number]>;
  animation: SpeciesAnimation;
  flight: SpeciesFlight;
  wings: SpeciesWings;
  /** Species-specific palette entries, merged over the shared ones. */
  palette: (colors: Colors) => VoxelPalette;
};

export type Colors = {
  bodyColor: string;
  wingColor: string;
  accentColor: string;
};

export type PollinatorGeometry = Record<
  Exclude<PartName, "hindWing">,
  BufferGeometry
> & {
  hindWing: BufferGeometry | null;
  accessory: BufferGeometry | null;
};

/** Palette entries every species shares. */
export function basePalette({ accentColor, bodyColor, wingColor }: Colors): VoxelPalette {
  const chitin = "#2a2119";

  return {
    B: bodyColor,
    S: chitin,
    D: chitin,
    A: chitin,
    L: chitin,
    E: "#181510",
    G: "#ffffff",
    C: shade(bodyColor, 0.3),
    F: tint(bodyColor, 0.42),
    K: "#f0a52e",
    W: wingColor,
    // Accessories.
    X: accentColor,
    R: "#e4759b",
    Y: "#f7e07a",
    N: "#5f9a45",
    // The foxfire lantern glows whatever the bitter oyster glows.
    O: "#8ef07a",
    // Bronze, for the crown. Same bronze as the panthers on the bridge.
    Z: "#8d7346",
    // Glass, for the goggles.
    V: "#a8d8e8",
    // Waxed canvas.
    U: "#d8b24a",
  };
}

// Accessories are shared: a hoverfly in a little cap is exactly as good an idea
// as a bee in one.
const CAP_LAYERS = [
  [".XXXXX.", "XXXXXXX", "XXXXXXX", ".XXXXX."],
  ["..XXX..", ".XXXXX.", ".XXXXX.", "..XXX.."],
  [".......", "..XXX..", "..XXX..", "......."],
];

const FLOWER_LAYERS = [
  ["...N...", "..NNN..", "...N..."],
  ["..R.R..", ".RRYRR.", "..R.R.."],
];

const SCARF_LAYERS = [
  ["XXXXXXX", "XXXXXXX"],
  [".XXXXX.", "..XXX.."],
];

/**
 * A foxfire lantern, carried like a satchel.
 *
 * The bitter oyster glows green on rotting wood at night, and this is a piece of
 * it in a jar. Earned by finding the thing itself, which is the only way anybody
 * would have got one.
 */
const LANTERN_LAYERS = [
  ["..ZZZ..", "..Z.Z..", ".......", ".......", "......."],
  ["..ZZZ..", ".ZOOOZ.", ".ZOOOZ.", ".ZOOOZ.", "..ZZZ.."],
  ["..ZZZ..", ".ZOOOZ.", ".ZOOOZ.", ".ZOOOZ.", "..ZZZ.."],
];

/** A little bronze crown. For having seen the whole city. */
const CROWN_LAYERS = [
  ["Z.Z.Z.Z", "ZZZZZZZ", "ZZZZZZZ"],
  [".......", "Z.Z.Z.Z", "ZZZZZZZ"],
];

/** Flying goggles, for a bee who has been out in all weathers. */
const GOGGLES_LAYERS = [
  ["ZZ...ZZ", "ZVVZVVZ", "ZVVZVVZ", "ZZ...ZZ"],
  ["ZZZZZZZ", ".......", ".......", "ZZZZZZZ"],
];

/** A field naturalist's satchel, in waxed canvas, with a strap. */
const BACKPACK_LAYERS = [
  [".UUUUU.", "UUUUUUU", "UUUUUUU", ".UUUUU."],
  ["..UUU..", ".UUUUU.", ".UUUUU.", "..UUU.."],
  ["...X...", "...X...", "...X...", "...X..."],
];

/** A bow, on the antennae. Purely and unashamedly for fun. */
const ANTENNAE_BOW_LAYERS = [
  ["RR.R.RR", "RRRRRRR", "RR.R.RR"],
  [".R...R.", ".RRYRR.", ".R...R."],
];

/** A tiny sou'wester, for somebody who kept flying in the rain. */
const RAINCOAT_LAYERS = [
  ["YYYYYYY", "YYYYYYY", "YYYYYYY", "YYYYYYY"],
  [".YYYYY.", ".YYYYY.", ".YYYYY.", ".YYYYY."],
  ["..YYY..", "..YYY..", "..YYY..", "..YYY.."],
];

const ACCESSORY_LAYERS: Record<Accessory, string[][] | null> = {
  none: null,
  cap: CAP_LAYERS,
  flower: FLOWER_LAYERS,
  scarf: SCARF_LAYERS,
  lantern: LANTERN_LAYERS,
  crown: CROWN_LAYERS,
  goggles: GOGGLES_LAYERS,
  backpack: BACKPACK_LAYERS,
  antennaeBow: ANTENNAE_BOW_LAYERS,
  raincoat: RAINCOAT_LAYERS,
};

const ACCESSORY_OFFSET: Record<Accessory, [number, number, number]> = {
  none: [0, 0, 0],
  cap: [0, 0.2, -0.2],
  flower: [0.12, 0.21, -0.2],
  scarf: [0, -0.04, -0.11],
  // Slung at the side, where a satchel hangs.
  lantern: [0.22, -0.02, 0.06],
  crown: [0, 0.24, -0.2],
  goggles: [0, 0.14, -0.3],
  backpack: [0, 0.06, 0.16],
  antennaeBow: [0, 0.3, -0.24],
  raincoat: [0, 0.22, -0.19],
};

export function accessoryOffset(accessory: Accessory) {
  return ACCESSORY_OFFSET[accessory];
}

export function buildSpeciesGeometry(
  spec: SpeciesSpec,
  colors: Colors,
  accessory: Accessory = "none",
): PollinatorGeometry {
  const palette = { ...basePalette(colors), ...spec.palette(colors) };

  const compile = (part: Part) =>
    buildVoxelGeometry({
      ao: part.ao,
      layers: part.layers,
      origin: part.origin,
      palette,
      size: part.size ?? spec.voxelSize,
    });

  const accessoryLayers = ACCESSORY_LAYERS[accessory];

  return {
    head: compile(spec.parts.head),
    thorax: compile(spec.parts.thorax),
    abdomen: compile(spec.parts.abdomen),
    wing: compile(spec.parts.wing),
    hindWing: spec.parts.hindWing ? compile(spec.parts.hindWing) : null,
    legs: compile(spec.parts.legs),
    pollen: compile(spec.parts.pollen),
    antennae: compile(spec.parts.antennae),
    accessory: accessoryLayers
      ? buildVoxelGeometry({
          layers: accessoryLayers,
          origin: [3.5, 0, 1.5],
          palette,
          size: spec.voxelSize,
        })
      : null,
  };
}

/**
 * The raincoat, on its own and in the player's chosen colour.
 *
 * Built apart from the accessory slot so a bee can wear its hat AND its coat, and
 * so the coat can come and go with the rain without rebuilding the whole bee. Only
 * the letter Y is used in the layers, so the palette is a single colour.
 */
export function buildRaincoatGeometry(voxelSize: number, color: string) {
  return buildVoxelGeometry({
    layers: RAINCOAT_LAYERS,
    origin: [3.5, 0, 1.5],
    palette: { Y: color },
    size: voxelSize,
  });
}

export const RAINCOAT_OFFSET = ACCESSORY_OFFSET.raincoat;

export function disposePollinatorGeometry(geometry: PollinatorGeometry) {
  for (const part of Object.values(geometry)) {
    part?.dispose();
  }
}
