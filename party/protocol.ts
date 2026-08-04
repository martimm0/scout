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

/** Client to server. */
export type ClientMessage =
  | { t: "pos"; pose: Pose }
  | { t: "chat"; text: string }
  /** WebRTC signaling, relayed verbatim to one peer. The server reads none of it. */
  | { t: "rtc"; to: string; payload: unknown };

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
  /** The room is full or the ticket is bad; the socket closes after this. */
  | { t: "refused"; reason: "full" | "unauthorized" };

export function parkOf(party: GardenPartyId): "frick" | "schenley" | "highland" {
  return party.slice("garden-".length) as "frick" | "schenley" | "highland";
}
