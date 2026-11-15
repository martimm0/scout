/**
 * How fast a machine is drawing, from how long its frames took.
 *
 * Not the same question as how many frames arrived. A page that is not really
 * being shown (a tab behind another, a window covered by another, a pane that
 * has been put away) is still handed a frame now and then, in short bursts
 * with long gaps between, and each of those frames is as quick as ever.
 * Counting frames per second calls that a slow machine. It dropped the park to
 * Low on a fast computer whose window was simply not in front.
 *
 * So the measure is the TYPICAL frame: the middle one, by length. A slow
 * machine's frames are all long and the middle one is long. A throttled page's
 * frames are nearly all short with a few enormous gaps, and the middle one is
 * short. The gaps do not get a vote.
 */
export function typicalRate(deltas: readonly number[]): number {
  if (deltas.length === 0) {
    return Infinity;
  }

  const sorted = [...deltas].sort((a, b) => a - b);
  const middle = sorted[Math.floor(sorted.length / 2)];

  return middle > 0 ? 1 / middle : Infinity;
}

/** Fewer frames than this say nothing reliable about anything. */
export const ENOUGH_FRAMES = 8;
