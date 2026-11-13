/**
 * How finely the park is drawn.
 *
 * One description of every model compiles at two voxel sizes. High is the look
 * the art is authored for. Low is the same shapes in blocks twice the size, one
 * variant of each tree instead of three, the coarse ground and no tree shadows,
 * and it is held to what the park cost before any of this existed, because that
 * is the build a phone was already running.
 */
export type Quality = "low" | "high";

export const QUALITIES: readonly Quality[] = ["low", "high"];

export function parseQuality(value: string): Quality | undefined {
  return value === "low" || value === "high" ? value : undefined;
}

/** What a model's voxel size is multiplied by. */
export function voxelScale(quality: Quality) {
  return quality === "high" ? 1 : 2;
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
