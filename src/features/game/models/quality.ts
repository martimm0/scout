/**
 * How finely the park is drawn, and how it is lit.
 *
 * One description of every model compiles at two voxel sizes. High is the look
 * the art is authored for. Low is the same shapes in blocks twice the size, one
 * variant of each tree instead of three, the coarse ground and no tree shadows,
 * and it is held to what the park cost before any of this existed, because that
 * is the build a phone was already running.
 *
 * Ultra is High's park photographed: the same blocks, lit and shaded the way a
 * real miniature would be (see `components/ultra`). It is never anybody's
 * default. A player asks for it.
 */
export type Quality = "low" | "high" | "ultra";

export const QUALITIES: readonly Quality[] = ["low", "high", "ultra"];

export function parseQuality(value: string): Quality | undefined {
  return value === "low" || value === "high" || value === "ultra" ? value : undefined;
}

/** The fine park: High's models and ground, which Ultra shares. */
export function isFine(quality: Quality) {
  return quality !== "low";
}

/**
 * The quality a model is BUILT at, for everything Ultra draws exactly as High
 * does: the ground, the trees, the buildings. Asking for those "at ultra" would
 * rebuild the whole park for an identical result every time the switch moved.
 * The flowers, the fungi and the bee are finer on Ultra and do not use this.
 */
export function sharedDetail(quality: Quality): Quality {
  return quality === "ultra" ? "high" : quality;
}

/** What a model's voxel size is multiplied by. */
export function voxelScale(quality: Quality) {
  return isFine(quality) ? 1 : 2;
}

/**
 * A quality pinned by the address bar, for the page's whole life.
 *
 * `?quality=low` is a test hook in the same family as `?hour=`. It lives here
 * as plain module state rather than in the store because the geometry is built
 * on the first render, before any effect could have set a store field, and
 * building the whole park twice to honour a pin would defeat the point of it.
 */
let pinned: Quality | null = null;

export function pinQuality(quality: Quality | null) {
  pinned = quality;
}

export function pinnedQuality() {
  return pinned;
}
