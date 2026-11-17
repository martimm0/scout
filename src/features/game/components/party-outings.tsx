"use client";

import { useEffect, useRef, useState } from "react";

import {
  COURSES,
  courseName,
  raceGates,
  type ParkId,
} from "@party/games/courses";
import { RACE_CAP_MS, raceStandings } from "@party/games/outings";
import { PARTY_CAP, type CourseId, type OutingView } from "@party/protocol";

import { buzz } from "../audio/haptics";
import { playSound } from "../audio/sound";
import {
  beginOuting,
  joinOuting,
  leaveOuting,
  openHide,
  openRace,
  readyOuting,
} from "../state/party-client";
import { usePartyStore, type OutingSense } from "../state/party-store";
import styles from "./party-games.module.css";

/**
 * Races and hide and seek: the part of them that is on the panel.
 *
 * The round itself is out in the park, in the columns and the ring that
 * `OutingMarks` draws and in the holds the frame loop puts on your bee. This
 * is the card that says what is going on, and the buttons that ask the room
 * for things.
 *
 * Like the boards, it asks and draws and decides nothing. Who passed a gate,
 * who finished, who was found: the room works those out from where everybody
 * says they are, and this shows what the room said.
 *
 * And like the boards, nothing here is worth anything. A round has a clock and
 * a finishing order, which is new for a garden party, and it has nothing else:
 * no time is kept, nobody is ranked, and the result is gone a minute after you
 * read it.
 */

const WAYS: Record<NonNullable<OutingSense["cue"]>["way"], string> = {
  ahead: "ahead",
  left: "to your left",
  right: "to your right",
  behind: "behind you",
};

const RACES: { course: CourseId; note: (park: ParkId) => string }[] = [
  {
    course: "sprint",
    note: (park) =>
      `${COURSES[park].sprint.laps} laps, ${COURSES[park].sprint.gates.length} gates a lap.`,
  },
  {
    course: "loop",
    note: (park) =>
      `${COURSES[park].loop.laps} laps, ${COURSES[park].loop.gates.length} gates a lap.`,
  },
  { course: "dash", note: () => "First to a landmark the room picks." },
];

function names(outing: OutingView, subs: string[]) {
  return subs
    .map(
      (sub) =>
        outing.members.find((member) => member.sub === sub)?.name ?? "A bee",
    )
    .join(", ");
}

/** 41230 -> "41.2 s". Tenths, which is as fine as the room can honestly tell. */
function seconds(ms: number) {
  return `${(ms / 1000).toFixed(1)} s`;
}

/** 192000 -> "3:12". */
function clock(ms: number) {
  const whole = Math.max(0, Math.ceil(ms / 1000));

  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, "0")}`;
}

function title(outing: OutingView, park: ParkId) {
  return outing.race
    ? `Race: ${courseName(park, outing.race.course)}`
    : "Hide and seek";
}

/**
 * The room's clock, a few times a second, while something is counting.
 *
 * State set from an interval, and not `Date.now()` read in render: a render
 * that reads a clock gives a different answer every time it is called.
 */
function useRoomNow(running: boolean) {
  const skew = usePartyStore((state) => state.clockSkew);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!running) {
      return;
    }

    const timer = setInterval(() => setNow(Date.now()), 200);

    return () => clearInterval(timer);
  }, [running]);

  return now + skew;
}

/* ------------------------------------------------------------------ *
 * In the lobby
 * ------------------------------------------------------------------ */

/** Rounds to join and rounds to start, inside the Games panel. */
export function OutingOffers({ park }: { park: ParkId }) {
  const outings = usePartyStore((state) => state.outings);
  const atStart = usePartyStore((state) => state.sense.atStart);
  const open = outings.filter((outing) => outing.phase !== "done");

  return (
    <>
      <p className={styles.groupLabel}>Out in the park</p>

      {open.length > 0 ? (
        <ul className={styles.tables}>
          {open.map((outing) => {
            const gathering = outing.phase === "gathering";
            // The room lets you into a race only from its start, so the button
            // says so, using the same distance the room does.
            const reachable = !outing.race || atStart.includes(outing.id);

            return (
              <li className={styles.table} key={outing.id}>
                <span className={styles.tableName}>{title(outing, park)}</span>
                <span className={styles.tableWho}>
                  {outing.members.map((member) => member.name).join(", ")}
                  {gathering
                    ? reachable
                      ? ""
                      : " · fly to the green column to join"
                    : " · under way"}
                </span>
                {gathering && outing.members.length < PARTY_CAP ? (
                  <button
                    className={styles.sit}
                    disabled={!reachable}
                    onClick={() => joinOuting(outing.id)}
                    type="button"
                  >
                    Join
                  </button>
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : null}

      <ul className={styles.kinds}>
        {RACES.map(({ course, note }) => (
          <li key={course}>
            <button
              className={styles.start}
              onClick={() => openRace(course)}
              type="button"
            >
              <span className={styles.startName}>
                {course === "dash" ? "Quick dash" : `Race: ${courseName(park, course)}`}
              </span>
              <span className={styles.startNote}>{note(park)}</span>
            </button>
          </li>
        ))}
        <li>
          <button
            className={styles.start}
            onClick={() => openHide("me")}
            type="button"
          >
            <span className={styles.startName}>Hide and seek: I will seek</span>
            <span className={styles.startNote}>
              The others hide in one corner of the park. Two or more.
            </span>
          </button>
        </li>
        <li>
          <button
            className={styles.start}
            onClick={() => openHide("anyone")}
            type="button"
          >
            <span className={styles.startName}>
              Hide and seek: pick a seeker
            </span>
            <span className={styles.startNote}>
              The room chooses who looks. Two or more.
            </span>
          </button>
        </li>
      </ul>
    </>
  );
}

/* ------------------------------------------------------------------ *
 * In a round
 * ------------------------------------------------------------------ */

/** The round you are in. It takes the panel over, as a board does. */
export function OutingCard({
  outing,
  park,
  you,
}: {
  outing: OutingView;
  park: ParkId;
  you: string;
}) {
  const sense = usePartyStore((state) => state.sense);
  const counting =
    outing.phase === "countdown" ||
    outing.phase === "running" ||
    outing.phase === "hiding" ||
    outing.phase === "seeking";
  const now = useRoomNow(counting);
  /**
   * Never more than the phase is long.
   *
   * The clock above only starts ticking once something is counting, so the
   * first render of a countdown still has the time from whenever the card was
   * opened. Somebody who waited forty seconds for a friend and pressed Start
   * was shown 45, and then 5, with a tick for each.
   */
  const left =
    outing.deadline > 0
      ? Math.min(outing.deadline - outing.since, outing.deadline - now)
      : 0;
  const host = outing.members[0]?.sub === you;
  // Home in a race the others are still flying. Going now keeps your time in
  // it, so the button says what it does.
  const home = outing.race?.progress[you]?.finishedIn != null;

  const hide = outing.hide;
  const seeker = hide?.seekers.includes(you) ?? false;
  const hider = hide?.hiders.includes(you) ?? false;
  const veiled = outing.phase === "hiding" && seeker;

  const said = announce(outing, you);

  useOutingSounds(outing, you, Math.ceil(left / 1000));

  return (
    <>
      {veiled ? (
        // Over the park while the seeker counts. The hiders are not drawn and
        // not even sent, so this hides nothing that matters: it is there so
        // the wait reads as a wait.
        <div aria-hidden className={styles.veil}>
          <span className={styles.veilCount}>{Math.max(0, Math.ceil(left / 1000))}</span>
          <span className={styles.veilNote}>Counting. No peeking.</span>
        </div>
      ) : null}

      <section aria-label={title(outing, park)} className={styles.board}>
        <header className={styles.boardHead}>
          <span className={styles.boardName}>{title(outing, park)}</span>
          <button
            className={styles.stand}
            onClick={() => leaveOuting(outing.id)}
            type="button"
          >
            {outing.phase === "done" || home ? "Done" : "Leave"}
          </button>
        </header>

        {/* Said once, to anybody listening and not looking. The text only
            changes when something has happened, which is when it is read. */}
        <p aria-live="polite" className={styles.srOnly}>
          {said}
        </p>

        {outing.race ? (
          <Race
            host={host}
            left={left}
            now={now}
            outing={outing}
            park={park}
            sense={sense}
            you={you}
          />
        ) : null}

        {hide ? (
          <Hide
            hider={hider}
            host={host}
            left={left}
            outing={outing}
            park={park}
            seeker={seeker}
            sense={sense}
            you={you}
          />
        ) : null}
      </section>
    </>
  );
}

function Race({
  host,
  left,
  now,
  outing,
  park,
  sense,
  you,
}: {
  host: boolean;
  left: number;
  now: number;
  outing: OutingView;
  park: ParkId;
  sense: OutingSense;
  you: string;
}) {
  const race = outing.race!;
  const lap = raceGates(park, race);
  const total = lap.length * race.laps;
  const mine = race.progress[you];
  const cue = sense.cue ? `${sense.cue.distance} ${WAYS[sense.cue.way]}` : null;

  if (outing.phase === "gathering") {
    // Who is at the start and who has drifted off, by the rule the room will
    // use when it begins: anybody not there is left behind. Said to both, so
    // the host does not start a race for two and fly it alone, and the one who
    // wandered is not dropped out of it without ever being told.
    const here = sense.atStart.includes(outing.id);
    const there = outing.members.filter((member) => !sense.away.includes(member.sub));
    const away = outing.members.filter((member) => sense.away.includes(member.sub));
    const others = away.filter((member) => member.sub !== you);
    const list = (members: OutingView["members"]) =>
      members.map((member) => member.name).join(", ");

    return (
      <>
        <p className={styles.status}>
          {there.length > 0
            ? `At the start: ${list(there)}.`
            : "Nobody is at the start yet."}
          {away.length > 0 ? ` On the way: ${list(away)}.` : ""}
          {race.course === "dash"
            ? " A dash to a landmark the room will pick."
            : ` ${race.laps} laps.`}
        </p>
        {host ? (
          <>
            <button
              className={styles.begin}
              disabled={!here}
              onClick={() => beginOuting(outing.id)}
              type="button"
            >
              Start the race
            </button>
            {here ? null : (
              <p className={styles.quiet}>
                Fly to the green column to start it{cue ? `: ${cue}` : ""}.
              </p>
            )}
            {here && others.length > 0 ? (
              <p className={styles.quiet} data-outing="without">
                Started now, it goes without {list(others)}.
              </p>
            ) : null}
          </>
        ) : !sense.away.includes(you) ? (
          <p className={styles.quiet}>
            Waiting for {outing.members[0]?.name ?? "the host"} to start it.
          </p>
        ) : (
          <p className={styles.quiet} data-outing="away">
            You have left the start{cue ? `: ${cue}` : ""}. Be at the green
            column when {outing.members[0]?.name ?? "the host"} starts it, or it
            goes without you.
          </p>
        )}
      </>
    );
  }

  if (outing.phase === "countdown") {
    return (
      <>
        <p className={styles.count} role="timer">
          {Math.max(1, Math.ceil(left / 1000))}
        </p>
        <p className={styles.status}>
          Held at the start. First gate:{" "}
          {lap[0]?.name ?? "somewhere the room has picked"}
          {cue ? `, ${cue}` : ""}.
        </p>
      </>
    );
  }

  const standings = raceStandings(race, outing.members);

  if (outing.phase === "done") {
    return (
      <>
        <p className={styles.status}>
          {outing.ended === "time"
            ? "Time was called."
            : mine?.finishedIn != null
              ? `You are home in ${seconds(mine.finishedIn)}.`
              : "That is everybody."}
        </p>
        <Places standings={standings} total={total} you={you} />
      </>
    );
  }

  // Under way.
  const passed = Math.max(sense.gates, mine?.gates ?? 0);
  const home = mine?.finishedIn ?? null;

  return (
    <>
      {home !== null ? (
        <p className={styles.status}>
          You are home in {seconds(home)}. Waiting for the others.
        </p>
      ) : mine && passed >= total ? (
        // Over the line by this screen's reckoning, and the room has not said
        // so yet. Counting on from here read as lap two, gate one, again.
        <p className={styles.status}>You are home.</p>
      ) : mine ? (
        <p className={styles.status}>
          <span data-outing="progress">
            {race.laps > 1
              ? `Lap ${Math.min(race.laps, Math.floor(passed / lap.length) + 1)} of ${race.laps}, `
              : ""}
            gate {Math.min(lap.length, (passed % lap.length) + 1)} of {lap.length}
          </span>
          . Next: {lap[passed % lap.length]?.name}
          {cue ? `, ${cue}` : ""}.
        </p>
      ) : (
        <p className={styles.status}>You are watching this one.</p>
      )}
      <p className={styles.clock} role="timer">
        {seconds(Math.min(Math.max(0, now - race.startedAt), RACE_CAP_MS))}
      </p>
      <Places standings={standings} total={total} you={you} />
    </>
  );
}

function Places({
  standings,
  total,
  you,
}: {
  standings: ReturnType<typeof raceStandings>;
  total: number;
  you: string;
}) {
  return (
    <ol className={styles.scores}>
      {standings.map((row) => (
        <li data-you={row.sub === you} key={row.sub}>
          <span>
            {row.finishedIn !== null ? `${row.place}. ` : ""}
            {row.name}
          </span>
          <span>
            {row.finishedIn !== null
              ? seconds(row.finishedIn)
              : `${row.gates} of ${total} gates`}
          </span>
        </li>
      ))}
    </ol>
  );
}

function Hide({
  hider,
  host,
  left,
  outing,
  park,
  seeker,
  sense,
  you,
}: {
  hider: boolean;
  host: boolean;
  left: number;
  outing: OutingView;
  park: ParkId;
  seeker: boolean;
  sense: OutingSense;
  you: string;
}) {
  const hide = outing.hide!;
  const area = hide.area >= 0 ? COURSES[park].hide[hide.area] : null;
  const cue = sense.cue ? `${sense.cue.distance} ${WAYS[sense.cue.way]}` : null;

  if (outing.phase === "gathering") {
    return (
      <>
        <p className={styles.status}>
          In it: {outing.members.map((member) => member.name).join(", ")}.{" "}
          {hide.hostSeeks
            ? `${outing.members[0]?.name ?? "The host"} will seek.`
            : "The room will pick who seeks."}
        </p>
        {host ? (
          <>
            <button
              className={styles.begin}
              disabled={outing.members.length < 2}
              onClick={() => beginOuting(outing.id)}
              type="button"
            >
              Start hiding
            </button>
            {outing.members.length < 2 ? (
              <p className={styles.quiet}>It takes two. Waiting for somebody to join.</p>
            ) : null}
          </>
        ) : (
          <p className={styles.quiet}>
            Waiting for {outing.members[0]?.name ?? "the host"} to start it.
          </p>
        )}
      </>
    );
  }

  if (outing.phase === "hiding") {
    if (seeker) {
      return (
        <p className={styles.status}>
          Counting: <span role="timer">{clock(left)}</span>. They are hiding in{" "}
          {area?.name}, inside the pink ring.
        </p>
      );
    }

    if (!hider) {
      return <p className={styles.status}>You are watching this one.</p>;
    }

    const ready = hide.ready.includes(you);

    return (
      <>
        <p className={styles.status}>
          {ready ? "Hidden. Stay put. " : `Hide in ${area?.name}, inside the pink ring. `}
          <span role="timer">{clock(left)}</span> left.
        </p>
        {sense.high ? (
          <p className={styles.quiet} data-outing="above">
            You are over it and too high. Come down among the trees: up here
            when the count ends is caught.
          </p>
        ) : sense.inArea === false ? (
          <p className={styles.quiet} data-outing="outside">
            You are outside it{cue ? `: ${cue}` : ""}. Outside when the count
            ends is caught.
          </p>
        ) : null}
        {ready ? null : (
          <button
            className={styles.begin}
            disabled={sense.inArea !== true}
            onClick={() => readyOuting(outing.id)}
            type="button"
          >
            I am hidden
          </button>
        )}
      </>
    );
  }

  const found = (
    <ol className={styles.scores}>
      {hide.found.map((entry) => (
        <li data-you={entry.sub === you} key={entry.sub}>
          <span>{entry.name}</span>
          <span>
            {entry.why === "found"
              ? `found by ${entry.byName ?? names(outing, entry.by ? [entry.by] : [])}, ${clock(entry.at)}`
              : entry.why === "moved"
                ? "moved, and was seen"
                : "was not in the hiding place"}
          </span>
        </li>
      ))}
    </ol>
  );

  if (outing.phase === "seeking") {
    return (
      <>
        {seeker ? (
          <p className={styles.status}>
            {hide.hiders.length} still hidden in {area?.name}.{" "}
            <span role="timer">{clock(left)}</span> left.
          </p>
        ) : hider ? (
          <p className={styles.status}>
            Hidden. You cannot move until you are found, or{" "}
            <span role="timer">{clock(left)}</span> is up. Looking for you:{" "}
            {names(outing, hide.seekers)}.
          </p>
        ) : (
          <p className={styles.status}>You are watching this one.</p>
        )}
        {seeker && sense.warmth ? (
          <p className={styles.warmth} data-warmth={sense.warmth}>
            {sense.warmth}
          </p>
        ) : null}
        {found}
      </>
    );
  }

  // Over.
  const last = hide.found[hide.found.length - 1];

  return (
    <>
      <p className={styles.status}>
        {outing.ended === "left"
          ? "Somebody left, so that is that."
          : hide.hiders.length > 0
            ? `Time. Never found: ${names(outing, hide.hiders)}.`
            : last?.why === "found"
              ? `Everybody found. ${last.name} stayed hidden longest.`
              : // Nobody was found by being looked for: they were outside the
                // ring, or they moved. Nobody stayed hidden longest.
                "That is everybody."}
      </p>
      {found}
    </>
  );
}

/* ------------------------------------------------------------------ *
 * Saying what happened
 * ------------------------------------------------------------------ */

/** The latest thing worth saying aloud about a round, or nothing. */
function announce(outing: OutingView, you: string): string {
  const hide = outing.hide;

  switch (outing.phase) {
    case "countdown":
      return "The race is about to start. Hold still.";
    case "running":
      return outing.race?.progress[you]?.finishedIn != null
        ? "You are home."
        : "Go.";
    case "hiding":
      return hide?.seekers.includes(you)
        ? "You are the seeker. Counting."
        : "Go and hide.";
    case "seeking": {
      const last = hide?.found[hide.found.length - 1];

      if (!last) {
        return hide?.seekers.includes(you) ? "Go and find them." : "The seeker is looking.";
      }

      return last.sub === you
        ? "You have been found. Now you are seeking too."
        : `${last.name} has been found.`;
    }
    case "done":
      return "The round is over.";
    default:
      return "";
  }
}

/**
 * The sounds of a round that come from the room having said something.
 *
 * Gates chime from the frame loop, which knows a gate was passed before the
 * room has answered. These are the ones only the room knows: the count, the
 * start, being found.
 */
function useOutingSounds(outing: OutingView, you: string, secondsLeft: number) {
  // From what is already true, so a card that is drawn again halfway through
  // a round does not announce the last find a second time.
  const before = useRef({
    phase: outing.phase,
    found: outing.hide?.found.length ?? 0,
    tick: 0,
    id: outing.id,
  });

  useEffect(() => {
    const was = before.current;
    const found = outing.hide?.found.length ?? 0;
    const sameRound = was.id === outing.id;

    if (outing.phase === "countdown" && secondsLeft !== was.tick && secondsLeft > 0) {
      playSound("tick");
    }

    if (sameRound && was.phase !== outing.phase) {
      if (outing.phase === "running" || outing.phase === "seeking") {
        playSound("takeoff");
        buzz("success");
      }
    }

    if (sameRound && found > was.found) {
      const last = outing.hide?.found[found - 1];

      // Found somebody, or been found.
      playSound(last?.sub === you ? "miss" : "discover");
      buzz(last?.sub === you ? "fail" : "match");
    }

    before.current = { phase: outing.phase, found, tick: secondsLeft, id: outing.id };
  }, [outing, secondsLeft, you]);
}
