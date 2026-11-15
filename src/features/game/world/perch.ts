import { plantPerch } from "../models/flora";
import { fungusPerch } from "../models/fungi";
import type { Quality } from "../models/quality";
import type { SpeciesInstance } from "./species-scatter";
import { groundDrop } from "./terrain";

const drops = new WeakMap<SpeciesInstance, number>();

/**
 * How far this plant is DRAWN from where it is, so that it stands on the
 * ground as the quality draws it: nothing on the low park, up to a unit down
 * on the fine park's stepped ground. See `groundDrop`.
 *
 * Kept per plant, because the answer is five samples of the height field and
 * the things that ask (the seed heads, the visiting bees) ask every frame.
 */
export function plantDrop(instance: SpeciesInstance, quality: Quality) {
  if (quality === "low") {
    return 0;
  }

  let drop = drops.get(instance);

  if (drop === undefined) {
    drop = groundDrop(instance.position[0], instance.position[2], quality);
    drops.set(instance, drop);
  }

  return drop;
}

/**
 * Where a bee sets down on one particular plant, in the world.
 *
 * Each form says where its perch is in its own units (the top of the bloom,
 * usually; the fork under the leaves, for a mayapple). This turns that into a
 * world point for the copy of it standing at this spot, turned this way and
 * grown to this size, where the given quality draws it.
 */
export function perchPoint(
  instance: SpeciesInstance,
  quality: Quality,
): [number, number, number] {
  const [lx, ly, lz] =
    instance.species.kind === "plant"
      ? plantPerch(instance.species.plant)
      : fungusPerch(instance.species.fungus);
  const cos = Math.cos(instance.rotation);
  const sin = Math.sin(instance.rotation);
  const { scale } = instance;

  return [
    instance.position[0] + (lx * cos + lz * sin) * scale,
    instance.position[1] + plantDrop(instance, quality) + ly * scale,
    instance.position[2] + (-lx * sin + lz * cos) * scale,
  ];
}
