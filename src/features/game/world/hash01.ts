/**
 * A stable number in 0..1 from a key and a channel.
 *
 * The same flower has to produce the same schedule on every machine and every
 * reload, or the meadow would reshuffle itself under the player each time the
 * scene rebuilt. Same reasoning as the scatter being deterministic.
 *
 * This lives on its own because a second caller wanted it: the fact of the day
 * picks one entry out of everything you have unlocked, and it has to pick the
 * same one all day without storing which one it picked. Copying the loop would
 * have been the fourth copy in the repository and the second one carrying the
 * comment below, which is the part that actually matters.
 *
 * The other two copies stay where they are, deliberately. `seedSpot` in
 * seedlings.ts runs a HALF finalizer and then reads two values out of different
 * bit ranges of the one hash, and `seedOf` in ambient-life.tsx returns a raw
 * uint32 with no finalizer at all. Neither is this function wearing a hat. Both
 * have positions baked into saves and scenes that already exist, so replacing
 * them would silently move every seedling somebody has planted and every cohort
 * of fireflies, to make three call sites look tidier.
 */
export function hash01(key: string, channel = 0): number {
  let hash = 2166136261 ^ channel;

  for (let i = 0; i < key.length; i += 1) {
    hash ^= key.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }

  /**
   * The avalanche, and it is not optional here.
   *
   * FNV-1a on its own ends with a multiply, so two keys differing only in their
   * last character come out about 16777619 apart, which is four thousandths of
   * the range. Instance keys are exactly that shape: `...goldenrod:0`,
   * `...goldenrod:1`. Without this the flowers of a species were handed offsets
   * less than a second apart, so the whole patch filled and emptied together in
   * a wave: at one moment a third of the meadow busy, twenty seconds later not
   * one flower in the park. Determinism was never the problem, distribution was.
   *
   * This is murmur3's finalizer, which exists for precisely this.
   */
  hash ^= hash >>> 16;
  hash = Math.imul(hash, 2246822507);
  hash ^= hash >>> 13;
  hash = Math.imul(hash, 3266489909);
  hash ^= hash >>> 16;

  // >>> 0 first: the multiply leaves a signed 32-bit value, and a negative one
  // divided through would come out negative and quietly break every caller that
  // reasonably assumed a fraction.
  return (hash >>> 0) / 4294967296;
}
