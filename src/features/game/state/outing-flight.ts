"use client";

import { COURSES, raceGates } from "@party/games/courses";
import {
  JOIN_RADIUS,
  STALE_POSE_MS,
  awayFromStart,
  gateCrossed,
  warmthBand,
  whereInArea,
} from "@party/games/outings";
import { parkOf, type Gate } from "@party/protocol";

import { buzz } from "../audio/haptics";
import { playSound } from "../audio/sound";
import {
  NO_SENSE,
  outingOf,
  partyPoses,
  usePartyStore,
  type OutingSense,
} from "./party-store";

/**
 * What a round looks like from where you are.
 *
 * Called on the pose tick, straight after the pose is sent, with the pose that
 * was sent. That is deliberate. The room judges a gate by the line between two
 * poses it received; this judges the same gate by the same two poses, with the
 * same function, so it can chime the moment you pass and never be told
 * afterwards that you did not.
 *
 * It decides nothing. Whether you passed a gate, finished, or were found is the
 * room's to say, and the card shows what the room said. This is the fifth of a
 * second before the room has said it, and the things the room never says at
 * all: which way the next gate is, and how warm you are.
 */

type Spot = { x: number; z: number; altitude: number };

let last: Spot | null = null;
let lastAt = 0;
let lastId: string | null = null;
/** When this client last counted a gate the room has not yet confirmed. */
let aheadSince = 0;

function cueTo(target: { x: number; z: number }, here: Spot, heading: number) {
  const dx = target.x - here.x;
  const dz = target.z - here.z;
  // Forward is (sin, -cos) of the heading; right is (cos, sin).
  const ahead = dx * Math.sin(heading) - dz * Math.cos(heading);
  const across = dx * Math.cos(heading) + dz * Math.sin(heading);
  const angle = Math.atan2(across, ahead);
  const wide = Math.abs(angle);

  return {
    way:
      wide < 0.6
        ? ("ahead" as const)
        : wide > 2.5
          ? ("behind" as const)
          : angle > 0
            ? ("right" as const)
            : ("left" as const),
    // To the nearest ten, so the card is redrawn a few times a second while
    // you close on a gate and not on every tick.
    distance: Math.round(Math.hypot(dx, dz) / 10) * 10,
  };
}

function same(a: OutingSense, b: OutingSense) {
  return (
    a.gates === b.gates &&
    a.warmth === b.warmth &&
    a.inArea === b.inArea &&
    a.high === b.high &&
    a.away.join() === b.away.join() &&
    a.cue?.way === b.cue?.way &&
    a.cue?.distance === b.cue?.distance &&
    a.atStart.join() === b.atStart.join()
  );
}

export function outingTick(
  x: number,
  z: number,
  altitude: number,
  heading: number,
) {
  const state = usePartyStore.getState();

  if (state.status !== "in" || !state.party || state.outings.length === 0) {
    last = null;
    lastId = null;

    if (state.sense !== NO_SENSE) {
      state.setSense(NO_SENSE);
    }

    return;
  }

  const now = performance.now();
  const here = { x, z, altitude };
  const park = parkOf(state.party);
  const you = state.you?.sub;
  const mine = outingOf(state.outings, you);
  // The pose before this one, unless it is from before a sleeping tab. The
  // room does not join those two into a line, so neither does this.
  const from = last && now - lastAt <= STALE_POSE_MS ? last : null;

  const sense: OutingSense = {
    atStart: state.outings
      .filter(
        (outing) =>
          outing.phase === "gathering" &&
          outing.race &&
          Math.hypot(x - outing.race.start.x, z - outing.race.start.z) <=
            JOIN_RADIUS,
      )
      .map((outing) => outing.id),
    gates: 0,
    cue: null,
    warmth: null,
    inArea: null,
    high: false,
    away: [],
  };

  if (mine?.race && you) {
    const entry = mine.race.progress[you];
    const lap = raceGates(park, mine.race);

    if (mine.phase === "gathering") {
      // Asked the way the room will ask it when the host presses Start, of
      // the poses the room has: yours is the one just sent.
      sense.away = awayFromStart(mine.members, mine.race.start, (sub) =>
        sub === you
          ? { ...here, heading, gesture: "none" }
          : (partyPoses.get(sub) ?? null),
      );

      if (sense.away.includes(you)) {
        sense.cue = cueTo(mine.race.start, here, heading);
      }
    }

    if (entry && lap.length > 0) {
      const total = lap.length * mine.race.laps;
      let passed =
        mine.id === lastId ? Math.max(state.sense.gates, entry.gates) : entry.gates;

      // Ahead of the room for two whole seconds is not being early, it is
      // being wrong: a pose that never arrived. The room's count is the count.
      if (passed > entry.gates && now - aheadSince > 2000) {
        passed = entry.gates;
      }

      if (
        mine.phase === "running" &&
        entry.finishedIn === null &&
        passed < total &&
        gateCrossed(from, here, lap[passed % lap.length]) !== null
      ) {
        passed += 1;
        aheadSince = now;
        playSound(passed >= total ? "streak" : "match");
        buzz(passed >= total ? "success" : "match");
      }

      sense.gates = passed;

      if (mine.phase !== "done" && passed < total) {
        const next: Gate = lap[passed % lap.length];

        sense.cue = cueTo(next, here, heading);
      }
    }
  }

  if (mine?.hide && you && mine.hide.area >= 0) {
    const area = COURSES[park].hide[mine.hide.area];

    if (mine.hide.hiders.includes(you)) {
      const placed = whereInArea(here, area);

      sense.inArea = placed === "inside";
      sense.high = placed === "above";

      // Only while there is still time to get there, and only when there is
      // somewhere to point: over the middle of it, the way in is down.
      if (mine.phase === "hiding" && placed === "outside") {
        sense.cue = cueTo(area, here, heading);
      }
    } else if (mine.phase === "seeking" && mine.hide.seekers.includes(you)) {
      let nearest = Infinity;

      for (const hider of mine.hide.hiders) {
        const there = partyPoses.get(hider);

        if (there) {
          nearest = Math.min(
            nearest,
            Math.hypot(
              there.x - x,
              there.altitude - altitude,
              there.z - z,
            ),
          );
        }
      }

      sense.warmth = Number.isFinite(nearest) ? warmthBand(nearest) : "cold";
    }
  }

  last = here;
  lastAt = now;
  lastId = mine?.id ?? null;

  if (!same(state.sense, sense)) {
    state.setSense(sense);
  }
}
