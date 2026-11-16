import type { CourseId, Gate, RaceView } from "../protocol";

/**
 * Where the races go, and where hide and seek is played.
 *
 * Plain numbers, with nothing imported from the game. The room server cannot
 * load the park modules (they are the client's, and pull the whole terrain in
 * with them), so the coordinates are written out here and a test holds them to
 * the real parks: inside the bounds, clear of anything solid, under the bridge
 * deck where a gate says so. Move a landmark and that test says which gate is
 * now inside a wall.
 *
 * A course is flown in laps because boost is unlimited: flat out, one lap of
 * any of these is under forty seconds.
 */

export type ParkId = "frick" | "schenley" | "highland";

export type Course = {
  name: string;
  laps: number;
  /** Where the racers gather. The last gate of a lap is back here. */
  start: Gate;
  /** One lap, in order. */
  gates: Gate[];
};

/**
 * One part of a park to hide in.
 *
 * `top` is a ceiling in the same units as a pose's altitude. Without one the
 * best hiding place in every round is the sky, 260 units up, where nobody can
 * be found by anyone who is looking at the park.
 */
export type HideArea = {
  name: string;
  x: number;
  z: number;
  radius: number;
  top: number;
};

export type ParkCourses = {
  sprint: Course;
  loop: Course;
  /** Where a quick dash may be sent. */
  dash: Gate[];
  hide: HideArea[];
};

function gate(name: string, x: number, z: number, radius = 16, top?: number): Gate {
  return top === undefined ? { name, x, z, radius } : { name, x, z, radius, top };
}

/* ------------------------------------------------------------------ *
 * Frick
 * ------------------------------------------------------------------ */

const FRICK_START = gate("The start", -180, 155, 18);
const FRICK_FINISH = gate("The finish", -180, 155, 18);

const F = {
  // Fourteen, not sixteen: the Environmental Center's wall is thirteen away.
  gatehouse: gate("The gatehouse", -269, 228, 14),
  pavilion: gate("The pavilion post", -136, 100),
  steps: gate("The stone steps", -91, 54),
  culvert: gate("The culvert", -60, 24),
  stones: gate("The stepping stones", 14, 44, 18),
  eastBench: gate("The east bench", 150, 120),
  swings: gate("The swings", 155, 209),
  ravineTrail: gate("The Falls Ravine trail", -128, -24),
  fernHollow: gate("Fern Hollow", -141, -217, 18),
  // Between the piers. The deck's underside is at 84.
  underBridge: gate("Under the bridge", -30, -150, 16, 78),
  northEast: gate("The north-east post", 150, -150),
  bowlingGreen: gate("The bowling green", 227, -51, 18),
  courts: gate("The courts bench", 228, 50),
};

/* ------------------------------------------------------------------ *
 * Schenley
 * ------------------------------------------------------------------ */

// Thirty west of where you arrive. The arrival point itself is under the lip of
// the Panther Hollow Bridge and five units from its abutment.
const SCHENLEY_START = gate("The start", -150, 30, 18);
const SCHENLEY_FINISH = gate("The finish", -150, 30, 18);

const S = {
  stones: gate("The stepping stones", -10, -60, 18),
  // The deck's underside is at 92.
  underBridge: gate("Under the bridge", 10, 30, 18, 86),
  trailPost: gate("The trail post", -48, 99),
  anderson: gate("The Anderson side", -40, 150),
  junction: gate("The Junction trail", -279, 174),
  west: gate("The west post", -270, 60),
  phipps: gate("The Phipps lawn", -249, -96, 18),
  northEast: gate("The north-east post", 120, -180),
  ovalNorth: gate("The oval, north end", 230, -175),
  ovalSouth: gate("The oval, south end", 230, -45),
  westinghouse: gate("The Westinghouse pond", 250, 130, 18),
  lakeBench: gate("The lake bench", 64, 140, 18),
};

/* ------------------------------------------------------------------ *
 * Highland
 * ------------------------------------------------------------------ */

const HIGHLAND_START = gate("The start", -30, 190, 18);
const HIGHLAND_FINISH = gate("The finish", -30, 190, 18);

const H = {
  eastBench: gate("The east bench", 33, 127),
  zoo: gate("The zoo side", 134, 78),
  reservoirTwo: gate("Reservoir Two", 110, -110, 20),
  northEast: gate("The north-east post", 68, -160),
  riverStones: gate("The river stones", 10, -244, 18),
  northWest: gate("The north-west post", -200, -140),
  reservoirOne: gate("Reservoir One", -150, -60, 20),
  pool: gate("The pool", -190, 120, 18),
  fountain: gate("The fountain post", -27, 52),
};

export const COURSES: Record<ParkId, ParkCourses> = {
  frick: {
    sprint: {
      name: "The creek sprint",
      laps: 2,
      start: FRICK_START,
      gates: [
        F.gatehouse,
        F.pavilion,
        F.steps,
        F.culvert,
        F.stones,
        F.eastBench,
        F.swings,
        FRICK_FINISH,
      ],
    },
    loop: {
      name: "Round the whole park",
      laps: 2,
      start: FRICK_START,
      gates: [
        F.gatehouse,
        F.ravineTrail,
        F.fernHollow,
        F.underBridge,
        F.northEast,
        F.bowlingGreen,
        F.courts,
        F.swings,
        F.eastBench,
        F.stones,
        F.culvert,
        F.steps,
        F.pavilion,
        FRICK_FINISH,
      ],
    },
    dash: [
      F.gatehouse,
      F.stones,
      // No ceiling on a dash: it is a place to get to, not a line to thread.
      gate("The Fern Hollow Bridge", -30, -150),
      F.northEast,
      F.bowlingGreen,
      F.swings,
      F.fernHollow,
    ],
    hide: [
      { name: "the Falls Ravine woods", x: -234, z: 16, radius: 70, top: 130 },
      { name: "under the Fern Hollow Bridge", x: -20, z: -170, radius: 75, top: 130 },
      { name: "the deep woods of Fern Hollow", x: -268, z: -164, radius: 70, top: 145 },
    ],
  },
  schenley: {
    sprint: {
      name: "The hollow sprint",
      laps: 2,
      start: SCHENLEY_START,
      gates: [
        S.stones,
        S.underBridge,
        S.trailPost,
        S.anderson,
        S.junction,
        S.west,
        SCHENLEY_FINISH,
      ],
    },
    loop: {
      name: "Round the whole park",
      laps: 2,
      start: SCHENLEY_START,
      gates: [
        S.phipps,
        S.stones,
        S.northEast,
        S.ovalNorth,
        S.ovalSouth,
        S.westinghouse,
        S.lakeBench,
        S.underBridge,
        S.trailPost,
        S.anderson,
        S.junction,
        S.west,
        SCHENLEY_FINISH,
      ],
    },
    dash: [
      S.phipps,
      S.stones,
      S.junction,
      S.ovalSouth,
      S.westinghouse,
      S.lakeBench,
    ],
    hide: [
      { name: "Phipps Run", x: -204, z: -94, radius: 70, top: 180 },
      { name: "the Anderson woods", x: -104, z: 166, radius: 70, top: 155 },
      { name: "Junction Hollow", x: -258, z: 166, radius: 70, top: 160 },
    ],
  },
  highland: {
    sprint: {
      name: "The reservoir sprint",
      laps: 2,
      start: HIGHLAND_START,
      gates: [
        H.eastBench,
        H.zoo,
        H.reservoirTwo,
        H.fountain,
        H.pool,
        HIGHLAND_FINISH,
      ],
    },
    loop: {
      name: "Round the whole park",
      // Three, where the others are two: it is the shortest way round.
      laps: 3,
      start: HIGHLAND_START,
      gates: [
        H.pool,
        H.reservoirOne,
        H.northWest,
        H.riverStones,
        H.northEast,
        H.reservoirTwo,
        H.zoo,
        H.eastBench,
        H.fountain,
        HIGHLAND_FINISH,
      ],
    },
    dash: [
      H.pool,
      H.reservoirOne,
      H.northWest,
      H.riverStones,
      H.reservoirTwo,
      H.zoo,
    ],
    hide: [
      { name: "the Allegheny Slope", x: -64, z: -184, radius: 70, top: 180 },
      { name: "the zoo edge", x: 156, z: 36, radius: 70, top: 160 },
      { name: "the gates and the playground", x: 56, z: 156, radius: 70, top: 145 },
    ],
  },
};

export const COURSE_IDS: readonly CourseId[] = ["sprint", "loop", "dash"];

/** What to call a course on a button. */
export function courseName(park: ParkId, course: CourseId): string {
  return course === "dash" ? "Quick dash" : COURSES[park][course].name;
}

/**
 * The gates of one lap of a race, for the room and the screen alike.
 *
 * A dash has none until it begins, because where it goes is not chosen until
 * everybody who is coming has come.
 */
export function raceGates(
  park: ParkId,
  race: Pick<RaceView, "course" | "target">,
): Gate[] {
  if (race.course === "dash") {
    return race.target ? [race.target] : [];
  }

  return COURSES[park][race.course].gates;
}
