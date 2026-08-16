import type { ParkId } from "./terrain";

/**
 * The waggle dance, doing something.
 *
 * A bee that finds good forage goes home and dances: a figure of eight whose
 * angle encodes the direction relative to the sun and whose duration encodes
 * the distance. Other bees read it off her body in the dark and fly out to a
 * flower they have never seen. It is the most famous fact in the whole of
 * insect biology and it won von Frisch a Nobel Prize.
 *
 * The game already had the dance as an animation, played when a flower took and
 * mirrored to everybody else in the room. It meant nothing. Now it marks the
 * patch: dance beside a flower and it goes on your record and, if you are in
 * company, onto everybody else's screen. That is what the dance is FOR.
 *
 * Marks are yours and they are small. There is no leaderboard of who found
 * what, nothing is scored, and a mark somebody else drops is a courtesy rather
 * than a claim.
 */

export type Mark = {
  /** The species danced about. */
  species: string;
  commonName: string;
  park: ParkId;
  x: number;
  z: number;
  /** When it was danced, in milliseconds. */
  at: number;
};

/**
 * How long a mark lasts, in days.
 *
 * A real dance is over in under a minute and the information in it is stale by
 * the afternoon, because the flower it points at will have been stripped. A
 * mark that never expired would silt up: a hundred pins over a park you have
 * finished, none of them worth flying to. Long enough to be useful across a few
 * sessions, short enough that the record is about where the forage is NOW.
 */
export const MARK_DAYS = 3;

const DAY_MS = 24 * 60 * 60 * 1000;

/** How many marks one player can hold at once, oldest dropped first. */
export const MAX_MARKS = 12;

export function markExpired(mark: Mark, now: number): boolean {
  return now - mark.at > MARK_DAYS * DAY_MS;
}

/**
 * Add a mark, dropping what has expired and then what is oldest.
 *
 * Pure, and returns a new list, so the store action is a one-liner and this can
 * be tested without a browser. Deliberately does NOT dedupe by species: two
 * good patches of goldenrod at opposite ends of the park are two useful marks,
 * and merging them would throw away the only thing a mark carries.
 */
export function addMark(marks: Mark[], mark: Mark, now: number): Mark[] {
  const live = marks.filter((existing) => !markExpired(existing, now));

  /**
   * Except in the same SPOT, which is one patch danced about twice.
   *
   * Without this, standing beside one flower and pressing the key four times
   * fills your whole record with four pins on top of each other, and the cap
   * then throws away the marks you actually wanted.
   */
  const elsewhere = live.filter(
    (existing) =>
      existing.park !== mark.park ||
      Math.hypot(existing.x - mark.x, existing.z - mark.z) > 25,
  );

  return [mark, ...elsewhere].slice(0, MAX_MARKS);
}

/** The live marks for a park, newest first. */
export function marksIn(marks: Mark[], park: ParkId, now: number): Mark[] {
  return marks.filter(
    (mark) => mark.park === park && !markExpired(mark, now),
  );
}

/**
 * How a mark reads on the page: "Goldenrod, about 40 units north-east".
 *
 * The compass points rather than raw coordinates, because "x 182, z -61" is not
 * a thing anybody can fly toward. North is negative Z, which is the convention
 * the rest of the world code already uses.
 */
export function bearingFrom(
  mark: Mark,
  fromX: number,
  fromZ: number,
): { distance: number; compass: string } {
  const dx = mark.x - fromX;
  const dz = mark.z - fromZ;
  const distance = Math.hypot(dx, dz);

  // atan2(east, north): 0 is due north, and it runs clockwise through east.
  const degrees = (Math.atan2(dx, -dz) * 180) / Math.PI;
  const points = [
    "north",
    "north-east",
    "east",
    "south-east",
    "south",
    "south-west",
    "west",
    "north-west",
  ];
  const index = Math.round(((degrees + 360) % 360) / 45) % 8;

  return { distance, compass: points[index] };
}
