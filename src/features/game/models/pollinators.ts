import type { PollinatorType } from "../state/game-store";
import { BEE_SPEC, beeWingLayers } from "./bee";
import { BUTTERFLY_SPEC } from "./butterfly";
import { HOVERFLY_SPEC } from "./hoverfly";
import {
  buildSpeciesGeometry,
  type Accessory,
  type Colors,
  type PollinatorGeometry,
  type SpeciesSpec,
  type WingStyle,
} from "./species";

/**
 * The three pollinators.
 *
 * Adding a fourth means writing one spec file. Nothing in the model component,
 * the flight loop or the customize screen needs to know it exists.
 */
export const SPECIES: Record<PollinatorType, SpeciesSpec> = {
  bee: BEE_SPEC,
  hoverfly: HOVERFLY_SPEC,
  butterfly: BUTTERFLY_SPEC,
};

export const SPECIES_LIST = [BEE_SPEC, HOVERFLY_SPEC, BUTTERFLY_SPEC];

export function speciesFor(type: PollinatorType) {
  return SPECIES[type] ?? BEE_SPEC;
}

export function buildPollinatorGeometry(
  type: PollinatorType,
  colors: Colors,
  wingStyle: WingStyle = "round",
  accessory: Accessory = "none",
): PollinatorGeometry {
  const spec = speciesFor(type);

  // Wing style is the bee's alone. A butterfly's wings ARE the butterfly, and a
  // hoverfly has exactly the two it needs — restyling either would just be
  // vandalism.
  const resolved: SpeciesSpec = spec.supportsWingStyle
    ? {
        ...spec,
        parts: {
          ...spec.parts,
          wing: { ...spec.parts.wing, layers: beeWingLayers(wingStyle) },
        },
      }
    : spec;

  return buildSpeciesGeometry(resolved, colors, accessory);
}

export { accessoryOffset, ACCESSORIES, WING_STYLES } from "./species";
export type { Accessory, Colors, PollinatorGeometry, SpeciesSpec, WingStyle };
