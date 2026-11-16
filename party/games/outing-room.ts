import type { OutingView, Pose } from "../protocol";
import { COURSE_IDS, type ParkId } from "./courses";
import {
  GATHER_MS,
  beginOuting,
  blindPairs,
  inOuting,
  joinOuting,
  leaveOuting,
  openHide,
  openRace,
  outingIsStale,
  outingPose,
  outingTick,
  outingView,
  readyOuting,
  sameView,
  type Outing,
  type PoseOf,
} from "./outings";

/**
 * Every round out in the park, for one room.
 *
 * A list, as the tables are, so that one bee flying a course alone does not
 * take the park's only race away from the other nine.
 *
 * This is the part of the room that knows about outings, kept out of the room
 * itself so that file stays what it was: a socket handler that hands things to
 * rules. Every method answers one question, "is there anything to tell the
 * room?", and the room publishes when the answer is yes.
 */
export class OutingRoom {
  list: Outing[] = [];

  /**
   * The next moment something happens with nobody doing anything: a countdown
   * ending, a round being called, a finished one being cleared away. The room
   * compares the time of every pose against it, which is the whole of the clock.
   */
  nextDeadline = Infinity;

  private nextId = 1;
  private blind = new Map<string, Set<string>>();
  private revealed: [string, string][] = [];

  constructor(private readonly finishedFor: number) {}

  /** In a round that is still going. One thing each, as with tables. */
  has(sub: string): boolean {
    return this.list.some((outing) => inOuting(outing, sub));
  }

  /** Who must not be sent this bee's poses right now, if anybody. */
  blindTo(subject: string): ReadonlySet<string> | undefined {
    return this.blind.get(subject);
  }

  views(): OutingView[] {
    return this.list.map(outingView);
  }

  /**
   * Who has just become visible to whom, as [the bee, who may now see it],
   * handed over once.
   *
   * When a count ends the room starts relaying a hider's poses to the seeker
   * again, and that is not enough. The seeker's screen threw the hider's last
   * pose away when the count began, so it draws nothing until the next one
   * arrives, and a hider who hid and then looked at another tab never sends a
   * next one: not drawn, "cold" everywhere, and unfindable for four minutes by
   * anybody who is not already on top of them. So the room says where they
   * are, once, as the count ends.
   */
  takeRevealed(): [string, string][] {
    const pairs = this.revealed;

    this.revealed = [];

    return pairs;
  }

  /**
   * An `outing` message, of any shape at all.
   *
   * Typed as unknown because that is what it is. Anything that is not exactly
   * one of the five verbs with the fields it needs falls out of the bottom and
   * changes nothing, which is the same thing that happens to a legal request
   * the rules refuse.
   */
  handle(
    park: ParkId,
    sub: string,
    name: string,
    message: unknown,
    now: number,
    poseOf: PoseOf,
    pick?: () => number,
  ): boolean {
    if (!message || typeof message !== "object") {
      return false;
    }

    const asked = message as Record<string, unknown>;

    if (asked.do === "open") {
      if (this.has(sub)) {
        return false;
      }

      const id = `o${this.nextId++}`;
      let opened: Outing | null = null;

      if (
        asked.kind === "race" &&
        typeof asked.course === "string" &&
        (COURSE_IDS as readonly string[]).includes(asked.course)
      ) {
        opened = openRace(
          id,
          park,
          asked.course as (typeof COURSE_IDS)[number],
          sub,
          name,
          poseOf(sub),
          now,
        );
      } else if (
        asked.kind === "hide" &&
        (asked.seeker === "me" || asked.seeker === "anyone")
      ) {
        opened = openHide(id, park, sub, name, asked.seeker === "me", now);
      }

      if (!opened) {
        return false;
      }

      this.list = [...this.list, opened];
      this.settle(now);

      return true;
    }

    const id = asked.id;

    if (typeof id !== "string") {
      return false;
    }

    switch (asked.do) {
      case "join":
        // One thing each. Somebody racing is not also hiding.
        return this.has(sub)
          ? false
          : this.change(now, id, (outing) =>
              joinOuting(outing, sub, name, poseOf(sub), now),
            );

      case "begin":
        return this.change(now, id, (outing) =>
          beginOuting(outing, sub, now, poseOf, pick),
        );

      case "ready":
        return this.change(now, id, (outing) =>
          readyOuting(outing, sub, now, poseOf),
        );

      case "leave":
        return this.change(now, id, (outing) => leaveOuting(outing, sub, now));

      default:
        return false;
    }
  }

  onPose(
    sub: string,
    prev: Pose | null,
    prevAt: number,
    pose: Pose,
    now: number,
    poseOf: PoseOf,
  ): boolean {
    if (this.list.length === 0) {
      return false;
    }

    return this.change(now, null, (outing) =>
      outingPose(outing, sub, prev, prevAt, pose, now, poseOf),
    );
  }

  tick(now: number, poseOf: PoseOf): boolean {
    return this.change(now, null, (outing) => outingTick(outing, now, poseOf));
  }

  /** The socket closed. Out of everything, finished rounds included. */
  leave(sub: string, now: number): boolean {
    return this.change(now, null, (outing) => leaveOuting(outing, sub, now));
  }

  /** The room woke with nothing in memory. See `Garden.ensureSeats`. */
  clear() {
    this.list = [];
    this.settle(0);
    this.revealed = [];
  }

  /**
   * Run a change over one round, or over all of them, and say whether the room
   * has anything new to hear.
   *
   * Two different questions are answered here. Whether a round CHANGED is by
   * identity, as with tables. Whether the room should be TOLD is narrower:
   * noting where a hider settled changes the round and must not be broadcast,
   * least of all to the seeker.
   */
  private change(
    now: number,
    id: string | null,
    change: (outing: Outing) => Outing,
  ): boolean {
    let tell = false;
    let touched = false;

    const next = this.list.map((outing) => {
      if (id !== null && outing.id !== id) {
        return outing;
      }

      const after = change(outing);

      if (after !== outing) {
        touched = true;
        tell ||= !sameView(outing, after);
      }

      return after;
    });

    if (touched) {
      this.list = next;
    }

    return this.settle(now) || tell;
  }

  /** Drop what is over, and work out what happens next and who is blind. */
  private settle(now: number): boolean {
    const kept = this.list.filter(
      (outing) => !outingIsStale(outing, now, this.finishedFor),
    );
    const swept = kept.length !== this.list.length;

    if (swept) {
      this.list = kept;
    }

    const was = this.blind;

    this.nextDeadline = Infinity;
    this.blind = new Map();

    for (const outing of this.list) {
      // A finished round and one nobody ever started have no deadline of
      // their own. They are due when they are due to be cleared away.
      const due =
        outing.phase === "done"
          ? outing.since + this.finishedFor + 1
          : outing.phase === "gathering"
            ? outing.since + GATHER_MS + 1
            : outing.deadline;

      if (due > 0 && due < this.nextDeadline) {
        this.nextDeadline = due;
      }

      for (const [subject, recipient] of blindPairs(outing)) {
        const set = this.blind.get(subject) ?? new Set<string>();

        set.add(recipient);
        this.blind.set(subject, set);
      }
    }

    for (const [subject, recipients] of was) {
      for (const recipient of recipients) {
        if (!this.blind.get(subject)?.has(recipient)) {
          this.revealed.push([subject, recipient]);
        }
      }
    }

    return swept;
  }
}
