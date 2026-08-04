import type * as Party from "partykit/server";
import { decode } from "next-auth/jwt";

import {
  CHAT_TTL_MS,
  GARDEN_PARTIES,
  PARTY_CAP,
  type ClientMessage,
  type PartyPlayer,
  type Pose,
  type ServerMessage,
} from "./protocol";

/**
 * A garden party: one park, up to ten players, nothing remembered.
 *
 * The server is a relay and a referee, and deliberately not a database. It
 * holds who is here and where they are flying, referees the seat cap, and
 * passes chat and WebRTC signaling through without reading them. It never
 * writes to storage: chat that is promised to vanish in sixty seconds must not
 * exist in a log somewhere, and a Durable Object that never touches storage
 * stays inside the free tier by construction.
 *
 * Hibernation is on. Three standing rooms that are usually empty should cost
 * nothing while they are empty.
 */

type Seat = {
  player: PartyPlayer;
  pose: Pose | null;
  /** Chat timestamps in the last few seconds, for the rate limit. */
  recentChat: number[];
};

/** What survives hibernation: the connection's attachment. Everything a seat
 *  needs to be rebuilt must live here, because the in-memory map does not. */
type Attachment = { sub: string; name: string; pollinator: string };

/**
 * The head-count is read by the browser, and the party server is a different
 * origin from the game, so without this the fetch fails and the lobby shows
 * "Counting who is here" forever. It failed silently the first time, because
 * the picker swallows a dead party server rather than putting a red box on a
 * page whose other job is to show you three parks.
 *
 * Wide open on purpose, and safe to be: the only thing behind it is how many
 * bees are in a public park. Everything that is not a head-count is behind the
 * socket, and the socket wants a signed ticket.
 */
const CORS = {
  "Access-Control-Allow-Origin": "*",
} as const;

export default class Garden implements Party.Server {
  static options = { hibernate: true };

  /**
   * sub -> seat. In-memory only, so hibernation wipes it; `ensureSeats` rebuilds
   * it from connection attachments, which do survive. Poses are lost across a
   * hibernation and that is fine: they re-arrive eight times a second.
   */
  seats = new Map<string, Seat>();

  constructor(readonly room: Party.Room) {}

  private ensureSeats() {
    for (const conn of this.room.getConnections<Attachment>()) {
      const state = conn.state;

      if (state?.sub && !this.seats.has(state.sub)) {
        this.seats.set(state.sub, {
          player: {
            sub: state.sub,
            name: state.name,
            pollinator: state.pollinator,
          },
          pose: null,
          recentChat: [],
        });
      }
    }
  }

  /**
   * The gate in front of the whole room, HTTP and WebSocket alike.
   *
   * Runs in the lobby, BEFORE the room object is addressed, which is the entire
   * point: a request for `garden-nope` must not bring a room called garden-nope
   * into existence. Without this, `GET /parties/main/<anything>` answered 200
   * and span up a Durable Object per made-up name, so an unauthenticated
   * stranger with a for-loop could mint unbounded rooms on the account. There
   * are exactly three parties and their names are a closed set, so anything else
   * is answered here and never reaches a room.
   *
   * `onBeforeConnect` still checks the ticket. This one checks the address.
   */
  static onBeforeRequest(request: Party.Request, lobby: Party.Lobby) {
    if (!(GARDEN_PARTIES as readonly string[]).includes(lobby.id)) {
      return new Response("no such party", { status: 404, headers: CORS });
    }

    return request;
  }

  /**
   * The door. Runs before the socket upgrades.
   *
   * The ticket is a short-lived JWT minted by the game's own server at
   * `/api/party/ticket`, signed with the same AUTH_SECRET the session uses. The
   * browser cannot read its own session cookie (httpOnly, different host), so
   * the game hands it a ticket instead. No account, no ticket, no party.
   */
  static async onBeforeConnect(request: Party.Request, lobby: Party.Lobby) {
    if (!(GARDEN_PARTIES as readonly string[]).includes(lobby.id)) {
      return new Response("no such party", { status: 404 });
    }

    const ticket = new URL(request.url).searchParams.get("ticket");

    if (!ticket) {
      return new Response("a garden party needs an account", { status: 401 });
    }

    try {
      const token = await decode({
        token: ticket,
        secret: lobby.env.AUTH_SECRET as string,
        salt: "scout-party-ticket",
      });

      if (!token?.sub || typeof token.name !== "string") {
        return new Response("bad ticket", { status: 401 });
      }

      request.headers.set("x-scout-sub", token.sub);
      request.headers.set("x-scout-name", token.name);
      request.headers.set(
        "x-scout-pollinator",
        typeof token.pollinator === "string" ? token.pollinator : "bee",
      );

      return request;
    } catch {
      return new Response("bad ticket", { status: 401 });
    }
  }

  onConnect(conn: Party.Connection, ctx: Party.ConnectionContext) {
    this.ensureSeats();

    const sub = ctx.request.headers.get("x-scout-sub");
    const name = ctx.request.headers.get("x-scout-name") ?? "A bee";
    const pollinator = ctx.request.headers.get("x-scout-pollinator") ?? "bee";

    if (!sub) {
      this.refuse(conn, "unauthorized");
      return;
    }

    // One seat per account. A second tab for the same account replaces the
    // first rather than taking a second chair.
    const returning = this.seats.has(sub);

    if (!returning && this.seats.size >= PARTY_CAP) {
      this.refuse(conn, "full");
      return;
    }

    const player: PartyPlayer = { sub, name, pollinator };

    if (returning) {
      for (const other of this.room.getConnections<{ sub: string }>()) {
        if (other.id !== conn.id && other.state?.sub === sub) {
          other.close();
        }
      }
    }

    conn.setState({ sub, name, pollinator } satisfies Attachment);
    this.seats.set(sub, {
      player,
      pose: this.seats.get(sub)?.pose ?? null,
      recentChat: [],
    });

    this.send(conn, {
      t: "welcome",
      you: player,
      players: [...this.seats.values()]
        .filter((seat) => seat.player.sub !== sub)
        .map((seat) => ({ ...seat.player, pose: seat.pose })),
    });

    if (!returning) {
      this.broadcast({ t: "join", player }, sub);
    }
  }

  onMessage(raw: string | ArrayBuffer, conn: Party.Connection<Attachment>) {
    this.ensureSeats();

    const sub = conn.state?.sub;
    const seat = sub ? this.seats.get(sub) : undefined;

    if (!sub || !seat || typeof raw !== "string" || raw.length > 4096) {
      return;
    }

    let message: ClientMessage;

    try {
      message = JSON.parse(raw) as ClientMessage;
    } catch {
      return;
    }

    switch (message.t) {
      case "pos": {
        const p = message.pose;

        if (
          typeof p?.x !== "number" ||
          typeof p.z !== "number" ||
          typeof p.altitude !== "number" ||
          typeof p.heading !== "number"
        ) {
          return;
        }

        seat.pose = {
          x: p.x,
          z: p.z,
          altitude: p.altitude,
          heading: p.heading,
          gesture: typeof p.gesture === "string" ? p.gesture : "none",
        };
        this.broadcast({ t: "pos", sub, pose: seat.pose }, sub);
        return;
      }

      case "chat": {
        const text = typeof message.text === "string" ? message.text.trim() : "";

        if (!text || text.length > 240) {
          return;
        }

        // Four messages in ten seconds is conversation; forty is a hose.
        const now = Date.now();
        seat.recentChat = seat.recentChat.filter((at) => now - at < 10_000);

        if (seat.recentChat.length >= 4) {
          return;
        }

        seat.recentChat.push(now);
        // To everyone INCLUDING the sender: one code path for drawing a
        // message, and your own line proves the room heard you.
        this.broadcast({ t: "chat", sub, name: seat.player.name, text });
        return;
      }

      case "rtc": {
        // Verbatim relay to one peer. The server does not read the payload;
        // the voices themselves never come through here at all.
        const target = message.to;

        for (const other of this.room.getConnections<{ sub: string }>()) {
          if (other.state?.sub === target) {
            this.send(other, { t: "rtc", from: sub, payload: message.payload });
          }
        }

        return;
      }
    }
  }

  onClose(conn: Party.Connection<Attachment>) {
    this.ensureSeats();

    const sub = conn.state?.sub;

    if (!sub) {
      return;
    }

    // Only vacate the seat if this was the account's last connection.
    for (const other of this.room.getConnections<{ sub: string }>()) {
      if (other.id !== conn.id && other.state?.sub === sub) {
        return;
      }
    }

    this.seats.delete(sub);
    this.broadcast({ t: "leave", sub });
  }

  /**
   * `GET /parties/garden/:id` answers with the live head-count, for the party
   * picker. Public on purpose: a count of bees is not a secret, and the picker
   * shows it before the player has decided to join.
   */
  onRequest(request: Party.Request) {
    this.ensureSeats();

    if (request.method !== "GET") {
      return new Response("nope", { status: 405, headers: CORS });
    }

    return Response.json(
      {
        party: this.room.id,
        count: this.seats.size,
        cap: PARTY_CAP,
      },
      { headers: CORS },
    );
  }

  /** Say why, then close. A silent refusal looks like a network fault and the
   *  client would retry it forever. */
  private refuse(conn: Party.Connection, reason: "full" | "unauthorized") {
    this.send(conn, { t: "refused", reason });
    conn.close(4000, reason);
  }

  private send(conn: Party.Connection, message: ServerMessage) {
    conn.send(JSON.stringify(message));
  }

  private broadcast(message: ServerMessage, except?: string) {
    const raw = JSON.stringify(message);

    for (const conn of this.room.getConnections<{ sub: string }>()) {
      if (except === undefined || conn.state?.sub !== except) {
        conn.send(raw);
      }
    }
  }
}

/** Chat expiry lives on the CLIENT: each message dies CHAT_TTL_MS after it was
 *  seen. The server forgets a message the moment it has finished relaying it,
 *  which is what "messages do not save" means when it is true. */
export { CHAT_TTL_MS };
