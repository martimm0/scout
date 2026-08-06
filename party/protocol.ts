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
  /** "none" | "greet" | "dance" — mirrored so the gesture is visible to others. */
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
 * `finds` are opaque tokens the game decides the meaning of — a matched floret,
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
  | { t: "stopWorking"; instance: string };

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
  /** The room is full or the ticket is bad; the socket closes after this. */
  | { t: "refused"; reason: "full" | "unauthorized" };

export function parkOf(party: GardenPartyId): "frick" | "schenley" | "highland" {
  return party.slice("garden-".length) as "frick" | "schenley" | "highland";
}
