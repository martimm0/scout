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
  | { t: "begin"; table: string };

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
  /** The room is full or the ticket is bad; the socket closes after this. */
  | { t: "refused"; reason: "full" | "unauthorized" };

export function parkOf(party: GardenPartyId): "frick" | "schenley" | "highland" {
  return party.slice("garden-".length) as "frick" | "schenley" | "highland";
}
