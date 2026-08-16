import { PLANTS_BY_ID } from "../data/plants";
import { seasonWindow } from "./season";
import { PLANT_SCALE, type SpeciesInstance } from "./species-scatter";
import { activePark, terrainHeight, waterLevel, type ParkId } from "./terrain";

/**
 * What your work leaves behind.
 *
 * A flower that takes sets seed, and the seed becomes a plant. Until this, the
 * park was exactly the same after an afternoon's pollinating as it was before:
 * you did the job, the journal filled up, and the meadow was untouched. That
 * makes a collection game, and collection games end. A park that carries the
 * marks of what you did there is somewhere you go back to.
 *
 * **On the honesty of the timescale.** A seed set in August germinates the
 * following spring and may not flower for a year after that. Nothing here is
 * pretending otherwise, and `MATURE_DAYS` is not a claim about milkweed. It is
 * the one place the game knowingly compresses the calendar, because the
 * alternative is a feature whose payoff arrives eight months after the action,
 * and rule 1 is about not inventing facts rather than about refusing to be a
 * game. The journal entry says as much in plain words.
 */

/** A seed set at a spot, in the player's own save. */
export type Seedling = {
  /** The species that set it. Always a plant; nothing else sets seed. */
  plant: string;
  park: ParkId;
  x: number;
  z: number;
  /** When it was set, in milliseconds. */
  at: number;
};

/**
 * How long from seed to full size.
 *
 * Days rather than minutes, so coming back tomorrow is the point of it, and not
 * so long that somebody who plays twice a week never sees one finish.
 */
export const MATURE_DAYS = 8;

/** How big it is the moment it appears, as a fraction of the adult. */
export const SPROUT_SCALE = 0.18;

/**
 * How many seedlings one player can hold at once.
 *
 * There has to be a number, because the obvious reading of "a seedling is a
 * plant" makes this unbounded. A seedling IS an ordinary instance, so it can be
 * landed on and worked like anything else, and working it keys a new record off
 * its key: `seed-plant-goldenrod-3` sets `seed-seed-plant-goldenrod-3`, and
 * that one sets another. Each generation needs eight days of growing, so it is
 * slow, and slow is not bounded: a park has around eighty-five flowers in it,
 * and a year of playing would leave a few thousand records in a save that is
 * posted to Postgres whenever it changes, plus a few thousand extra meshes in
 * the world.
 *
 * Refusing to let a seedling set seed of its own would be the tidier fix and it
 * would be a lie: a plant grown from seed sets seed, and that is exactly how a
 * meadow works. So the cap is on the record instead, and the oldest goes first.
 * That does mean somebody who has sown two hundred loses their very first
 * seedling, which is a real cost and the least bad one available: the
 * alternative is refusing to sow anything new, which breaks the loop rather
 * than bounding it.
 */
export const MAX_SEEDLINGS = 120;

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * How grown a seedling is, from 0 at the moment it is set to 1 when mature.
 *
 * Never returns 0: a seed you just set is a visible sprout, so the thing you
 * did has a result you can look at rather than an eight-day wait before any
 * evidence at all. Clamped at both ends, and safe for a clock that has gone
 * backwards, which happens whenever a save is carried between machines in
 * different time zones.
 */
export function growth(seededAt: number, now: number): number {
  const days = Math.max(0, (now - seededAt) / DAY_MS);

  return Math.min(1, SPROUT_SCALE + (1 - SPROUT_SCALE) * (days / MATURE_DAYS));
}

/** Whether it has grown enough to be worth working. */
export function isMature(seededAt: number, now: number): boolean {
  return growth(seededAt, now) >= 1;
}

/**
 * Where the seed lands, relative to the flower that set it.
 *
 * Close by, because most seeds are. Deterministic from the parent's key so the
 * plant does not wander between visits, which is the same rule the whole scatter
 * follows: a player is supposed to be able to learn where things are.
 */
export function seedSpot(
  parentKey: string,
  x: number,
  z: number,
): { x: number; z: number } {
  let hash = 2166136261;

  for (let i = 0; i < parentKey.length; i += 1) {
    hash = Math.imul(hash ^ parentKey.charCodeAt(i), 16777619);
  }

  hash ^= hash >>> 16;
  hash = Math.imul(hash, 2246822507);
  hash ^= hash >>> 13;

  const angle = ((hash >>> 0) / 4294967296) * Math.PI * 2;
  const distance = 7 + (((hash >>> 8) & 255) / 255) * 8;

  return { x: x + Math.cos(angle) * distance, z: z + Math.sin(angle) * distance };
}

/**
 * Record a seed, dropping the oldest once the cap is reached.
 *
 * Keyed by the flower that set it, so working the same stalk every afternoon
 * replaces its seedling rather than stacking a thicket on one spot. Pure, so
 * the store action stays a one-liner and this can be tested without a browser.
 */
export function addSeedling(
  seedlings: Record<string, Seedling>,
  key: string,
  seedling: Seedling,
): Record<string, Seedling> {
  // Oldest first, and never the one just sown: a seed you have this second
  // watched take must not be the one that falls off the end.
  return capSeedlings({ ...seedlings, [key]: seedling }, key);
}

/**
 * Two saves of seedlings, folded into one.
 *
 * Lives here rather than in `cloud-sync` so that the cap and the tie-break are
 * stated once. The first version of this was written inline in the merge and
 * did neither: it spread local over remote and returned whatever came out, so
 * two devices sitting at the cap merged to twice the cap and the limit was
 * defeated by the act of syncing.
 *
 * The EARLIER timestamp wins a collision, which is the same rule the rest of
 * the save follows in spirit: progress only goes up, and a seedling is measured
 * by how long it has been growing. Taking the later one would shrink a
 * week-old plant back to a sprout because the phone had a fresher copy.
 */
export function mergeSeedlings(
  local: Record<string, Seedling>,
  remote: Record<string, Seedling> | undefined,
): Record<string, Seedling> {
  const merged = { ...local };

  for (const [key, value] of Object.entries(remote ?? {})) {
    const mine = merged[key];

    merged[key] = mine && mine.at <= value.at ? mine : value;
  }

  return capSeedlings(merged);
}

/** Trim to the cap, oldest first. */
function capSeedlings(
  seedlings: Record<string, Seedling>,
  keep?: string,
): Record<string, Seedling> {
  const keys = Object.keys(seedlings);

  if (keys.length <= MAX_SEEDLINGS) {
    return seedlings;
  }

  const next = { ...seedlings };
  const doomed = keys
    .filter((id) => id !== keep)
    .sort((a, b) => next[a].at - next[b].at)
    .slice(0, keys.length - MAX_SEEDLINGS);

  for (const id of doomed) {
    delete next[id];
  }

  return next;
}

/**
 * The seedlings of the active park, as things the world can draw.
 *
 * Built to the same `SpeciesInstance` shape as everything else on purpose. A
 * seedling that had its own type would need its own branch in the field, the
 * discovery sweep, the landing code and the tag, and four branches is four
 * places to forget. It is a plant of a species that already exists; the only
 * thing different about it is where it came from and how big it is yet.
 *
 * Keys are namespaced `seed-`, which is what keeps them out of anything that
 * counts: park unlocks and badges are counted from the SPECIES data, never from
 * instances, and a seedling is never a species you had not already met, since
 * you had to pollinate one to get it.
 */
export function seedlingInstances(
  seedlings: Record<string, Seedling>,
  park: ParkId,
  now: number,
): SpeciesInstance[] {
  const out: SpeciesInstance[] = [];

  /**
   * Only ever the park that is actually built.
   *
   * `terrainHeight` is a facade over the ACTIVE park, not a function of the park
   * you name, so asking for Schenley's seedlings while Frick is loaded would
   * have planted them at Frick's ground heights: every one of them buried in a
   * hillside or hanging in the air above the hollow, with nothing anywhere
   * reporting a problem. The caller passes `currentPark`, which is the active
   * park by construction, and this refuses rather than guesses if that ever
   * stops being true.
   */
  if (park !== activePark().id) {
    return out;
  }

  for (const [key, seedling] of Object.entries(seedlings)) {
    if (seedling.park !== park) {
      continue;
    }

    const plant = PLANTS_BY_ID.get(seedling.plant);

    if (!plant) {
      // A species that has been removed from the data since. Skipping rather
      // than crashing: a save is allowed to be older than the code.
      continue;
    }

    const ground = terrainHeight(seedling.x, seedling.z);

    // Never in the water. The scatter refuses to plant below the waterline and
    // a seed that blew into the creek did not grow into anything.
    if (ground < waterLevel() + 6) {
      continue;
    }

    const grown = growth(seedling.at, now);

    out.push({
      key: `seed-${key}`,
      species: { kind: "plant", plant },
      id: plant.id,
      commonName: plant.commonName,
      hook: plant.hook,
      window: plant.window,
      season: seasonWindow(plant.bloom),
      height: plant.height,
      position: [seedling.x, ground - 0.6, seedling.z],
      rotation: ((seedling.at % 360) * Math.PI) / 180,
      scale: PLANT_SCALE * grown,
      flushAt: 0,
    });
  }

  return out;
}
