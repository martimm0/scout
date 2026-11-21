import { expect, test } from "@playwright/test";

import { COURSES, raceGates, type ParkId } from "../party/games/courses";
import { OutingRoom } from "../party/games/outing-room";
import {
  COUNTDOWN_MS,
  DASH_MIN,
  FIND_RADIUS,
  GATHER_MS,
  HIDING_MS,
  JOIN_RADIUS,
  RACE_CAP_MS,
  SEEKING_MS,
  SETTLE_MS,
  TAG_GRACE_MS,
  beginOuting,
  blindPairs,
  awayFromStart,
  gateCrossed,
  inOuting,
  joinOuting,
  leaveOuting,
  openHide,
  openRace,
  outingIsStale,
  outingPose,
  outingTick,
  outingView,
  raceStandings,
  readyOuting,
  sameView,
  warmthBand,
  whereInArea,
  withoutLeft,
  type Outing,
  type PoseOf,
} from "../party/games/outings";
import type { Gate, OutingView, Pose } from "../party/protocol";
import { resolveCollision } from "../src/features/game/world/collision";
import {
  PARKS,
  setActivePark,
  startPosition,
  terrainHeight,
} from "../src/features/game/world/terrain";

/**
 * Races and hide and seek, as arithmetic.
 *
 * No browser and no socket. The room referees these rounds from the poses it
 * relays, so the rules are functions of "where was this bee, and where is it
 * now", and a test can say both. The cases that matter cannot be reached by
 * flying a browser at them: a bee that steps over a gate between two poses, two
 * finishes a tenth of a second apart, a hider found by a seeker who was a hider
 * a moment ago.
 */

function at(x: number, z: number, altitude = 60): Pose {
  return { x, z, altitude, heading: 0, gesture: "none" };
}

/** Everybody's latest pose, as the room would hold it. */
function everybody(where: Record<string, Pose | null>): PoseOf {
  return (sub) => where[sub] ?? null;
}

const GATE: Gate = { name: "A gate", x: 100, z: 0, radius: 16 };
const UNDER: Gate = { name: "Under", x: 100, z: 0, radius: 16, top: 78 };

test.describe("a gate", () => {
  test("is passed by flying through it, and not by stopping short", () => {
    expect(gateCrossed(at(70, 0), at(95, 0), GATE)).not.toBeNull();
    expect(gateCrossed(at(40, 0), at(70, 0), GATE)).toBeNull();
    // Past it on the far side counts, since the line went through.
    expect(gateCrossed(at(80, 0), at(120, 0), GATE)).not.toBeNull();
    // Beside it does not.
    expect(gateCrossed(at(80, 30), at(120, 30), GATE)).toBeNull();
  });

  test("is passed by a bee that stepped clean over the middle of it", () => {
    // Ten units between poses is a boosting bee. Neither end is inside a
    // six-unit gate, and the line between them is.
    const narrow = { ...GATE, radius: 3 };

    expect(Math.hypot(95 - 100, 0)).toBeGreaterThan(narrow.radius);
    expect(gateCrossed(at(95, 0), at(105, 0), narrow)).toBeCloseTo(0.2, 5);
  });

  test("says how far along the line it was passed", () => {
    // From 64 to 104, the gate's edge is at 84: halfway.
    expect(gateCrossed(at(64, 0), at(104, 0), GATE)).toBeCloseTo(0.5, 5);
    // Already inside it at the first pose.
    expect(gateCrossed(at(96, 0), at(104, 0), GATE)).toBe(0);
  });

  test("with no earlier pose to draw a line from, asks only where the bee is", () => {
    expect(gateCrossed(null, at(100, 4), GATE)).toBe(1);
    expect(gateCrossed(null, at(60, 0), GATE)).toBeNull();
  });

  test("counts a hovering bee that is inside it, and not one that is not", () => {
    expect(gateCrossed(at(100, 0), at(100, 0), GATE)).toBe(0);
    expect(gateCrossed(at(60, 0), at(60, 0), GATE)).toBeNull();
  });

  test("under a bridge is not passed over the top of the deck", () => {
    expect(gateCrossed(at(70, 0, 120), at(130, 0, 120), UNDER)).toBeNull();
    expect(gateCrossed(at(70, 0, 60), at(130, 0, 60), UNDER)).not.toBeNull();
    // In over the deck and down through it while still inside: counted from
    // where it went under, and not from where it came in.
    const along = gateCrossed(at(84, 0, 98), at(116, 0, 58), UNDER);

    expect(along).toBeCloseTo(0.5, 5);
  });
});

function sprint(now = 1000): Outing {
  const start = COURSES.frick.sprint.start;
  const race = openRace("o1", "frick", "sprint", "ada", "Ada", at(start.x, start.z), now);

  if (!race) {
    throw new Error("a sprint could not be opened");
  }

  return race;
}

/** A race that is under way, with everybody at the start. */
function running(members: string[] = ["ada", "bo"]): Outing {
  const start = COURSES.frick.sprint.start;
  const here = everybody(
    Object.fromEntries(members.map((sub) => [sub, at(start.x, start.z)])),
  );
  let race = sprint();

  for (const sub of members.slice(1)) {
    race = joinOuting(race, sub, sub, here(sub));
  }

  race = beginOuting(race, members[0], 2000, here);
  race = outingTick(race, 2000 + COUNTDOWN_MS, here);

  expect(race.phase).toBe("running");

  return race;
}

/** Fly one racer straight through every gate of the race, a pose per gate. */
function flyRound(
  race: Outing,
  who: string,
  startAt: number,
  step = 1000,
): { race: Outing; now: number } {
  const gates = raceGates(race.park, race.race!);
  let now = startAt;
  let last: Pose | null = null;

  for (let lap = 0; lap < race.race!.laps; lap += 1) {
    for (const gate of gates) {
      const next = at(gate.x, gate.z);

      now += step;
      race = outingPose(race, who, last, now - 200, next, now, () => null);
      last = next;
    }
  }

  return { race, now };
}

test.describe("a race", () => {
  test("is opened from anywhere, joined at the start, and begun by its host", () => {
    const start = COURSES.frick.sprint.start;
    const far = at(start.x + JOIN_RADIUS + 5, start.z);
    const near = at(start.x + JOIN_RADIUS - 5, start.z);
    const race = openRace("o1", "frick", "sprint", "ada", "Ada", far, 1000)!;

    expect(race.phase).toBe("gathering");
    expect(race.members.map((member) => member.sub)).toEqual(["ada"]);

    // Too far to join, and the refusal is the same object.
    expect(joinOuting(race, "bo", "Bo", far)).toBe(race);
    expect(joinOuting(race, "bo", "Bo", null)).toBe(race);

    const joined = joinOuting(race, "bo", "Bo", near);

    expect(joined.members.map((member) => member.sub)).toEqual(["ada", "bo"]);
    // Twice is once.
    expect(joinOuting(joined, "bo", "Bo", near)).toBe(joined);

    // Bo did not open it, so Bo cannot start it.
    const both = everybody({ ada: near, bo: near });

    expect(beginOuting(joined, "bo", 2000, both)).toBe(joined);
    // Nor can the host from across the park.
    expect(beginOuting(joined, "ada", 2000, everybody({ ada: far, bo: near }))).toBe(joined);

    const begun = beginOuting(joined, "ada", 2000, both);

    expect(begun.phase).toBe("countdown");
    expect(begun.deadline).toBe(2000 + COUNTDOWN_MS);
    // And nobody walks in once it has.
    expect(joinOuting(begun, "cy", "Cy", near)).toBe(begun);
  });

  test("leaves behind anybody who joined and then wandered off", () => {
    const start = COURSES.frick.sprint.start;
    const here = at(start.x, start.z);
    const race = joinOuting(sprint(), "bo", "Bo", here);
    const begun = beginOuting(
      race,
      "ada",
      2000,
      everybody({ ada: here, bo: at(start.x + 200, start.z) }),
    );

    expect(begun.members.map((member) => member.sub)).toEqual(["ada"]);
    expect(Object.keys(begun.race!.progress)).toEqual(["ada"]);
  });

  test("can be flown alone", () => {
    const race = running(["ada"]);
    const flown = flyRound(race, "ada", 10_000);

    expect(flown.race.phase).toBe("done");
    expect(flown.race.race!.progress.ada.finishedIn).not.toBeNull();
  });

  test("holds everybody until the countdown is over", () => {
    const start = COURSES.frick.sprint.start;
    const here = everybody({ ada: at(start.x, start.z) });
    const begun = beginOuting(sprint(), "ada", 2000, here);

    expect(outingTick(begun, 2000 + COUNTDOWN_MS - 1, here)).toBe(begun);

    // A pose through the first gate during the countdown earns nothing.
    const first = raceGates("frick", begun.race!)[0];

    expect(
      outingPose(begun, "ada", null, 0, at(first.x, first.z), 3000, here),
    ).toBe(begun);

    const go = outingTick(begun, 2000 + COUNTDOWN_MS + 40, here);

    expect(go.phase).toBe("running");
    // The clock starts when the room says go, and not at the nominal deadline.
    expect(go.race!.startedAt).toBe(2000 + COUNTDOWN_MS + 40);
    expect(go.deadline).toBe(go.race!.startedAt + RACE_CAP_MS);
  });

  test("counts only the next gate, in order", () => {
    const race = running();
    const gates = raceGates("frick", race.race!);

    // Straight to the second gate: nothing.
    expect(
      outingPose(race, "ada", null, 0, at(gates[1].x, gates[1].z), 9000, () => null),
    ).toBe(race);

    const first = outingPose(race, "ada", null, 0, at(gates[0].x, gates[0].z), 9000, () => null);

    expect(first.race!.progress.ada.gates).toBe(1);
    expect(first.race!.progress.bo.gates).toBe(0);
    // Sitting in the first gate is not passing it again.
    expect(
      outingPose(first, "ada", at(gates[0].x, gates[0].z), 9000, at(gates[0].x, gates[0].z), 9100, () => null),
    ).toBe(first);
  });

  test("gives one gate for one pose, however many the line went through", () => {
    const race = running();
    const gates = raceGates("frick", race.race!);
    // One straight line through the middle of the first gate and on into the
    // middle of the second: it starts thirty units short of the first, on the
    // far side from the second.
    const [first, second] = gates;
    const span = Math.hypot(second.x - first.x, second.z - first.z);
    const before = at(
      first.x - ((second.x - first.x) / span) * 30,
      first.z - ((second.z - first.z) / span) * 30,
    );
    const beyond = at(second.x, second.z);

    expect(gateCrossed(before, beyond, first)).not.toBeNull();
    expect(gateCrossed(before, beyond, second)).not.toBeNull();

    const next = outingPose(race, "ada", before, 8900, beyond, 9000, () => null);

    expect(next.race!.progress.ada.gates).toBe(1);
  });

  test("needs every gate again on the second lap", () => {
    const race = running(["ada"]);
    const gates = raceGates("frick", race.race!);

    expect(race.race!.laps).toBeGreaterThan(1);

    let state = race;
    let now = 10_000;

    for (const gate of gates) {
      now += 500;
      state = outingPose(state, "ada", null, 0, at(gate.x, gate.z), now, () => null);
    }

    // One lap is not a finish.
    expect(state.race!.progress.ada.gates).toBe(gates.length);
    expect(state.race!.progress.ada.finishedIn).toBeNull();
    expect(state.phase).toBe("running");

    // The finish again, straight away, is not the next gate.
    const last = gates[gates.length - 1];

    expect(outingPose(state, "ada", null, 0, at(last.x, last.z), now + 500, () => null)).toBe(state);
  });

  test("times a finish from where on the line it happened", () => {
    const race = running(["ada"]);
    const gates = raceGates("frick", race.race!);
    const total = gates.length * race.race!.laps;
    const finish = gates[gates.length - 1];
    let state = race;

    // Everything but the last gate.
    for (let passed = 0; passed < total - 1; passed += 1) {
      const gate = gates[passed % gates.length];

      state = outingPose(state, "ada", null, 0, at(gate.x, gate.z), 20_000, () => null);
    }

    expect(state.race!.progress.ada.gates).toBe(total - 1);

    // Two poses 200 ms apart, the gate's edge exactly halfway between them.
    const from = at(finish.x - finish.radius - 20, finish.z);
    const to = at(finish.x - finish.radius + 20, finish.z);
    const done = outingPose(state, "ada", from, 30_000, to, 30_200, () => null);

    expect(done.race!.progress.ada.finishedIn).toBe(30_100 - race.race!.startedAt);
    expect(done.phase).toBe("done");
  });

  test("does not join a pose to one from before a sleeping tab", () => {
    const race = running(["ada"]);
    const first = raceGates("frick", race.race!)[0];
    // The line between these two goes straight through the gate, and the first
    // of them is five seconds old.
    const before = at(first.x - 40, first.z);
    const after = at(first.x + 40, first.z);

    expect(outingPose(race, "ada", before, 4000, after, 9000, () => null)).toBe(race);
    expect(outingPose(race, "ada", before, 8900, after, 9000, () => null)).not.toBe(race);
  });

  test("is over when everybody is home, in the order they got there", () => {
    let race = running(["ada", "bo", "cy"]);

    race = flyRound(race, "bo", 10_000, 1000).race;

    expect(race.phase).toBe("running");

    race = flyRound(race, "ada", 10_000, 1500).race;
    race = flyRound(race, "cy", 10_000, 1200).race;

    expect(race.phase).toBe("done");
    expect(race.ended).toBeUndefined();
    expect(
      raceStandings(race.race!, race.members).map((row) => [row.sub, row.place]),
    ).toEqual([
      ["bo", 1],
      ["cy", 2],
      ["ada", 3],
    ]);
  });

  test("calls two finishes it cannot tell apart level", () => {
    const race = running(["ada", "bo"]);
    const standings = raceStandings(
      {
        ...race.race!,
        progress: {
          ada: { gates: 16, finishedIn: 40_100 },
          bo: { gates: 16, finishedIn: 40_000 },
        },
      },
      race.members,
    );

    expect(standings.map((row) => [row.sub, row.place])).toEqual([
      ["bo", 1],
      ["ada", 1],
    ]);
  });

  test("does not call three finishes level because each was close to the last", () => {
    const race = running(["ada", "bo", "cy"]);
    const standings = raceStandings(
      {
        ...race.race!,
        progress: {
          ada: { gates: 16, finishedIn: 40_000 },
          bo: { gates: 16, finishedIn: 40_140 },
          // Level with Bo, and more than a quarter of a second behind Ada.
          cy: { gates: 16, finishedIn: 40_280 },
        },
      },
      race.members,
    );

    expect(standings.map((row) => [row.sub, row.place])).toEqual([
      ["ada", 1],
      ["bo", 1],
      ["cy", 3],
    ]);
  });

  test("gives nothing to a pose so far away the arithmetic gives up", () => {
    // 1e200 is a finite number, so the room lets it in, and its square is
    // not. It used to come out as a gate passed, with a finishing time of NaN.
    const race = running(["ada"]);
    const first = raceGates("frick", race.race!)[0];

    expect(
      outingPose(race, "ada", at(first.x - 40, first.z), 8900, at(1e200, first.z), 9000, () => null),
    ).toBe(race);
    expect(
      outingPose(race, "ada", at(1e200, 1e200), 8900, at(first.x, first.z), 9000, () => null)
        .race!.progress.ada.finishedIn,
    ).toBeNull();
  });

  test("is called when the time runs out, and says so", () => {
    const race = running(["ada", "bo"]);
    const first = raceGates("frick", race.race!)[0];
    const some = outingPose(race, "bo", null, 0, at(first.x, first.z), 9000, () => null);

    expect(outingTick(some, some.deadline - 1, () => null)).toBe(some);

    const called = outingTick(some, some.deadline, () => null);

    expect(called.phase).toBe("done");
    expect(called.ended).toBe("time");
    // Still flying, ordered by how far round they got.
    expect(raceStandings(called.race!, called.members).map((row) => row.sub)).toEqual(["bo", "ada"]);
  });

  test("carries on without somebody who leaves, and ends if they were the last out", () => {
    let race = running(["ada", "bo"]);

    race = flyRound(race, "ada", 10_000).race;

    expect(race.phase).toBe("running");

    const left = leaveOuting(race, "bo", 60_000);

    expect(left.phase).toBe("done");
    expect(left.members.map((member) => member.sub)).toEqual(["ada"]);
    expect(left.race!.progress.bo).toBeUndefined();
  });

  test("keeps the time of a racer who is home and goes, and lets them go", () => {
    let race = running(["ada", "bo"]);

    race = flyRound(race, "ada", 10_000).race;

    const time = race.race!.progress.ada.finishedIn;

    expect(time).not.toBeNull();
    expect(inOuting(race, "ada")).toBe(true);

    // Home, and tired of waiting for Bo. Her time was deleted with her, and
    // Bo then finished first in a race he had lost by a lap.
    const gone = leaveOuting(race, "ada", 30_000);

    expect(gone.phase).toBe("running");
    expect(gone.race!.progress.ada.finishedIn).toBe(time);
    expect(gone.members.map((member) => member.sub)).toEqual(["ada", "bo"]);
    expect(gone.done).toEqual(["ada"]);
    // Not in it any more, as far as starting something else goes.
    expect(inOuting(gone, "ada")).toBe(false);
    expect(inOuting(gone, "bo")).toBe(true);
    // Twice is once.
    expect(leaveOuting(gone, "ada", 31_000)).toBe(gone);

    const flown = flyRound(gone, "bo", 40_000);

    expect(flown.race.phase).toBe("done");
    expect(
      raceStandings(flown.race.race!, flown.race.members).map((row) => [row.sub, row.place]),
    ).toEqual([
      ["ada", 1],
      ["bo", 2],
    ]);
    // Bo is still reading it, and when he has, nobody is.
    expect(outingIsStale(flown.race, flown.now, 60_000)).toBe(false);
    expect(outingIsStale(leaveOuting(flown.race, "bo", flown.now), flown.now, 60_000)).toBe(true);

    // And if Bo gives up instead, there is nobody left to read a result.
    expect(outingIsStale(leaveOuting(gone, "bo", 50_000), 50_000, 60_000)).toBe(true);
  });

  test("says who would be left behind, by the rule that leaves them", () => {
    const start = COURSES.frick.sprint.start;
    const here = at(start.x, start.z);
    let race = joinOuting(sprint(), "bo", "Bo", here);

    race = joinOuting(race, "cy", "Cy", here);

    const where = everybody({
      ada: here,
      bo: at(start.x + JOIN_RADIUS + 1, start.z),
      // Cy joined and has not been heard from since.
      cy: null,
    });

    expect(awayFromStart(race.members, race.race!.start, where)).toEqual(["bo", "cy"]);
    expect(awayFromStart(race.members, race.race!.start, everybody({ ada: here, bo: here, cy: here }))).toEqual([]);
    // The same answer the room gives when it begins.
    expect(beginOuting(race, "ada", 2000, where).members.map((member) => member.sub)).toEqual(["ada"]);
  });

  test("passes to the next bee when its host leaves before it starts", () => {
    const start = COURSES.frick.sprint.start;
    const here = at(start.x, start.z);
    const race = joinOuting(sprint(), "bo", "Bo", here);
    const left = leaveOuting(race, "ada", 3000);

    expect(left.members[0].sub).toBe("bo");
    expect(beginOuting(left, "bo", 4000, everybody({ bo: here })).phase).toBe("countdown");
    // Somebody who was never in it leaving changes nothing.
    expect(leaveOuting(race, "nobody", 3000)).toBe(race);
  });

  test("keeps its result until everybody has pressed Done, or a while has passed", () => {
    let race = running(["ada", "bo"]);

    race = flyRound(race, "ada", 10_000).race;

    const flown = flyRound(race, "bo", 10_000);

    race = flown.race;

    expect(race.phase).toBe("done");
    expect(outingIsStale(race, race.since + 59_000, 60_000)).toBe(false);
    expect(outingIsStale(race, race.since + 61_000, 60_000)).toBe(true);

    const one = leaveOuting(race, "ada", flown.now);

    // Done is noted beside her, and the result still reads.
    expect(one.done).toEqual(["ada"]);
    expect(one.members).toHaveLength(2);
    expect(outingIsStale(one, flown.now, 60_000)).toBe(false);

    const both = leaveOuting(one, "bo", flown.now);

    expect(outingIsStale(both, flown.now, 60_000)).toBe(true);
  });
});

test.describe("a quick dash", () => {
  test("starts where its host is, and is sent somewhere far enough to be a flight", () => {
    for (const park of ["frick", "schenley", "highland"] as ParkId[]) {
      const spawn = PARKS[park].start;
      const here = at(spawn[0], spawn[2]);

      for (const roll of [0, 0.3, 0.6, 0.999]) {
        const dash = openRace("o1", park, "dash", "ada", "Ada", here, 1000)!;

        expect(dash.race!.start.x).toBe(here.x);
        // Nowhere to go until it begins.
        expect(raceGates(park, dash.race!)).toEqual([]);

        const begun = beginOuting(dash, "ada", 2000, everybody({ ada: here }), () => roll);
        const [target] = raceGates(park, begun.race!);

        expect(begun.phase).toBe("countdown");
        expect(
          Math.hypot(target.x - here.x, target.z - here.z),
          `${park} sent a dash to ${target.name}`,
        ).toBeGreaterThanOrEqual(DASH_MIN);
      }
    }
  });

  test("cannot be opened by somebody the room has never heard from", () => {
    expect(openRace("o1", "frick", "dash", "ada", "Ada", null, 1000)).toBeNull();
  });

  test("is won by reaching the one gate", () => {
    const here = at(-180, 155);
    const both = everybody({ ada: here, bo: here });
    let dash = openRace("o1", "frick", "dash", "ada", "Ada", here, 1000)!;

    dash = joinOuting(dash, "bo", "Bo", here);
    dash = beginOuting(dash, "ada", 2000, both, () => 0);
    dash = outingTick(dash, 2000 + COUNTDOWN_MS, both);

    const [target] = raceGates("frick", dash.race!);

    dash = outingPose(dash, "bo", null, 0, at(target.x, target.z), 20_000, both);

    expect(dash.race!.progress.bo.finishedIn).not.toBeNull();
    expect(dash.phase).toBe("running");

    dash = outingPose(dash, "ada", null, 0, at(target.x, target.z), 24_000, both);

    expect(dash.phase).toBe("done");
    expect(raceStandings(dash.race!, dash.members)[0].sub).toBe("bo");
  });
});

/** Hide and seek that has begun, with Ada seeking in the first hiding place. */
function hiding(members: string[] = ["ada", "bo", "cy"]): Outing {
  let round = openHide("o1", "frick", "ada", "Ada", true, 1000);

  for (const sub of members.slice(1)) {
    round = joinOuting(round, sub, sub, null);
  }

  round = beginOuting(round, "ada", 2000, () => null, () => 0);

  expect(round.phase).toBe("hiding");
  expect(round.hide!.area).toBe(0);

  return round;
}

const AREA = COURSES.frick.hide[0];

/** A place inside the first hiding place, `east` units from its middle. */
function hidden(east = 0, north = 0): Pose {
  return at(AREA.x + east, AREA.z + north, 40);
}

test.describe("hide and seek", () => {
  test("needs two, and is joined from anywhere", () => {
    const alone = openHide("o1", "frick", "ada", "Ada", true, 1000);

    expect(beginOuting(alone, "ada", 2000, () => null)).toBe(alone);

    // No pose at all, and still let in: there is no start to be at.
    const two = joinOuting(alone, "bo", "Bo", null);

    expect(two.members).toHaveLength(2);
    expect(beginOuting(two, "bo", 2000, () => null)).toBe(two);
    expect(beginOuting(two, "ada", 2000, () => null).phase).toBe("hiding");
  });

  test("makes the host the seeker when they ask to be, and draws one when they do not", () => {
    // Said before it begins, so whoever joins knows what they are joining.
    expect(outingView(openHide("o1", "frick", "ada", "Ada", true, 0)).hide!.hostSeeks).toBe(true);
    expect(outingView(openHide("o1", "frick", "ada", "Ada", false, 0)).hide!.hostSeeks).toBe(false);
    expect(hiding().hide!.seekers).toEqual(["ada"]);
    expect(hiding().hide!.hiders).toEqual(["bo", "cy"]);

    let round = openHide("o1", "frick", "ada", "Ada", false, 1000);

    round = joinOuting(round, "bo", "Bo", null);
    round = joinOuting(round, "cy", "Cy", null);

    // The first draw is who seeks and the second is where.
    const draws = [0.99, 0.5];
    const begun = beginOuting(round, "ada", 2000, () => null, () => draws.shift()!);

    expect(begun.hide!.seekers).toEqual(["cy"]);
    expect(begun.hide!.hiders).toEqual(["ada", "bo"]);
    expect(begun.hide!.area).toBe(1);
  });

  test("keeps the hiders from the seeker while the seeker counts, and only then", () => {
    const round = hiding();

    expect(blindPairs(round)).toEqual([
      ["bo", "ada"],
      ["cy", "ada"],
    ]);

    const where = everybody({ bo: hidden(10), cy: hidden(-10) });
    const seeking = outingTick(round, round.deadline, where);

    expect(seeking.phase).toBe("seeking");
    expect(blindPairs(seeking)).toEqual([]);
    expect(blindPairs(openHide("o1", "frick", "ada", "Ada", true, 0))).toEqual([]);
  });

  test("never tells the room where anybody settled", () => {
    const where = everybody({ bo: hidden(10), cy: hidden(-10) });
    let round = outingTick(hiding(), 2000 + HIDING_MS, where);

    round = outingPose(round, "bo", null, 0, hidden(10), round.since + SETTLE_MS, where);

    expect(Object.keys(round.anchors)).toEqual(["bo"]);
    expect(JSON.stringify(outingView(round))).not.toContain("anchors");
    expect(JSON.stringify(outingView(round))).not.toContain(String(AREA.x + 10));
  });

  test("ends the count early once every hider says they are hidden", () => {
    const where = everybody({ bo: hidden(10), cy: hidden(-10) });
    const round = hiding();

    // The seeker is not hiding and has nothing to be ready about.
    expect(readyOuting(round, "ada", 5000, where)).toBe(round);

    const one = readyOuting(round, "bo", 5000, where);

    expect(one.phase).toBe("hiding");
    expect(one.hide!.ready).toEqual(["bo"]);
    expect(readyOuting(one, "bo", 5100, where)).toBe(one);

    const all = readyOuting(one, "cy", 6000, where);

    expect(all.phase).toBe("seeking");
    expect(all.since).toBe(6000);
    expect(all.deadline).toBe(6000 + SEEKING_MS);
  });

  test("does not keep counting for a hider who has gone home", () => {
    /**
     * Bo has said he is hidden and is held where he is. Cy, the one everybody
     * was waiting on, leaves. Everybody still hiding is ready, and the count
     * used to run its whole thirty seconds anyway.
     */
    const where = everybody({ bo: hidden(10), cy: hidden(-10) });
    const one = readyOuting(hiding(), "bo", 5000, where);

    expect(one.phase).toBe("hiding");

    const left = leaveOuting(one, "cy", 6000);

    // Over on the next pose, and not here: here there are no poses to say
    // who is outside the ring.
    expect(left.phase).toBe("hiding");
    expect(left.deadline).toBe(6000);

    const seeking = outingTick(left, 6100, where);

    expect(seeking.phase).toBe("seeking");
    expect(seeking.hide!.hiders).toEqual(["bo"]);

    // A hider leaving while another is still finding somewhere changes no clock.
    const waiting = leaveOuting(hiding(["ada", "bo", "cy", "dee"]), "dee", 6000);

    expect(waiting.deadline).toBe(2000 + HIDING_MS);
  });

  test("catches a hider who is not in the hiding place when the count ends", () => {
    const round = hiding();
    const where = everybody({
      bo: hidden(10),
      // Outside the ring.
      cy: at(AREA.x + AREA.radius + 30, AREA.z, 40),
    });
    const seeking = outingTick(round, round.deadline, where);

    expect(seeking.hide!.hiders).toEqual(["bo"]);
    expect(seeking.hide!.seekers).toEqual(["ada", "cy"]);
    expect(seeking.hide!.found).toEqual([
      { sub: "cy", name: "cy", by: null, byName: null, at: 0, why: "outside" },
    ]);
  });

  test("does not let the sky be a hiding place", () => {
    const round = hiding(["ada", "bo"]);
    const seeking = outingTick(
      round,
      round.deadline,
      everybody({ bo: at(AREA.x, AREA.z, AREA.top + 20) }),
    );

    // The only hider, caught, so the round is over as it starts.
    expect(seeking.hide!.found[0]).toMatchObject({ sub: "bo", why: "outside" });
    expect(seeking.phase).toBe("done");
  });

  test("catches a hider the room has never heard from", () => {
    const round = hiding(["ada", "bo"]);
    const seeking = outingTick(round, round.deadline, () => null);

    expect(seeking.hide!.found[0]).toMatchObject({ sub: "bo", why: "outside" });
  });

  test("finds a hider when a seeker's path passes close, and not when it does not", () => {
    const where = everybody({ bo: hidden(0), cy: hidden(40) });
    const seeking = outingTick(hiding(), 2000 + HIDING_MS, where);
    const now = seeking.since + 5000;

    // Past Bo with ten units to spare: nothing.
    expect(
      outingPose(seeking, "ada", hidden(-20, FIND_RADIUS + 4), now - 150, hidden(20, FIND_RADIUS + 4), now, where),
    ).toBe(seeking);

    // Neither end of this line is within reach of Bo. The middle of it is.
    const close = outingPose(seeking, "ada", hidden(-9, 2), now - 150, hidden(9, 2), now, where);

    expect(Math.hypot(9, 2)).toBeGreaterThan(FIND_RADIUS);
    expect(close.hide!.hiders).toEqual(["cy"]);
    expect(close.hide!.seekers).toEqual(["ada", "bo"]);
    expect(close.hide!.found).toEqual([
      { sub: "bo", name: "bo", by: "ada", byName: "Ada", at: 5000, why: "found" },
    ]);
    expect(close.phase).toBe("seeking");
  });

  test("measures in three dimensions, so flying over a hider is not finding them", () => {
    const where = everybody({ bo: hidden(0) });
    const seeking = outingTick(hiding(["ada", "bo"]), 2000 + HIDING_MS, where);
    const now = seeking.since + 5000;
    const above = { ...hidden(0), altitude: 40 + FIND_RADIUS + 10 };

    expect(outingPose(seeking, "ada", above, now - 150, above, now, where)).toBe(seeking);
  });

  test("gives a bee who has just been found a moment before they can find anybody", () => {
    // Bo and Cy behind the same tree, two units apart.
    const where = everybody({ bo: hidden(0), cy: hidden(2), dee: hidden(50) });
    const seeking = outingTick(hiding(["ada", "bo", "cy", "dee"]), 2000 + HIDING_MS, where);
    const now = seeking.since + 5000;
    // Ada reaches Bo, from the side away from Cy.
    const tagged = outingPose(seeking, "ada", hidden(-20), now - 150, hidden(-5), now, where);

    expect(tagged.hide!.hiders).toEqual(["cy", "dee"]);

    // Bo's very next pose is within reach of Cy, and finds nobody.
    expect(outingPose(tagged, "bo", hidden(0), now, hidden(0), now + 170, where)).toBe(tagged);

    // A few seconds on, it does.
    const later = now + TAG_GRACE_MS + 10;
    const second = outingPose(tagged, "bo", hidden(0), later - 150, hidden(0), later, where);

    expect(second.hide!.hiders).toEqual(["dee"]);
    expect(second.hide!.found[1]).toMatchObject({ sub: "cy", by: "bo" });
  });

  test("lets a hider land on a flower, and catches one who flies off", () => {
    const where = everybody({ bo: hidden(0) });
    const seeking = outingTick(hiding(["ada", "bo", "cy"]), 2000 + HIDING_MS, everybody({ bo: hidden(0), cy: hidden(30) }));

    // Still coasting to a stop when the seeking starts: not yet their spot.
    const early = outingPose(seeking, "bo", null, 0, hidden(8), seeking.since + 200, where);

    expect(early).toBe(seeking);

    const settled = outingPose(seeking, "bo", null, 0, hidden(0), seeking.since + SETTLE_MS, where);

    expect(settled.anchors.bo).toEqual({ x: AREA.x, z: AREA.z, altitude: 40 });
    // Noting it is a change to the round, and nothing the room is told.
    expect(settled).not.toBe(seeking);
    expect(sameView(seeking, settled)).toBe(true);

    // Twelve units is a landing: the drawn bee eases onto a perch.
    expect(outingPose(settled, "bo", null, 0, hidden(12), settled.since + 9000, where)).toBe(settled);

    const moved = outingPose(settled, "bo", null, 0, hidden(25), settled.since + 9000, where);

    expect(moved.hide!.found).toEqual([
      { sub: "bo", name: "bo", by: null, byName: null, at: 9000, why: "moved" },
    ]);
    expect(moved.hide!.seekers).toEqual(["ada", "bo"]);
  });

  test("still says who found somebody after the finder has gone home", () => {
    const where = everybody({ bo: hidden(0), cy: hidden(40) });
    const seeking = outingTick(hiding(), 2000 + HIDING_MS, where);
    const now = seeking.since + 5000;
    const found = outingPose(seeking, "ada", null, 0, hidden(1), now, where);
    // Ada found Bo and left. Bo is a seeker now, so the round goes on, and
    // his row read "found by A bee" to the end of it.
    const left = leaveOuting(found, "ada", now + 1000);

    expect(left.phase).toBe("seeking");
    expect(left.members.map((member) => member.sub)).toEqual(["bo", "cy"]);
    expect(left.hide!.found[0]).toMatchObject({ sub: "bo", by: "ada", byName: "Ada" });
  });

  test("tells a hider who is too high that they are too high, and not that they are outside", () => {
    expect(whereInArea(hidden(0), AREA)).toBe("inside");
    expect(whereInArea(hidden(AREA.radius + 5), AREA)).toBe("outside");
    // Over the middle of it and above the trees: the hint used to be
    // "outside it: 0 ahead", pointing at the spot directly underneath.
    expect(whereInArea({ ...hidden(0), altitude: AREA.top + 5 }, AREA)).toBe("above");
    // Too high and outside it is outside it: that is the thing to fix first.
    expect(whereInArea({ ...hidden(AREA.radius + 5), altitude: AREA.top + 5 }, AREA)).toBe("outside");
  });

  test("is over when the last hider is found, and they are the last name on the list", () => {
    const where = everybody({ bo: hidden(0), cy: hidden(40) });
    let round = outingTick(hiding(), 2000 + HIDING_MS, where);
    const now = round.since + 5000;

    round = outingPose(round, "ada", null, 0, hidden(1), now, where);
    round = outingPose(round, "ada", null, 0, hidden(41), now + 4000, where);

    expect(round.phase).toBe("done");
    expect(round.ended).toBeUndefined();
    expect(round.hide!.found.map((entry) => entry.sub)).toEqual(["bo", "cy"]);
    expect(round.hide!.hiders).toEqual([]);
  });

  test("is called when the time runs out, with whoever was never found", () => {
    const where = everybody({ bo: hidden(0), cy: hidden(40) });
    let round = outingTick(hiding(), 2000 + HIDING_MS, where);

    round = outingPose(round, "ada", null, 0, hidden(1), round.since + 5000, where);

    expect(outingTick(round, round.deadline - 1, where)).toBe(round);

    const called = outingTick(round, round.deadline, where);

    expect(called.phase).toBe("done");
    expect(called.ended).toBe("time");
    expect(called.hide!.hiders).toEqual(["cy"]);
  });

  test("ends when the only seeker goes, or the last hider does", () => {
    const where = everybody({ bo: hidden(0), cy: hidden(40) });
    const seeking = outingTick(hiding(), 2000 + HIDING_MS, where);
    const noSeeker = leaveOuting(seeking, "ada", seeking.since + 1000);

    expect(noSeeker.phase).toBe("done");
    expect(noSeeker.ended).toBe("left");

    // One hider leaving is not the end of it.
    const one = leaveOuting(seeking, "bo", seeking.since + 1000);

    expect(one.phase).toBe("seeking");
    expect(one.hide!.hiders).toEqual(["cy"]);

    const none = leaveOuting(one, "cy", seeking.since + 2000);

    expect(none.phase).toBe("done");
    expect(none.ended).toBe("left");
  });

  test("tells a seeker how warm they are in words, nearer always warmer", () => {
    const order = ["cold", "cool", "warm", "hot"];
    let last = 0;

    for (let distance = 400; distance >= 0; distance -= 5) {
      const rank = order.indexOf(warmthBand(distance));

      expect(rank).toBeGreaterThanOrEqual(last);
      last = rank;
    }

    expect(warmthBand(400)).toBe("cold");
    expect(warmthBand(0)).toBe("hot");
    // Hot is close enough to see a bee, and not so close it is already found.
    expect(warmthBand(FIND_RADIUS * 3)).toBe("hot");
  });
});

test.describe("the room's list of rounds", () => {
  const start = COURSES.frick.sprint.start;
  const here = at(start.x, start.z);
  const all = everybody({ ada: here, bo: here, cy: here });

  test("opens, joins and begins by message, and ignores anything else", () => {
    const room = new OutingRoom(60_000);

    for (const junk of [
      null,
      7,
      "open",
      {},
      { do: "open" },
      { do: "open", kind: "race" },
      { do: "open", kind: "race", course: "marathon" },
      { do: "open", kind: "race", course: "constructor" },
      { do: "open", kind: "hide" },
      { do: "open", kind: "hide", seeker: "you" },
      { do: "open", kind: "chess", course: "sprint" },
      { do: "join" },
      { do: "join", id: 4 },
      { do: "join", id: "o99" },
      { do: "begin", id: "o99" },
      { do: "dance", id: "o1" },
    ]) {
      expect(room.handle("frick", "ada", "Ada", junk, 1000, all), JSON.stringify(junk)).toBe(false);
    }

    expect(room.list).toEqual([]);

    expect(room.handle("frick", "ada", "Ada", { do: "open", kind: "race", course: "sprint" }, 1000, all)).toBe(true);

    const id = room.views()[0].id;

    // One thing each: Ada has a round and cannot open another.
    expect(room.handle("frick", "ada", "Ada", { do: "open", kind: "hide", seeker: "me" }, 1000, all)).toBe(false);
    expect(room.has("ada")).toBe(true);
    expect(room.has("bo")).toBe(false);

    expect(room.handle("frick", "bo", "Bo", { do: "join", id }, 1100, all)).toBe(true);
    // Bo is not the host.
    expect(room.handle("frick", "bo", "Bo", { do: "begin", id }, 1200, all)).toBe(false);
    expect(room.handle("frick", "ada", "Ada", { do: "begin", id }, 1200, all)).toBe(true);
    expect(room.views()[0].phase).toBe("countdown");
    expect(room.nextDeadline).toBe(1200 + COUNTDOWN_MS);
  });

  test("lets a second round run beside the first", () => {
    const room = new OutingRoom(60_000);

    room.handle("frick", "ada", "Ada", { do: "open", kind: "race", course: "sprint" }, 1000, all);
    room.handle("frick", "ada", "Ada", { do: "begin", id: "o1" }, 1100, all);

    expect(room.handle("frick", "bo", "Bo", { do: "open", kind: "hide", seeker: "anyone" }, 1200, all)).toBe(true);
    expect(room.views().map((view) => view.kind)).toEqual(["race", "hide"]);
  });

  test("keeps the time by being asked, and says nothing when nothing is due", () => {
    const room = new OutingRoom(60_000);

    room.handle("frick", "ada", "Ada", { do: "open", kind: "race", course: "sprint" }, 1000, all);
    room.handle("frick", "ada", "Ada", { do: "begin", id: "o1" }, 1000, all);

    expect(room.tick(1000 + COUNTDOWN_MS - 1, all)).toBe(false);
    expect(room.tick(1000 + COUNTDOWN_MS, all)).toBe(true);
    expect(room.views()[0].phase).toBe("running");
    expect(room.nextDeadline).toBe(1000 + COUNTDOWN_MS + RACE_CAP_MS);
  });

  test("notes where a hider settled without telling anybody", () => {
    const room = new OutingRoom(60_000);
    const where = everybody({ ada: here, bo: hidden(0) });

    room.handle("frick", "ada", "Ada", { do: "open", kind: "hide", seeker: "me" }, 1000, where);
    room.handle("frick", "bo", "Bo", { do: "join", id: "o1" }, 1000, where);
    room.handle("frick", "ada", "Ada", { do: "begin", id: "o1" }, 1000, where, () => 0);

    expect(room.blindTo("bo")?.has("ada")).toBe(true);
    expect(room.blindTo("ada")).toBeUndefined();

    expect(room.handle("frick", "bo", "Bo", { do: "ready", id: "o1" }, 2000, where)).toBe(true);
    expect(room.blindTo("bo")).toBeUndefined();

    // The pose that fixes Bo's spot changes the round and publishes nothing.
    expect(room.onPose("bo", null, 0, hidden(0), 2000 + SETTLE_MS, where)).toBe(false);
    expect(room.list[0].anchors.bo).toBeDefined();
  });

  test("clears away a round nobody ever started, unless somebody is still arriving", () => {
    /**
     * A host opens a race and wanders off. Its start column stays lit over the
     * park for everybody, and nobody but the host can begin it.
     */
    const room = new OutingRoom(60_000);

    room.handle("frick", "ada", "Ada", { do: "open", kind: "race", course: "sprint" }, 1000, all);

    const opened = room.list[0];

    expect(outingIsStale(opened, 1000 + GATHER_MS, 60_000)).toBe(false);
    expect(outingIsStale(opened, 1000 + GATHER_MS + 1, 60_000)).toBe(true);
    // The room knows when to look, with nobody doing anything.
    expect(room.nextDeadline).toBe(1000 + GATHER_MS + 1);

    // Bo turns up nine minutes in, and the round is alive again from then.
    const late = 1000 + GATHER_MS - 60_000;

    room.handle("frick", "bo", "Bo", { do: "join", id: opened.id }, late, all);
    expect(room.tick(1000 + GATHER_MS + 1, all)).toBe(false);
    expect(room.list).toHaveLength(1);

    expect(room.tick(late + GATHER_MS + 1, all)).toBe(true);
    expect(room.list).toEqual([]);
    expect(room.has("ada")).toBe(false);
  });

  test("says who has just come into view when a count ends, and says it once", () => {
    /**
     * Relaying a hider's poses again is not enough. The seeker's screen threw
     * the last one away when the count began, and a hider who hid and then
     * looked at another tab never sends another: not drawn, and not findable.
     */
    const room = new OutingRoom(60_000);
    const where = everybody({ ada: here, bo: hidden(0), cy: hidden(20) });

    room.handle("frick", "ada", "Ada", { do: "open", kind: "hide", seeker: "me" }, 1000, where);
    room.handle("frick", "bo", "Bo", { do: "join", id: "o1" }, 1000, where);
    room.handle("frick", "cy", "Cy", { do: "join", id: "o1" }, 1000, where);
    room.handle("frick", "ada", "Ada", { do: "begin", id: "o1" }, 1000, where, () => 0);

    // Nobody comes into view by a count starting.
    expect(room.takeRevealed()).toEqual([]);

    room.handle("frick", "bo", "Bo", { do: "ready", id: "o1" }, 2000, where);
    expect(room.takeRevealed()).toEqual([]);

    // The clock runs out, with Cy never having said a word.
    expect(room.tick(1000 + HIDING_MS, where)).toBe(true);
    expect(room.takeRevealed()).toEqual([
      ["bo", "ada"],
      ["cy", "ada"],
    ]);
    expect(room.takeRevealed()).toEqual([]);
  });

  test("keeps a round you have left off your screen until the room agrees", () => {
    /**
     * Leaving is shown at once. A list the room sent a moment before it heard
     * you still has you in the round, and taking it at its word put the card
     * back and held the bee again for the length of a round trip.
     */
    const round = (members: string[], done: string[] = []): OutingView => ({
      id: "o1",
      kind: "race",
      phase: "running",
      members: members.map((sub) => ({ sub, name: sub })),
      since: 0,
      deadline: 0,
      done,
    });
    const left = new Set(["o1"]);

    // The stale list: still a member.
    const stale = withoutLeft([round(["ada", "bo"])], "ada", left);

    expect(stale[0].done).toEqual(["ada"]);
    expect(left.has("o1")).toBe(true);
    // Nobody else's view of it is touched.
    expect(withoutLeft([round(["ada", "bo"])], "bo", new Set(["o9"]))[0].done).toEqual([]);

    // The room has caught up: no longer a member, and nothing left to remember.
    const caught = [round(["bo"])];

    expect(withoutLeft(caught, "ada", left)).toEqual(caught);
    expect(left.size).toBe(0);

    // With nothing left, the list is handed back as it came.
    expect(withoutLeft(caught, "ada", left)).toBe(caught);
  });

  test("takes a leaver out of everything, and clears away what is finished", () => {
    const room = new OutingRoom(60_000);

    room.handle("frick", "ada", "Ada", { do: "open", kind: "race", course: "sprint" }, 1000, all);

    // The only member leaving removes the round.
    expect(room.leave("ada", 2000)).toBe(true);
    expect(room.list).toEqual([]);
    expect(room.nextDeadline).toBe(Infinity);

    room.handle("frick", "ada", "Ada", { do: "open", kind: "hide", seeker: "me" }, 3000, all);
    room.handle("frick", "bo", "Bo", { do: "join", id: "o2" }, 3000, all);
    room.handle("frick", "ada", "Ada", { do: "begin", id: "o2" }, 3000, all, () => 0);
    // Bo is nowhere near the hiding place, so the round ends as it starts.
    room.tick(3000 + HIDING_MS, all);

    expect(room.views()[0].phase).toBe("done");
    // A finished round does not stop anybody starting another.
    expect(room.has("ada")).toBe(false);

    const over = room.views()[0].since;

    expect(room.tick(over + 59_000, all)).toBe(false);
    expect(room.tick(over + 60_002, all)).toBe(true);
    expect(room.list).toEqual([]);
  });
});

/**
 * The room, played by nobody in particular.
 *
 * Every test above is a story somebody thought of. This is the ones nobody
 * did: six players pressing whatever they like in whatever order, flying to
 * gates and hiding places and each other, leaving, dropping out and letting
 * time pass, and after every single thing that happens the room is asked
 * whether it still makes sense. The seed is fixed, so a failure is the same
 * failure every time, and the message says which run and which step.
 */
test.describe("the room, under whatever anybody does", () => {
  /** A small seeded generator, so a run can be had again. */
  function seeded(seed: number) {
    let state = seed >>> 0;

    return () => {
      state = (state + 0x6d2b79f5) >>> 0;

      let mixed = state;

      mixed = Math.imul(mixed ^ (mixed >>> 15), mixed | 1);
      mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61);

      return ((mixed ^ (mixed >>> 14)) >>> 0) / 4_294_967_296;
    };
  }

  const WHO = ["ada", "bo", "cy", "dee", "eli", "fay"];
  const FINISHED_FOR = 60_000;

  /**
   * Plain throws, and not `expect`. This is asked half a million times in one
   * test, and an `expect` that passes still costs a matcher and a stack: with
   * them the test ran for minutes without finishing.
   */
  function must(holds: unknown, say: () => string) {
    if (!holds) {
      throw new Error(say());
    }
  }

  const sorted = (subs: string[]) => [...subs].sort().join();

  /** Everything that has to be true of a room, whatever has happened in it. */
  function sound(room: OutingRoom, kept: Map<string, number>, say: string) {
    const busy = new Set<string>();
    let blind = 0;

    for (const outing of room.list) {
      const tag = () => `${say}, ${outing.id} (${outing.kind}, ${outing.phase})`;
      const subs = outing.members.map((member) => member.sub);

      must(subs.length > 0, () => `${tag()}: a round with nobody in it was kept`);
      must(new Set(subs).size === subs.length, () => `${tag()}: somebody is in it twice`);
      must(
        outing.done.every((sub) => subs.includes(sub)),
        () => `${tag()}: Done was pressed by somebody who is not in it`,
      );

      for (const sub of subs) {
        if (inOuting(outing, sub)) {
          must(!busy.has(sub), () => `${tag()}: ${sub} is in two rounds at once`);
          busy.add(sub);
        }
      }

      if (outing.race) {
        const race = outing.race;
        const entries = Object.entries(race.progress);

        if (outing.phase !== "gathering") {
          must(
            sorted(entries.map(([sub]) => sub)) === sorted(subs),
            () => `${tag()}: the racers are not the members`,
          );
        }

        for (const [sub, entry] of entries) {
          const key = `${outing.id}/${sub}`;

          if (entry.finishedIn !== null) {
            must(
              Number.isFinite(entry.finishedIn) && entry.finishedIn >= 0,
              () => `${tag()}: ${sub} finished in ${entry.finishedIn}`,
            );
            // A time, once given, is that racer's for as long as the round
            // is on the list.
            must(
              (kept.get(key) ?? entry.finishedIn) === entry.finishedIn,
              () => `${tag()}: ${sub}'s time changed`,
            );
            kept.set(key, entry.finishedIn);
          } else {
            must(!kept.has(key), () => `${tag()}: ${sub} was home and is not any more`);
          }
        }

        for (const key of kept.keys()) {
          const [id, sub] = key.split("/");

          must(
            id !== outing.id || race.progress[sub],
            () => `${tag()}: ${sub}'s finish was taken out`,
          );
        }

        if (outing.phase === "running") {
          must(
            entries.some(([, entry]) => entry.finishedIn === null),
            () => `${tag()}: everybody is home and the race is still running`,
          );
          must(
            outing.done.every((sub) => race.progress[sub]?.finishedIn != null),
            () => `${tag()}: somebody still flying is marked as done with it`,
          );
        } else if (outing.phase !== "done") {
          must(outing.done.length === 0, () => `${tag()}: Done pressed before there was a result`);
        }
      }

      if (outing.hide && (outing.phase === "hiding" || outing.phase === "seeking")) {
        const { seekers, hiders, ready } = outing.hide;

        must(seekers.length > 0, () => `${tag()}: nobody is seeking`);
        must(hiders.length > 0, () => `${tag()}: nobody is hiding`);
        must(
          sorted([...seekers, ...hiders]) === sorted(subs),
          () => `${tag()}: the seekers and hiders are not the members, once each`,
        );
        must(ready.every((sub) => hiders.includes(sub)), () => `${tag()}: ready, and not hiding`);
        must(outing.done.length === 0, () => `${tag()}: Done pressed before there was a result`);

        if (outing.phase === "hiding") {
          blind += seekers.length * hiders.length;

          for (const hider of hiders) {
            for (const seeker of seekers) {
              must(
                room.blindTo(hider)?.has(seeker),
                () => `${tag()}: ${seeker} is counting and can be sent where ${hider} is`,
              );
            }
          }
        }
      }

      for (const entry of outing.hide?.found ?? []) {
        must(entry.at >= 0, () => `${tag()}: ${entry.sub} was found before the seeking began`);
        must(
          entry.why !== "found" || typeof entry.byName === "string",
          () => `${tag()}: ${entry.sub} was found by nobody`,
        );
      }

      if (outing.phase === "gathering" || outing.phase === "done") {
        must(Number.isFinite(room.nextDeadline), () => `${tag()}: nothing will ever clear it away`);
      } else {
        must(outing.deadline > 0, () => `${tag()}: a phase with no end`);
        must(
          room.nextDeadline <= outing.deadline,
          () => `${tag()}: the room will sleep through its deadline`,
        );
      }
    }

    // And nobody is kept from seeing anybody except by a count in progress.
    let pairs = 0;

    for (const sub of WHO) {
      pairs += room.blindTo(sub)?.size ?? 0;
    }

    must(pairs === blind, () => `${say}: ${pairs} hidden from view with ${blind} counted for`);
    // What everybody is sent can always be sent.
    JSON.stringify(room.views());
  }

  test("still makes sense after every step, and is empty in the end", () => {
    test.setTimeout(120_000);

    for (let run = 0; run < 400; run += 1) {
      const pick = seeded(run + 1);
      const among = <T,>(list: readonly T[]) => list[Math.floor(pick() * list.length)];
      const park = among(["frick", "schenley", "highland"] as ParkId[]);
      const room = new OutingRoom(FINISHED_FOR);
      const poses = new Map<string, Pose>();
      const heard = new Map<string, number>();
      const kept = new Map<string, number>();
      const poseOf: PoseOf = (sub) => poses.get(sub) ?? null;
      let now = 1_000_000;

      /** A pose arrives, exactly as the room's `pos` handler takes one. */
      const fly = (sub: string, pose: Pose) => {
        const prev = poses.get(sub) ?? null;
        const prevAt = heard.get(sub) ?? 0;

        poses.set(sub, pose);
        heard.set(sub, now);

        if (now >= room.nextDeadline) {
          room.tick(now, poseOf);
        }

        room.onPose(sub, prev, prevAt, pose, now, poseOf);
      };

      /** Somewhere worth being: a gate, a start, a hiding place, another bee. */
      const somewhere = (): Pose => {
        const course = COURSES[park];
        const kind = pick();

        if (kind < 0.35) {
          const gate = among([...course.sprint.gates, ...course.loop.gates, ...course.dash, course.sprint.start]);

          return at(gate.x, gate.z, pick() < 0.8 ? 40 : 200);
        }

        if (kind < 0.6) {
          const area = among(course.hide);

          return at(area.x + (pick() - 0.5) * 60, area.z + (pick() - 0.5) * 60, pick() < 0.85 ? 30 : area.top + 20);
        }

        if (kind < 0.85 && poses.size > 0) {
          const other = among([...poses.values()]);

          return at(other.x + (pick() - 0.5) * 6, other.z + (pick() - 0.5) * 6, other.altitude);
        }

        return at((pick() - 0.5) * 500, (pick() - 0.5) * 500, 20 + pick() * 200);
      };

      /**
       * Where this bee would go if it were trying: to the start of a race it
       * could join, through its next gate, into the hiding place, at a hider.
       * Wandering alone hardly ever finishes a sixteen-gate race or finds
       * anybody, and those are the states worth being in.
       */
      const purpose = (sub: string): Pose | null => {
        const mine = room.list.find((outing) => inOuting(outing, sub));

        if (!mine) {
          const open = room.list.find((outing) => outing.phase === "gathering" && outing.race);

          return open?.race ? at(open.race.start.x, open.race.start.z) : null;
        }

        if (mine.race) {
          const entry = mine.race.progress[sub];
          const gates = raceGates(park, mine.race);

          if (mine.phase !== "running" || !entry || gates.length === 0) {
            return at(mine.race.start.x, mine.race.start.z);
          }

          const next = gates[entry.gates % gates.length];

          return at(next.x, next.z, next.top === undefined ? 60 : next.top - 10);
        }

        if (mine.hide && mine.hide.area >= 0) {
          const area = COURSES[park].hide[mine.hide.area];

          if (mine.hide.hiders.includes(sub)) {
            return at(area.x + (pick() - 0.5) * 30, area.z + (pick() - 0.5) * 30, 30);
          }

          const hider = poses.get(among(mine.hide.hiders));

          return mine.phase === "seeking" && hider ? { ...hider } : null;
        }

        return null;
      };

      for (let step = 0; step < 300; step += 1) {
        const sub = among(WHO);
        const id = room.list.length > 0 ? among(room.list).id : "o0";
        const roll = pick();
        const ask = (message: Record<string, unknown>) =>
          room.handle(park, sub, sub, { t: "outing", ...message }, now, poseOf, pick);

        if (roll < 0.08) {
          ask({ do: "open", kind: "race", course: among(["sprint", "loop", "dash"]) });
        } else if (roll < 0.13) {
          ask({ do: "open", kind: "hide", seeker: among(["me", "anyone"]) });
        } else if (roll < 0.25) {
          ask({ do: "join", id });
        } else if (roll < 0.33) {
          ask({ do: "begin", id });
        } else if (roll < 0.4) {
          ask({ do: "ready", id });
        } else if (roll < 0.43) {
          ask({ do: "leave", id });
        } else if (roll < 0.44) {
          // The connection went.
          room.leave(sub, now);
          poses.delete(sub);
        } else if (roll < 0.94) {
          fly(sub, (pick() < 0.6 ? purpose(sub) : null) ?? somewhere());
        } else {
          now += Math.floor(pick() * (pick() < 0.2 ? 200_000 : 8_000));
        }

        now += Math.floor(pick() * 400);
        sound(room, kept, `run ${run + 1}, step ${step}`);
      }

      // Everybody stops, except one bee who is in nothing and only flies
      // about, which is all the clock the room has. Twenty minutes later
      // there is nothing left: no race still running, no count still going.
      for (const outing of room.list) {
        for (const member of outing.members) {
          if (member.sub === "ada") {
            room.leave("ada", now);
          }
        }
      }

      for (let passed = 0; passed < 20 * 60; passed += 5) {
        now += 5000;
        fly("ada", at(0, 0, 250));
        sound(room, kept, `run ${run + 1}, winding down`);
      }

      expect(
        room.list.map((outing) => `${outing.id} ${outing.kind} ${outing.phase}`),
        `run ${run + 1}: something was still on twenty minutes after everybody stopped`,
      ).toEqual([]);
      expect(room.nextDeadline, `run ${run + 1}: a deadline with nothing to end`).toBe(Infinity);
    }
  });
});

test.describe("the courses, held against the real parks", () => {
  test.afterAll(() => setActivePark("frick"));

  for (const id of ["frick", "schenley", "highland"] as ParkId[]) {
    test(`${id}: every gate is somewhere a bee can fly`, () => {
      setActivePark(id);

      const park = PARKS[id];
      const courses = COURSES[id];
      const [spawnX, , spawnZ] = startPosition();

      for (const course of [courses.sprint, courses.loop]) {
        // Somebody who has only just arrived is already at the start.
        expect(
          Math.hypot(course.start.x - spawnX, course.start.z - spawnZ),
          `${course.name} starts too far from where you arrive`,
        ).toBeLessThan(JOIN_RADIUS);

        // A lap ends where it began, so the next one can start.
        const finish = course.gates[course.gates.length - 1];

        expect([finish.x, finish.z]).toEqual([course.start.x, course.start.z]);
        expect(course.laps).toBeGreaterThanOrEqual(1);

        const round = [course.start, ...course.gates];

        for (let leg = 1; leg < round.length; leg += 1) {
          const from = round[leg - 1];
          const to = round[leg];

          // Two gates that overlap can be passed with one pose, which a racer
          // would feel as a gate that did not count.
          expect(
            Math.hypot(to.x - from.x, to.z - from.z),
            `${course.name}: ${from.name} and ${to.name} are on top of each other`,
          ).toBeGreaterThan(from.radius + to.radius + 10);
        }
      }

      const gates = [
        ...courses.sprint.gates,
        ...courses.loop.gates,
        ...courses.dash,
        courses.sprint.start,
      ];

      for (const gate of gates) {
        const where = `${id}: ${gate.name}`;

        expect(gate.x - gate.radius, where).toBeGreaterThan(park.world.minX);
        expect(gate.x + gate.radius, where).toBeLessThan(park.world.maxX);
        expect(gate.z - gate.radius, where).toBeGreaterThan(park.world.minZ);
        expect(gate.z + gate.radius, where).toBeLessThan(park.world.maxZ);

        const ground = terrainHeight(gate.x, gate.z);
        // Ten above the ground at the middle of the gate is open air, and not
        // the inside of a building or the trunk of an oak.
        const flown = resolveCollision(gate.x, ground + 10, gate.z);

        expect(flown.hit, `${where} is inside something`).toBe(false);

        if (gate.top !== undefined) {
          // Room to get under it without scraping the ground.
          expect(gate.top - ground, `${where} has no room under it`).toBeGreaterThan(12);
          expect(gate.top, where).toBeLessThan(park.ceiling);
        }
      }

      // A dash from where you arrive always has somewhere far enough to go.
      expect(
        courses.dash.filter(
          (gate) => Math.hypot(gate.x - spawnX, gate.z - spawnZ) >= DASH_MIN,
        ).length,
      ).toBeGreaterThan(0);
    });

    test(`${id}: every hiding place is in the park, with air to hide in`, () => {
      setActivePark(id);

      const park = PARKS[id];

      expect(COURSES[id].hide).toHaveLength(3);

      for (const area of COURSES[id].hide) {
        const where = `${id}: ${area.name}`;

        expect(area.x - area.radius, where).toBeGreaterThan(park.world.minX);
        expect(area.x + area.radius, where).toBeLessThan(park.world.maxX);
        expect(area.z - area.radius, where).toBeGreaterThan(park.world.minZ);
        expect(area.z + area.radius, where).toBeLessThan(park.world.maxZ);
        expect(area.top, where).toBeLessThan(park.ceiling);

        // The ceiling is over the whole of it, with room to hover: a hiding
        // place whose high ground pokes through its own roof would catch
        // anybody who hid on the hill.
        let highest = -Infinity;

        for (let east = -area.radius; east <= area.radius; east += 10) {
          for (let north = -area.radius; north <= area.radius; north += 10) {
            if (Math.hypot(east, north) <= area.radius) {
              highest = Math.max(highest, terrainHeight(area.x + east, area.z + north));
            }
          }
        }

        expect(area.top - highest, `${where} has a roof ${Math.round(area.top - highest)} over its highest ground`).toBeGreaterThan(25);
      }
    });
  }
});
