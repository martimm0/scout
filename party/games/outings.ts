import {
  PARTY_CAP,
  type CourseId,
  type Gate,
  type OutingView,
  type Pose,
  type RaceView,
} from "../protocol";
import { COURSES, raceGates, type HideArea, type ParkId } from "./courses";

/**
 * Rounds played out in the park: races, and hide and seek.
 *
 * Pure transitions over one round, like the tables, and for the same reason:
 * the room calls these and so can a test, with no socket and no clock. Every
 * one of them returns the SAME object when it refuses or has nothing to do,
 * which is how the room knows whether there is anything to tell anybody.
 *
 * What is different from a table is where the moves come from. Nobody sends
 * "I passed the gate" or "I found her". The room already relays where every
 * bee is, six times a second, and it referees from that: `outingPose` is
 * handed each new pose and works out what it meant. So every player in a round
 * is judged from the same stream by the same code, and no one player's screen
 * is the one that decides.
 *
 * The poses themselves are still only claims. The room does not check that a
 * bee could have flown where it says it is, and that is acceptable for exactly
 * as long as a round is worth nothing: no time is saved, nobody is ranked, and
 * the result is gone a minute after the round ends.
 */

/** Racers are held at the start for this long, so "go" is the same for all. */
export const COUNTDOWN_MS = 5_000;
/** How long the seeker counts. Every hider saying they are hidden ends it. */
export const HIDING_MS = 30_000;
export const SEEKING_MS = 240_000;
/** A race nobody finishes is called after this. */
export const RACE_CAP_MS = 300_000;

/**
 * How near the start counts as at it.
 *
 * Wider than the start gate, because in Schenley the gate is thirty units from
 * where a bee arrives and somebody who has only just come in should not have to
 * move to be let into the first race.
 */
export const JOIN_RADIUS = 35;
/** A seeker's path passing this close finds a hider. */
export const FIND_RADIUS = 6;
/**
 * A bee who has just been found cannot find anybody for this long. Two hiders
 * behind one tree were otherwise found as one: the first became a seeker while
 * already touching the second.
 */
export const TAG_GRACE_MS = 3_000;
/**
 * A hider's spot is taken this long after the seeking starts, and not at the
 * moment it does: the last pose the room holds then is a sixth of a second
 * old, and the bee it describes had not yet been told to stop.
 */
export const SETTLE_MS = 1_500;
/**
 * How far a hider may be from their spot before they have given themselves
 * away. Twenty and not three, because a pose is where the bee is DRAWN, and a
 * hider who lands on a flower is drawn easing onto a perch up to a dozen units
 * from where they were hovering. The client is what holds a hider still; this
 * is only there to catch one that does not.
 */
export const STAY_WITHIN = 20;
/**
 * A previous pose older than this is not joined to the next one. It is from
 * before a sleeping tab or a reconnect, and the line between the two is not a
 * path anybody flew.
 */
export const STALE_POSE_MS = 1_000;
/** A dash is sent at least this far, so it is a flight and not a hop. */
export const DASH_MIN = 200;
/**
 * A round that has been gathering this long with nobody starting it is
 * cleared away. Its host has wandered off, and a start column nobody will
 * ever race from is a light left on over the park for the whole afternoon.
 */
export const GATHER_MS = 10 * 60_000;
/** Finishes closer together than the room can tell apart are called level. */
export const LEVEL_MS = 150;

type Spot = { x: number; z: number; altitude: number };

/**
 * A round as the room holds it: the view, and what the view must not carry.
 *
 * `anchors` is where each hider settled. It is the one thing in here that
 * would end the game if it leaked, so it lives beside the view and never in it.
 */
export type Outing = OutingView & {
  park: ParkId;
  anchors: Record<string, Spot>;
  /** When each converted seeker may start finding people. */
  tagFrom: Record<string, number>;
};

/** The latest pose the room holds for anybody, or null if they have sent none. */
export type PoseOf = (sub: string) => Pose | null;

/* ------------------------------------------------------------------ *
 * Geometry
 * ------------------------------------------------------------------ */

/**
 * Whether flying from one pose to the next passed through a gate, and how far
 * along the way it happened (0 at the first pose, 1 at the second).
 *
 * The line and not the points, because a bee at full boost covers nearly ten
 * units between two poses and could step clean over the middle of a gate. With
 * the line, how often poses arrive stops mattering to whether a gate counts.
 *
 * Exported and shared with the client, which runs it on the very poses it
 * sends. The chime for a gate is then instant, and agrees with the room
 * whenever the two poses reach the room as they left: both were looking at the
 * same two points. When one is lost or late the room is right, and the client
 * falls back to the room's count.
 */
export function gateCrossed(
  prev: Spot | null,
  pose: Spot,
  gate: Gate,
): number | null {
  const under = (altitude: number) =>
    gate.top === undefined || altitude <= gate.top;

  if (!prev) {
    return Math.hypot(pose.x - gate.x, pose.z - gate.z) <= gate.radius &&
      under(pose.altitude)
      ? 1
      : null;
  }

  const dx = pose.x - prev.x;
  const dz = pose.z - prev.z;
  const fx = prev.x - gate.x;
  const fz = prev.z - gate.z;
  const a = dx * dx + dz * dz;
  const c = fx * fx + fz * fz - gate.radius * gate.radius;

  let enter = 0;
  let leave = 1;

  if (a < 1e-9) {
    // Hovering. Inside or not, and nowhere along a line that has no length.
    if (c > 0) {
      return null;
    }
  } else {
    const b = 2 * (fx * dx + fz * dz);
    const disc = b * b - 4 * a * c;

    if (disc < 0) {
      return null;
    }

    const root = Math.sqrt(disc);
    const first = (-b - root) / (2 * a);
    const last = (-b + root) / (2 * a);

    if (last < 0 || first > 1) {
      return null;
    }

    enter = Math.max(0, first);
    leave = Math.min(1, last);
  }

  const altitudeAt = (t: number) =>
    prev.altitude + (pose.altitude - prev.altitude) * t;

  if (under(altitudeAt(enter))) {
    return enter;
  }

  // Came in over the deck and dropped under it while still inside the gate.
  if (gate.top !== undefined && under(altitudeAt(leave))) {
    const t = (gate.top - prev.altitude) / (pose.altitude - prev.altitude);

    return Math.min(leave, Math.max(enter, t));
  }

  return null;
}

/** Whether the line between two poses passed within `radius` of a point. */
function passedWithin(
  prev: Spot | null,
  pose: Spot,
  point: Spot,
  radius: number,
): boolean {
  let t = 1;

  if (prev) {
    const dx = pose.x - prev.x;
    const dy = pose.altitude - prev.altitude;
    const dz = pose.z - prev.z;
    const length = dx * dx + dy * dy + dz * dz;

    t =
      length < 1e-9
        ? 1
        : Math.min(
            1,
            Math.max(
              0,
              ((point.x - prev.x) * dx +
                (point.altitude - prev.altitude) * dy +
                (point.z - prev.z) * dz) /
                length,
            ),
          );
  }

  const from = prev ?? pose;

  return (
    Math.hypot(
      from.x + (pose.x - from.x) * t - point.x,
      from.altitude + (pose.altitude - from.altitude) * t - point.altitude,
      from.z + (pose.z - from.z) * t - point.z,
    ) <= radius
  );
}

function apart(a: Spot, b: Spot): number {
  return Math.hypot(a.x - b.x, a.altitude - b.altitude, a.z - b.z);
}

function atStart(at: Pose | null, start: Gate): boolean {
  return at !== null && Math.hypot(at.x - start.x, at.z - start.z) <= JOIN_RADIUS;
}

export function insideArea(at: Spot, area: HideArea): boolean {
  return (
    Math.hypot(at.x - area.x, at.z - area.z) <= area.radius &&
    at.altitude <= area.top
  );
}

/**
 * How near the nearest hider is, as a word.
 *
 * A word and not a number or an arrow: a seeker who is told "warm" still has
 * to look, and one who is told "38 units north-east" does not.
 */
export type Warmth = "cold" | "cool" | "warm" | "hot";

export function warmthBand(distance: number): Warmth {
  if (distance <= 25) {
    return "hot";
  }

  if (distance <= 60) {
    return "warm";
  }

  return distance <= 130 ? "cool" : "cold";
}

/* ------------------------------------------------------------------ *
 * Opening and joining
 * ------------------------------------------------------------------ */

/**
 * Open a race. Null when it cannot be opened at all.
 *
 * Opening does not need you to be at the start: opening is what lights the
 * start, for you as much as for anybody else. Joining and beginning do.
 *
 * A dash is the exception, because its start is wherever the host was when
 * they asked for one, and a host the room has not heard from is nowhere.
 */
export function openRace(
  id: string,
  park: ParkId,
  course: CourseId,
  who: string,
  name: string,
  at: Pose | null,
  now: number,
): Outing | null {
  let race: RaceView;

  if (course === "dash") {
    if (!at) {
      return null;
    }

    race = {
      course,
      laps: 1,
      start: { name: "The start", x: at.x, z: at.z, radius: 18 },
      startedAt: 0,
      progress: {},
    };
  } else {
    const authored = COURSES[park][course];

    race = {
      course,
      laps: authored.laps,
      start: authored.start,
      startedAt: 0,
      progress: {},
    };
  }

  return {
    id,
    kind: "race",
    phase: "gathering",
    members: [{ sub: who, name }],
    since: now,
    deadline: 0,
    done: [],
    race,
    park,
    anchors: {},
    tagFrom: {},
  };
}

export function openHide(
  id: string,
  park: ParkId,
  who: string,
  name: string,
  wantsSeek: boolean,
  now: number,
): Outing {
  return {
    id,
    kind: "hide",
    phase: "gathering",
    members: [{ sub: who, name }],
    since: now,
    deadline: 0,
    done: [],
    hide: {
      hostSeeks: wantsSeek,
      area: -1,
      seekers: [],
      hiders: [],
      ready: [],
      found: [],
    },
    park,
    anchors: {},
    tagFrom: {},
  };
}

/** Whether somebody is in a round that is still going. */
export function inOuting(outing: OutingView, who: string): boolean {
  return (
    outing.phase !== "done" &&
    outing.members.some((member) => member.sub === who)
  );
}

export function joinOuting(
  outing: Outing,
  who: string,
  name: string,
  at: Pose | null,
  now: number = outing.since,
): Outing {
  if (
    outing.phase !== "gathering" ||
    outing.members.length >= PARTY_CAP ||
    outing.members.some((member) => member.sub === who)
  ) {
    return outing;
  }

  // A race is joined at the start, so that when it begins everybody is held
  // in the same place. Hide and seek is joined from anywhere.
  if (outing.race && !atStart(at, outing.race.start)) {
    return outing;
  }

  return {
    ...outing,
    members: [...outing.members, { sub: who, name }],
    // Somebody arriving is the round being alive. See `GATHER_MS`.
    since: Math.max(outing.since, now),
  };
}

/* ------------------------------------------------------------------ *
 * Beginning
 * ------------------------------------------------------------------ */

/**
 * The host starts the round.
 *
 * `pick` is injected, as the Field Notes dealer's is, so a test can say who
 * seeks and where a dash goes.
 */
export function beginOuting(
  outing: Outing,
  who: string,
  now: number,
  poseOf: PoseOf,
  pick: () => number = Math.random,
): Outing {
  if (outing.phase !== "gathering" || outing.members[0]?.sub !== who) {
    return outing;
  }

  if (outing.race) {
    const race = outing.race;

    if (!atStart(poseOf(who), race.start)) {
      return outing;
    }

    // Anybody who joined and then wandered off is left behind, and not held
    // in mid-air somewhere across the park for a race they cannot be in.
    const members = outing.members.filter((member) =>
      atStart(poseOf(member.sub), race.start),
    );

    let target: Gate | undefined;

    if (race.course === "dash") {
      const all = COURSES[outing.park].dash;
      const far = all.filter(
        (gate) =>
          Math.hypot(gate.x - race.start.x, gate.z - race.start.z) >= DASH_MIN,
      );
      const from = far.length > 0 ? far : all;

      target = from[Math.min(from.length - 1, Math.floor(pick() * from.length))];
    }

    return {
      ...outing,
      phase: "countdown",
      members,
      since: now,
      deadline: now + COUNTDOWN_MS,
      race: {
        ...race,
        ...(target ? { target } : {}),
        progress: Object.fromEntries(
          members.map((member) => [
            member.sub,
            { gates: 0, finishedIn: null },
          ]),
        ),
      },
    };
  }

  if (!outing.hide || outing.members.length < 2) {
    return outing;
  }

  const areas = COURSES[outing.park].hide;
  const subs = outing.members.map((member) => member.sub);
  const seeker = outing.hide.hostSeeks
    ? who
    : subs[Math.min(subs.length - 1, Math.floor(pick() * subs.length))];

  return {
    ...outing,
    phase: "hiding",
    since: now,
    deadline: now + HIDING_MS,
    hide: {
      hostSeeks: outing.hide.hostSeeks,
      area: Math.min(areas.length - 1, Math.floor(pick() * areas.length)),
      seekers: [seeker],
      hiders: subs.filter((sub) => sub !== seeker),
      ready: [],
      found: [],
    },
  };
}

/* ------------------------------------------------------------------ *
 * Hide and seek
 * ------------------------------------------------------------------ */

function nameOf(outing: Outing, sub: string): string {
  return outing.members.find((member) => member.sub === sub)?.name ?? "A bee";
}

/** One hider is found, or has given themselves away, and joins the seekers. */
function found(
  outing: Outing,
  sub: string,
  by: string | null,
  why: "found" | "moved" | "outside",
  now: number,
): Outing {
  const hide = outing.hide;

  if (!hide || !hide.hiders.includes(sub)) {
    return outing;
  }

  const hiders = hide.hiders.filter((hider) => hider !== sub);
  const next: Outing = {
    ...outing,
    hide: {
      ...hide,
      hiders,
      seekers: [...hide.seekers, sub],
      found: [
        ...hide.found,
        {
          sub,
          name: nameOf(outing, sub),
          by,
          at: Math.max(0, now - outing.since),
          why,
        },
      ],
    },
    tagFrom: { ...outing.tagFrom, [sub]: now + TAG_GRACE_MS },
  };

  return hiders.length === 0
    ? { ...next, phase: "done", since: now, deadline: 0 }
    : next;
}

/** The count is over. Anybody not in the hiding place is caught at once. */
function startSeeking(outing: Outing, now: number, poseOf: PoseOf): Outing {
  const hide = outing.hide;

  if (!hide) {
    return outing;
  }

  const area = COURSES[outing.park].hide[hide.area];
  let next: Outing = {
    ...outing,
    phase: "seeking",
    since: now,
    deadline: now + SEEKING_MS,
  };

  for (const hider of hide.hiders) {
    const at = poseOf(hider);

    // No pose at all is somebody the room has never seen, who therefore cannot
    // be found by flying to them. Caught, rather than unfindable for four
    // minutes.
    if (!at || !insideArea(at, area)) {
      next = found(next, hider, null, "outside", now);
    }
  }

  return next;
}

export function readyOuting(
  outing: Outing,
  who: string,
  now: number,
  poseOf: PoseOf,
): Outing {
  const hide = outing.hide;

  if (
    outing.phase !== "hiding" ||
    !hide ||
    !hide.hiders.includes(who) ||
    hide.ready.includes(who)
  ) {
    return outing;
  }

  const ready = [...hide.ready, who];
  const next = { ...outing, hide: { ...hide, ready } };

  return hide.hiders.every((hider) => ready.includes(hider))
    ? startSeeking(next, now, poseOf)
    : next;
}

/* ------------------------------------------------------------------ *
 * A pose arrives
 * ------------------------------------------------------------------ */

/**
 * Somebody in the round has moved.
 *
 * `prev` is their pose before this one and `prevAt` when the room received it.
 * The two together are the line they flew, which is what is judged.
 */
export function outingPose(
  outing: Outing,
  who: string,
  prev: Pose | null,
  prevAt: number,
  pose: Pose,
  now: number,
  poseOf: PoseOf,
): Outing {
  const from = prev && now - prevAt <= STALE_POSE_MS ? prev : null;

  if (outing.phase === "running" && outing.race) {
    const race = outing.race;
    const mine = race.progress[who];
    const gates = raceGates(outing.park, race);
    const total = gates.length * race.laps;

    if (!mine || mine.finishedIn !== null || total === 0) {
      return outing;
    }

    // The NEXT gate only, however many the line crossed. A course is flown in
    // order, and a bee that cuts a corner through two gates at once has passed
    // the first of them.
    const along = gateCrossed(from, pose, gates[mine.gates % gates.length]);

    // Not finite is a pose so far away that the arithmetic gave up: 1e200 is
    // a finite number and its square is not. It passes no gate, and it must
    // not be written into a result as a finishing time of NaN.
    if (along === null || !Number.isFinite(along)) {
      return outing;
    }

    const passed = mine.gates + 1;
    // Where along the line the gate was, turned into when. Two racers a tenth
    // of a second apart would otherwise be ordered by whose pose happened to
    // arrive first.
    const crossedAt = from ? prevAt + (now - prevAt) * along : now;
    const progress = {
      ...race.progress,
      [who]: {
        gates: passed,
        finishedIn:
          passed >= total
            ? Math.max(0, Math.round(crossedAt - race.startedAt))
            : null,
      },
    };
    const next = { ...outing, race: { ...race, progress } };

    return Object.values(progress).every((entry) => entry.finishedIn !== null)
      ? { ...next, phase: "done", since: now, deadline: 0 }
      : next;
  }

  if (outing.phase === "seeking" && outing.hide) {
    const hide = outing.hide;

    if (hide.hiders.includes(who)) {
      const anchor = outing.anchors[who];

      if (!anchor) {
        return now - outing.since >= SETTLE_MS
          ? {
              ...outing,
              anchors: {
                ...outing.anchors,
                [who]: { x: pose.x, z: pose.z, altitude: pose.altitude },
              },
            }
          : outing;
      }

      return apart(anchor, pose) > STAY_WITHIN
        ? found(outing, who, null, "moved", now)
        : outing;
    }

    if (!hide.seekers.includes(who) || now < (outing.tagFrom[who] ?? 0)) {
      return outing;
    }

    let next = outing;

    for (const hider of hide.hiders) {
      const there = poseOf(hider);

      if (there && passedWithin(from, pose, there, FIND_RADIUS)) {
        next = found(next, hider, who, "found", now);
      }
    }

    return next;
  }

  return outing;
}

/* ------------------------------------------------------------------ *
 * The clock
 * ------------------------------------------------------------------ */

/**
 * A phase ran out.
 *
 * Called from the pose stream and not from an alarm. A room with anybody in it
 * hears about six poses a second from each of them, which makes the stream a
 * better clock than the one alarm a Durable Object gets: that alarm belongs to the tables,
 * is replaced every time one of them changes, and would be moved off a
 * five-second countdown by the first Field Notes round to be dealt.
 */
export function outingTick(outing: Outing, now: number, poseOf: PoseOf): Outing {
  if (outing.deadline === 0 || now < outing.deadline) {
    return outing;
  }

  switch (outing.phase) {
    case "countdown":
      return outing.race
        ? {
            ...outing,
            phase: "running",
            since: now,
            deadline: now + RACE_CAP_MS,
            // From `now`, and not from the deadline that has just passed: the
            // clock starts when the room says go, which is when the racers are
            // let go, and not a tick earlier.
            race: { ...outing.race, startedAt: now },
          }
        : outing;

    case "hiding":
      return startSeeking(outing, now, poseOf);

    case "running":
    case "seeking":
      return { ...outing, phase: "done", since: now, deadline: 0, ended: "time" };

    default:
      return outing;
  }
}

/* ------------------------------------------------------------------ *
 * Leaving
 * ------------------------------------------------------------------ */

/**
 * Somebody left the room, or pressed Leave.
 *
 * A finished round keeps its members so the result still reads, and notes who
 * has pressed Done beside them, as a finished table does.
 */
export function leaveOuting(outing: Outing, who: string, now: number): Outing {
  if (!outing.members.some((member) => member.sub === who)) {
    return outing;
  }

  if (outing.phase === "done") {
    const done = [...new Set([...outing.done, who])];

    return outing.members.every((member) => done.includes(member.sub))
      ? { ...outing, members: [], done: [] }
      : { ...outing, done };
  }

  const members = outing.members.filter((member) => member.sub !== who);
  const next: Outing = { ...outing, members };

  if (members.length === 0 || outing.phase === "gathering") {
    return next;
  }

  if (outing.race) {
    const progress = { ...outing.race.progress };

    delete progress[who];

    const racing = { ...next, race: { ...outing.race, progress } };

    return outing.phase === "running" &&
      Object.values(progress).every((entry) => entry.finishedIn !== null)
      ? { ...racing, phase: "done", since: now, deadline: 0 }
      : racing;
  }

  if (outing.hide) {
    const hide = {
      ...outing.hide,
      seekers: outing.hide.seekers.filter((sub) => sub !== who),
      hiders: outing.hide.hiders.filter((sub) => sub !== who),
      ready: outing.hide.ready.filter((sub) => sub !== who),
    };

    // Nobody left to look, or nobody left to look for. It says somebody left
    // and does not call anybody the last one found.
    if (hide.seekers.length === 0 || hide.hiders.length === 0) {
      return { ...next, hide, phase: "done", since: now, deadline: 0, ended: "left" };
    }

    // The one hider everybody was waiting on has gone, and the rest have all
    // said they are hidden: the count is over. Done by bringing its deadline
    // to now, so it ends on the next pose with everybody's real position, and
    // not here, where there are none to judge "outside" by.
    return outing.phase === "hiding" &&
      hide.hiders.every((hider) => hide.ready.includes(hider))
      ? { ...next, hide, deadline: now }
      : { ...next, hide };
  }

  return next;
}

/** Rounds nobody is in, or that finished a while ago, stop being listed. */
export function outingIsStale(
  outing: Outing,
  now: number,
  finishedFor: number,
): boolean {
  if (outing.members.length === 0) {
    return true;
  }

  if (outing.phase === "gathering") {
    return now - outing.since > GATHER_MS;
  }

  return outing.phase === "done" && now - outing.since > finishedFor;
}

/* ------------------------------------------------------------------ *
 * What everybody is told
 * ------------------------------------------------------------------ */

export function outingView(outing: Outing): OutingView {
  return {
    id: outing.id,
    kind: outing.kind,
    phase: outing.phase,
    members: outing.members,
    since: outing.since,
    deadline: outing.deadline,
    done: outing.done,
    ended: outing.ended,
    race: outing.race,
    hide: outing.hide,
  };
}

/**
 * Whether two states of a round would be told to the room as the same thing.
 *
 * Noting where a hider settled changes the round and must change nothing
 * anybody is sent. Compared by identity, which works because every transition
 * above reuses whatever part of the round it did not touch.
 */
export function sameView(a: Outing, b: Outing): boolean {
  return (
    a.phase === b.phase &&
    a.members === b.members &&
    a.since === b.since &&
    a.deadline === b.deadline &&
    a.done === b.done &&
    a.ended === b.ended &&
    a.race === b.race &&
    a.hide === b.hide
  );
}

/**
 * Whose poses must not reach whom, as [the bee, who must not see it].
 *
 * Only while the seeker counts. A seeker's screen that simply does not draw
 * the hiders is a seeker one browser console away from watching them, so the
 * room does not send what should not be seen.
 */
export function blindPairs(outing: Outing): [string, string][] {
  if (outing.phase !== "hiding" || !outing.hide) {
    return [];
  }

  const { hiders, seekers } = outing.hide;

  return hiders.flatMap((hider) =>
    seekers.map((seeker): [string, string] => [hider, seeker]),
  );
}

/**
 * The room's list, with the rounds you have asked to leave already left.
 *
 * For the screen, and nothing to do with the room. Leaving is applied at once,
 * before the room answers, because it is the way out of being held at a start
 * line. But a list the room sent a moment BEFORE it heard you still has you in
 * the round, and taking it at its word put the card back and froze the bee
 * again for the length of a round trip. So until the room's own list agrees
 * that you have gone, a round you left stays left.
 *
 * `left` is pruned as it goes: once the room has caught up there is nothing to
 * remember.
 */
export function withoutLeft(
  outings: OutingView[],
  you: string,
  left: Set<string>,
): OutingView[] {
  if (left.size === 0) {
    return outings;
  }

  const still = new Set<string>();
  const next = outings.map((outing) => {
    if (
      !left.has(outing.id) ||
      !outing.members.some((member) => member.sub === you) ||
      outing.done.includes(you)
    ) {
      return outing;
    }

    still.add(outing.id);

    return { ...outing, done: [...outing.done, you] };
  });

  for (const id of [...left]) {
    if (!still.has(id)) {
      left.delete(id);
    }
  }

  return next;
}

/* ------------------------------------------------------------------ *
 * Reading a result
 * ------------------------------------------------------------------ */

export type Standing = {
  sub: string;
  name: string;
  gates: number;
  finishedIn: number | null;
  /** 1 for first. Shared by finishes too close to call. */
  place: number;
};

/**
 * A race in finishing order: those who are home by time, then the rest by how
 * far round they are.
 */
export function raceStandings(
  race: RaceView,
  members: OutingView["members"],
): Standing[] {
  const rows = members
    .filter((member) => race.progress[member.sub])
    .map((member) => ({ ...member, ...race.progress[member.sub], place: 0 }))
    .sort((a, b) => {
      if (a.finishedIn !== null && b.finishedIn !== null) {
        return a.finishedIn - b.finishedIn;
      }

      if (a.finishedIn !== null || b.finishedIn !== null) {
        return a.finishedIn !== null ? -1 : 1;
      }

      return b.gates - a.gates;
    });

  // Against the FIRST of those it is level with, and not the one before it.
  // Compared each with the last, three finishes a tenth of a second apart
  // were all first, though the first and the third were nowhere near level.
  let first = rows[0];

  rows.forEach((row, at) => {
    const level =
      at > 0 &&
      ((row.finishedIn !== null &&
        first.finishedIn !== null &&
        row.finishedIn - first.finishedIn <= LEVEL_MS) ||
        (row.finishedIn === null &&
          first.finishedIn === null &&
          row.gates === first.gates));

    if (!level) {
      first = row;
    }

    row.place = level ? first.place : at + 1;
  });

  return rows;
}
