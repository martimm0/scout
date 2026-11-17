/**
 * The wire protocol for a garden party.
 *
 * One file, imported by both sides. The server relays and referees; it never
 * persists. Nothing in this protocol is ever written to storage, which is a
 * privacy rule (chat that vanishes has actually vanished) and a free-tier rule
 * (a Durable Object that never touches storage costs nothing to keep).
 */

export const GARDEN_PARTIES = [
  "garden-frick",
  "garden-schenley",
  "garden-highland",
] as const;

export type GardenPartyId = (typeof GARDEN_PARTIES)[number];

export const PARTY_CAP = 10;

/** How long a chat message lives on screen, in milliseconds. */
export const CHAT_TTL_MS = 60_000;

/** A player as the room describes them to each other. */
export type PartyPlayer = {
  /** The account's stable id. One seat per account, however many tabs. */
  sub: string;
  /** The pollinator's name and type, which is the identity that flies. */
  name: string;
  pollinator: string;
};

export type Pose = {
  x: number;
  z: number;
  altitude: number;
  heading: number;
  /** "none" | "greet" | "dance" | "celebrate", mirrored so others see it. */
  gesture: string;
};

/* ------------------------------------------------------------------ *
 * Tables
 * ------------------------------------------------------------------ */

export type GameKind = "tictactoe" | "connect4" | "othello" | "quips";

export const GAME_SEATS: Record<GameKind, { min: number; max: number }> = {
  tictactoe: { min: 2, max: 2 },
  connect4: { min: 2, max: 2 },
  othello: { min: 2, max: 2 },
  quips: { min: 3, max: 10 },
};

export const GAME_NAMES: Record<GameKind, string> = {
  tictactoe: "Seed and Sprout",
  connect4: "Trellis Four",
  othello: "Leaf Turn",
  quips: "Field Notes",
};

/**
 * A game in progress, as everybody in the room sees it.
 *
 * The state is whatever the rules module for `kind` says it is, and it is only
 * ever produced by the server: a client renders what it is told and asks for
 * moves. `turn` is a seat index, and is meaningless for quips, which has phases
 * instead of turns.
 */
export type TableView = {
  id: string;
  kind: GameKind;
  /** Accounts at this table, in seat order. Seat 0 opened it and moves first. */
  seats: string[];
  /** Display names, parallel to `seats`, so a board needs no second lookup. */
  names: string[];
  turn: number;
  state: unknown;
  /** Set when the game is over. Who won is in the state, not here. */
  finished: boolean;
  /** Why it ended, when it ended for a reason the rules do not cover. */
  ended?: "left";
  /** Who has left a finished game. Still in `seats`, so the result reads. */
  done?: string[];
};

/* ------------------------------------------------------------------ *
 * Out in the park
 * ------------------------------------------------------------------ */

/**
 * A round played by flying: a race through gates, or hide and seek.
 *
 * Called an outing so it is never confused with a table. A table is played on
 * a board in a panel; an outing is played in the park, and the room referees
 * it from the poses it was already relaying.
 */
export type OutingKind = "race" | "hide";

/** The two authored courses in each park, and the one made up on the spot. */
export type CourseId = "sprint" | "loop" | "dash";

export type OutingPhase =
  | "gathering"
  /** Race: everybody held at the start, five seconds. */
  | "countdown"
  | "running"
  /** Hide and seek: the seeker counts, the others hide. */
  | "hiding"
  | "seeking"
  | "done";

/**
 * A column of light to fly through.
 *
 * A column and not a hoop: it is passed at any height, so a butterfly on a
 * phone and a hoverfly on a mouse are asked for the same thing. `top` is the
 * exception, for the two gates under a bridge, which only count below the deck.
 */
export type Gate = {
  name: string;
  x: number;
  z: number;
  radius: number;
  top?: number;
};

export type RaceView = {
  course: CourseId;
  laps: number;
  /** Where the round gathers. Joining means being here. */
  start: Gate;
  /** A dash's one gate, chosen when it begins. Courses keep theirs in data. */
  target?: Gate;
  /** Server time the hold was released, or 0 before it. */
  startedAt: number;
  /**
   * Gates passed, counted across laps, and the time once all of them are.
   * A racer who leaves before they are home is taken out of it. One who is
   * home keeps their time here, and is noted in the round's `done`.
   */
  progress: Record<string, { gates: number; finishedIn: number | null }>;
};

export type HideView = {
  /** The host asked to be the seeker. Otherwise the room draws one. */
  hostSeeks: boolean;
  /** Which of the park's hiding places this round is in. -1 until it begins. */
  area: number;
  seekers: string[];
  /** Those not yet found. */
  hiders: string[];
  /** Hiders who have said they are hidden; all of them ends the count early. */
  ready: string[];
  /**
   * Everybody found so far, in the order it happened. Carries the name, so the
   * result still reads after somebody has gone home.
   */
  found: {
    sub: string;
    name: string;
    /** Who found them, or null when they gave themselves away. */
    by: string | null;
    /**
     * And what they are called, for the same reason `name` is here: the finder
     * may have gone home. Optional because the room and the screens are put
     * out separately, and a screen may be talking to a room from before this.
     */
    byName?: string | null;
    /** Milliseconds into the seeking. */
    at: number;
    why: "found" | "moved" | "outside";
  }[];
};

/**
 * A round in progress, as everybody in the room sees it.
 *
 * It never says where a hider is. The room knows, because it referees from
 * their poses, but the view is sent to seekers too.
 */
export type OutingView = {
  id: string;
  kind: OutingKind;
  phase: OutingPhase;
  /** In arrival order. The first is the host, who may begin it. */
  members: { sub: string; name: string }[];
  /** Server time this phase began. */
  since: number;
  /** Server time this phase runs out, or 0 for no clock. */
  deadline: number;
  /**
   * Who has pressed Done on a finished round, or is home in a race that is
   * still going and has put the card away. Still in `members`.
   */
  done: string[];
  /** Why it ended, when it was not by everybody finishing or being found. */
  ended?: "time" | "left";
  race?: RaceView;
  hide?: HideView;
};

/* ------------------------------------------------------------------ *
 * Working a flower together
 * ------------------------------------------------------------------ */

/**
 * One flower, being worked by one or more bees.
 *
 * Keyed by the scatter INSTANCE rather than the species: two players on two
 * different black-eyed susans forty units apart are doing two different things,
 * and joining them would be baffling.
 *
 * `finds` are opaque tokens the game decides the meaning of, a matched floret,
 * a word made. The room does not know what they mean and does not need to; it
 * keeps the set and tells everybody, which is the whole of co-operation here.
 */
export type CoopView = {
  instance: string;
  plant: string;
  /** Accounts on this flower, with names, in arrival order. */
  members: { sub: string; name: string }[];
  finds: string[];
  /**
   * The one roll for this flower, drawn when the session opens.
   *
   * ONE, not one each. Everybody who worked it feeds the same shared score and
   * this same roll through the same resolver, so two people who did the same
   * work on the same flower are told the same thing about it. Rolling per player
   * would also quietly change the failure rate the whole game is built on:
   * "at least one of us managed it" is a different number from "one visit in
   * five comes to nothing".
   */
  roll: number;
};

/** Client to server. */
export type ClientMessage =
  | { t: "pos"; pose: Pose }
  | { t: "chat"; text: string }
  /** WebRTC signaling, relayed verbatim to one peer. The server reads none of it. */
  | { t: "rtc"; to: string; payload: unknown }
  | { t: "open"; kind: GameKind }
  | { t: "sit"; table: string }
  | { t: "leaveTable"; table: string }
  /**
   * A move, whose shape depends on the game. The server hands it to the rules
   * module and ignores anything that comes back null, so a malformed move is
   * indistinguishable from an illegal one and neither can corrupt a board.
   */
  | { t: "move"; table: string; move: unknown }
  /** Start a Field Notes round that has enough writers. Seat 0 only. */
  | { t: "begin"; table: string }
  /** Working a flower. `instance` is the scatter key, not the species. */
  | { t: "workOn"; instance: string; plant: string }
  /** A floret matched or a word made, shared with everybody on the same plant. */
  | { t: "found"; instance: string; token: string }
  | { t: "stopWorking"; instance: string }
  /**
   * A waggle dance: where the good forage is.
   *
   * Relayed to the room and stored nowhere, like chat. A dance is a thing that
   * happened in a room you were both in, and the room keeps nothing on purpose.
   * The position is the DANCER's word for it and the server does not check it;
   * the worst a liar can do is send somebody to an empty patch of grass, which
   * is also the worst a mistaken bee can do.
   */
  | { t: "mark"; species: string; commonName: string; x: number; z: number }
  /**
   * A round out in the park. One message with a verb, because the room hands
   * the whole thing to the outings module, as it hands a move to a table.
   *
   * There is no message for passing a gate or finding somebody. The room works
   * those out from `pos`, so every player is refereed from the same stream and
   * nobody's client is the one that decides.
   */
  | { t: "outing"; do: "open"; kind: "race"; course: CourseId }
  | { t: "outing"; do: "open"; kind: "hide"; seeker: "me" | "anyone" }
  | { t: "outing"; do: "join" | "begin" | "ready" | "leave"; id: string };

/** Server to client. */
export type ServerMessage =
  | {
      t: "welcome";
      you: PartyPlayer;
      players: (PartyPlayer & { pose: Pose | null })[];
    }
  | { t: "join"; player: PartyPlayer }
  | { t: "leave"; sub: string }
  | { t: "pos"; sub: string; pose: Pose }
  | { t: "chat"; sub: string; name: string; text: string }
  /** Somebody danced. Carries who, so the mark can say whose it is. */
  | {
      t: "mark";
      sub: string;
      name: string;
      species: string;
      commonName: string;
      x: number;
      z: number;
    }
  | { t: "rtc"; from: string; payload: unknown }
  /**
   * Every table in the room, every time any of them changes.
   *
   * The whole list rather than a diff. There are at most a handful of tables and
   * a board is a few hundred bytes, so a diff protocol would be a second thing
   * to keep correct in exchange for bandwidth nobody is short of, and a client
   * that missed one diff would be wrong until it reloaded.
   */
  | { t: "tables"; tables: TableView[] }
  /**
   * The flower you are working, and everybody else working it with you.
   *
   * Sent to the people on that plant and nobody else: a shared board is a small
   * private thing between the bees standing on one stalk, not news for the room.
   */
  | { t: "coop"; session: CoopView }
  /**
   * Every round out in the park, whenever any of them changes. The whole list,
   * for the reason `tables` is.
   *
   * `now` is the room's clock when it was sent. Deadlines are in server time,
   * and a countdown drawn from a phone whose clock is a minute out would
   * otherwise start at 65.
   */
  | { t: "outings"; outings: OutingView[]; now: number }
  /**
   * The room will not have this socket, and says why before closing.
   *
   * `replaced` is the odd one: you are not being turned away, your OTHER tab
   * is now the one holding your seat. It is a message rather than a bare close
   * because a close is not reliably delivered, workerd leaves a hibernatable
   * socket in CLOSING and the far end never hears the handshake finish, so a
   * replaced tab would sit there believing it was still in the party. Being
   * told is the guarantee; the close is a courtesy on top of it.
   */
  | { t: "refused"; reason: "full" | "unauthorized" | "replaced" };

export function parkOf(party: GardenPartyId): "frick" | "schenley" | "highland" {
  return party.slice("garden-".length) as "frick" | "schenley" | "highland";
}
