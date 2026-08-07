"use client";

import PartySocket from "partysocket";

import {
  CHAT_TTL_MS,
  type ClientMessage,
  type GameKind,
  type GardenPartyId,
  type Pose,
  type ServerMessage,
} from "@party/protocol";
import { countParty } from "./party-counters";
import { partyPoses, usePartyStore } from "./party-store";

/**
 * The socket into a garden party, and the only file that knows there is one.
 *
 * Everything else reads the party store or the pose map. One connection at a
 * time; joining a second party leaves the first.
 */

let socket: PartySocket | null = null;
let expiryTimer: ReturnType<typeof setInterval> | null = null;

/**
 * Where the party server lives.
 *
 * `npx wrangler dev --local` serves on 1999 locally. In production this is the deployed
 * worker's host, set at build time. Read through a named constant rather than
 * inline so a missing variable is one obvious fallback rather than a socket
 * quietly opening against the wrong origin.
 */
function partyHost() {
  return process.env.NEXT_PUBLIC_PARTYKIT_HOST ?? "127.0.0.1:1999";
}

/** A pass into a room. Five minutes long, so it is fetched per connection. */
async function freshTicket(): Promise<{ ticket: string }> {
  const response = await fetch("/api/party/ticket");

  if (!response.ok) {
    // Reported through the socket failing rather than thrown: the caller is
    // partysocket's own reconnect loop, which has nowhere to put an exception.
    usePartyStore.getState().setStatus("unauthorized");

    return { ticket: "" };
  }

  return (await response.json()) as { ticket: string };
}

export async function joinParty(party: GardenPartyId): Promise<void> {
  leaveParty();

  const store = usePartyStore.getState();
  store.setStatus("connecting");

  // Fail before opening a socket if there is no account, so the lobby can say
  // so rather than showing a connection that will never work.
  const first = await freshTicket();

  if (!first.ticket) {
    return;
  }

  socket = new PartySocket({
    host: partyHost(),
    // The Durable Object binding is called Garden, and the router kebab-cases
    // it into the path. Leave this off and it addresses "main", which is not a
    // room this worker has.
    party: "garden",
    room: party,
    /**
     * A FUNCTION, not the ticket we just fetched.
     *
     * partysocket calls this on every connection attempt, and that is the whole
     * point: a ticket lasts five minutes, and passing a fixed one meant every
     * reconnect after that reused an expired pass. The socket would then be
     * refused forever, against a server that was perfectly healthy, and the only
     * way back was reloading the page. Handing it a function means a dropped
     * connection re-authenticates itself.
     */
    query: freshTicket,
  });

  /**
   * A handle for the suite to drop the connection with, outside production.
   *
   * Testing that a reconnect re-authenticates needs a reconnect, and waiting
   * for a real network to fail is not a test. Compiled out of the production
   * bundle rather than shipped.
   */
  if (process.env.NODE_ENV !== "production") {
    (
      window as unknown as { __scoutPartySocketForTest?: PartySocket }
    ).__scoutPartySocketForTest = socket;
  }

  socket.addEventListener("message", (event) => {
    let message: ServerMessage;

    try {
      message = JSON.parse(String(event.data)) as ServerMessage;
    } catch {
      return;
    }

    const state = usePartyStore.getState();

    switch (message.t) {
      case "welcome":
        countParty("joins");

        for (const player of message.players) {
          if (player.pose) {
            partyPoses.set(player.sub, player.pose);
          }
        }

        state.joined(
          party,
          message.you,
          message.players.map((player) => ({
            sub: player.sub,
            name: player.name,
            pollinator: player.pollinator,
          })),
        );
        return;

      case "join":
        state.playerJoined(message.player);
        return;

      case "leave":
        state.playerLeft(message.sub);
        return;

      case "pos":
        partyPoses.set(message.sub, message.pose);
        return;

      case "tables":
        state.setTables(message.tables);
        return;

      case "coop":
        state.setCoop(message.session);
        return;

      case "chat":
        state.chatArrived({
          sub: message.sub,
          name: message.name,
          text: message.text,
        });
        return;

      case "rtc":
        // Handed to the voice layer when it is up; ignored until then.
        rtcHandler?.(message.from, message.payload);
        return;

      case "refused":
        // "replaced" is this tab losing its seat to another of your own, which
        // is not a failure and should not read like one.
        state.setStatus(message.reason === "replaced" ? "out" : message.reason);
        leaveParty(false);
        return;
    }
  });

  /**
   * Never got in at all.
   *
   * The room turns a bad ticket away at the HTTP upgrade, BEFORE a socket
   * exists, so there is no `refused` message to receive: the browser reports a
   * failed WebSocket and nothing else. That left the lobby sitting on "Going
   * in" forever while the console filled with errors nobody was watching, which
   * is the worst way for this to fail because the head-count beside it keeps
   * working and makes the page look healthy.
   *
   * A socket that has never opened by now is a door that will not open. Say so.
   */
  const opened = { yet: false };

  socket.addEventListener("open", () => {
    opened.yet = true;
  });

  socket.addEventListener("close", () => {
    const status = usePartyStore.getState().status;

    if (!opened.yet) {
      usePartyStore.getState().setStatus("rejected");
      leaveParty(false);

      return;
    }

    // A close after a refusal keeps the refusal on screen; a close out of
    // nowhere is a lost connection, and PartySocket is already retrying.
    if (status === "in") {
      usePartyStore.getState().setStatus("lost");
    }
  });

  // Chat expiry: a slow tick, not a timer per message. Sixty seconds after a
  // line was seen it vanishes, and the server never had a copy to begin with.
  expiryTimer = setInterval(() => {
    usePartyStore.getState().chatExpired(Date.now(), CHAT_TTL_MS);
  }, 1000);
}

export function leaveParty(resetStore = true) {
  if (expiryTimer) {
    clearInterval(expiryTimer);
    expiryTimer = null;
  }

  socket?.close();
  socket = null;

  if (resetStore) {
    usePartyStore.getState().left();
  }
}

function sendToParty(message: ClientMessage) {
  if (socket?.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify(message));
  }
}

/** Called by the frame loop, already throttled to the broadcast rate. */
export function sendPose(pose: Pose) {
  sendToParty({ t: "pos", pose });
}

export function sendChat(text: string) {
  sendToParty({ t: "chat", text });
}

/* The party games. The room referees every one of these; the client is only
   ever asking. */

export function openTable(kind: GameKind) {
  sendToParty({ t: "open", kind });
  countParty("games_played");
}

export function sitAtTable(table: string) {
  sendToParty({ t: "sit", table });
}

export function leaveTable(table: string) {
  sendToParty({ t: "leaveTable", table });
}

export function beginTable(table: string) {
  sendToParty({ t: "begin", table });
}

/* Working a flower with whoever else is standing on it. */

export function workOn(instance: string, plant: string) {
  sendToParty({ t: "workOn", instance, plant });
}

export function shareFind(instance: string, token: string) {
  sendToParty({ t: "found", instance, token });
}

export function stopWorking(instance: string) {
  usePartyStore.getState().setCoop(null);
  sendToParty({ t: "stopWorking", instance });
}

/** A move, whose shape the game decides. Refused moves are simply ignored. */
export function sendMove(table: string, move: unknown) {
  sendToParty({ t: "move", table, move });
}

export function sendRtc(to: string, payload: unknown) {
  sendToParty({ t: "rtc", to, payload });
}

/** The voice layer registers here rather than owning the socket. */
let rtcHandler: ((from: string, payload: unknown) => void) | null = null;

export function onRtc(handler: typeof rtcHandler) {
  rtcHandler = handler;
}
