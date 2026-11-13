import { plantPerch } from "../models/flora";
import { fungusPerch } from "../models/fungi";
import type { SpeciesInstance } from "./species-scatter";

/**
 * Where a bee sets down on one particular plant, in the world.
 *
 * Each form says where its perch is in its own units (the top of the bloom,
 * usually; the fork under the leaves, for a mayapple). This turns that into a
 * world point for the copy of it standing at this spot, turned this way and
 * grown to this size.
 */
export function perchPoint(instance: SpeciesInstance): [number, number, number] {
  const [lx, ly, lz] =
    instance.species.kind === "plant"
      ? plantPerch(instance.species.plant)
      : fungusPerch(instance.species.fungus);
  const cos = Math.cos(instance.rotation);
  const sin = Math.sin(instance.rotation);
  const { scale } = instance;

  return [
    instance.position[0] + (lx * cos + lz * sin) * scale,
    instance.position[1] + ly * scale,
    instance.position[2] + (-lx * sin + lz * cos) * scale,
  ];
}
