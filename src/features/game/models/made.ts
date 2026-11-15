import type { Paint } from "./voxel-grid";

/**
 * What a block is made of.
 *
 * A model is one mesh with one material, which was fine while every material
 * was the same matte paint. On Ultra a surface has a roughness and a way with
 * light, and one answer for a whole model is wrong as soon as the model is two
 * things: a trunk under a canopy, a window in a wall. So a block can say what
 * it is made of, the mesher carries that through to each vertex, and the Ultra
 * shader looks it up (`MADE_FRAGMENT` in `world/surface.ts`).
 *
 * `plain` is "whatever this kind of model usually is": a petal on a flower, a
 * leaf on a tree, stone on a building. Only the exceptions need saying.
 */
export const MADE = { plain: 0, leaf: 1, wood: 2, stone: 3, glass: 4, metal: 5, water: 6 } as const;

export type Made = (typeof MADE)[keyof typeof MADE];

/** A colour, made of something. The grid reads the tag off the end. */
export function made(hex: string, what: Made) {
  return what === MADE.plain ? hex : `${hex}@${what}`;
}

/** A paint whose every block is made of the one thing. Applied last, outermost. */
export function madeOf(paint: Paint, what: Made): Paint {
  return typeof paint === "string" ? made(paint, what) : (x, y, z, h) => made(paint(x, y, z, h), what);
}
