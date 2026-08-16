/**
 * Somebody got there first.
 *
 * One flower visit in five comes to nothing, and until now that whole number
 * lived inside a dice roll at the end of a minigame. You played, you were told
 * "this flower was already visited", and you had no way of knowing that before
 * you spent twelve seconds on it. The fact was true and completely invisible,
 * which is the weakest way to teach anything.
 *
 * So a slice of that failure is now a thing you can see coming. A few flowers
 * in the meadow have somebody on them at any moment, they are drawn with their
 * visitor, and landing on one tells you plainly to wait or fly on. The
 * arithmetic is unchanged: what used to be a roll you lost is now a scene you
 * watched.
 *
 * The insects here are real ones that really work these parks, and they are not
 * quarry. You cannot collect them, they take nothing from you, and the flower
 * they are on comes free again in under half a minute.
 */

/**
 * How much of the one-in-five is handed over to this.
 *
 * Deliberately a slice rather than the whole thing. Making every failure visible
 * would let an attentive player drop to a failure rate the game's own writing
 * says is wrong: the pollination minigames once had ceilings everybody hit, the
 * real rate came out at one in twelve rather than one in five, and the game was
 * making a claim its mechanics did not honour. See `data/pollination.ts`, which
 * carries the other half of this number and a comment pointing back here.
 */
export const OCCUPIED_FRACTION = 0.08;

/** How long one insect works one flower before moving on. */
export const VISIT_SECONDS = 18;

/**
 * The gap between visits to the same flower, so `OCCUPIED_FRACTION` of them are
 * busy at any one moment. Roughly four minutes, which is also about right: a
 * flower in a good meadow is visited often, and not constantly.
 */
export const VISIT_CYCLE_SECONDS = VISIT_SECONDS / OCCUPIED_FRACTION;

/**
 * Who you find on it.
 *
 * Real species, all of them common in Pittsburgh's parks, and named because
 * "another insect" teaches nothing and "a common eastern bumble bee" teaches
 * one more thing than you knew. Rule 1 applies to the ambience too.
 */
export type Forager = {
  id: string;
  species: string;
  scientificName: string;
  /** What it is doing, in the second person, for the landing card. */
  doing: string;
  /** Body colour, for the mote drawn on the flower. */
  color: string;
  /** Rough body length in world units, against a bee at about 1.6. */
  size: number;
};

export const FORAGERS: Forager[] = [
  {
    id: "bumble",
    species: "Common eastern bumble bee",
    scientificName: "Bombus impatiens",
    doing: "working it over thoroughly, the way a bumble bee does",
    color: "#e8c15a",
    size: 2.1,
  },
  {
    id: "carpenter",
    species: "Eastern carpenter bee",
    scientificName: "Xylocopa virginica",
    doing: "hanging off the side of it, all shine and no fur",
    color: "#2f2a24",
    size: 2.3,
  },
  {
    id: "calligrapher",
    species: "Margined calligrapher",
    scientificName: "Toxomerus marginatus",
    doing: "holding station over it, a fly in a bee's colours",
    color: "#d9c86a",
    size: 0.8,
  },
  {
    id: "cabbage-white",
    species: "Cabbage white",
    scientificName: "Pieris rapae",
    doing: "resting on it with its wings up",
    color: "#f2f0e6",
    size: 2.6,
  },
  {
    id: "skipper",
    species: "Silver-spotted skipper",
    scientificName: "Epargyreus clarus",
    doing: "sitting on it with its tongue right down the tube",
    color: "#7a5a34",
    size: 1.9,
  },
];

/**
 * A stable number in 0..1 from a key and a channel.
 *
 * The same flower has to produce the same schedule on every machine and every
 * reload, or the meadow would reshuffle itself under the player each time the
 * scene rebuilt. Same reasoning as the scatter being deterministic.
 */
function hash01(key: string, channel: number): number {
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

export type Occupancy = {
  forager: Forager;
  /** Seconds until the flower is free. Always positive. */
  freeIn: number;
};

/**
 * Who is on this flower right now, if anybody.
 *
 * `seconds` is wall-clock seconds; the caller passes the same clock the rest of
 * the park runs on. Each flower keeps its own offset into a shared cycle, so
 * the meadow is never all busy or all free at once.
 */
export function occupancyOf(
  instanceKey: string,
  seconds: number,
): Occupancy | null {
  const offset = hash01(instanceKey, 1) * VISIT_CYCLE_SECONDS;
  const phase = (((seconds + offset) % VISIT_CYCLE_SECONDS) +
    VISIT_CYCLE_SECONDS) %
    VISIT_CYCLE_SECONDS;

  if (phase >= VISIT_SECONDS) {
    return null;
  }

  /**
   * A different visitor each time round, rather than one insect that owns this
   * flower forever. Keyed on which cycle we are in as well as the flower.
   */
  const round = Math.floor((seconds + offset) / VISIT_CYCLE_SECONDS);
  const pick = hash01(`${instanceKey}:${round}`, 2);

  return {
    forager: FORAGERS[Math.floor(pick * FORAGERS.length) % FORAGERS.length],
    freeIn: VISIT_SECONDS - phase,
  };
}

/** Whether anybody is on it. The cheap question, for the render path. */
export function isOccupied(instanceKey: string, seconds: number): boolean {
  return occupancyOf(instanceKey, seconds) !== null;
}
