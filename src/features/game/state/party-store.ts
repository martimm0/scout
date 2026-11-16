"use client";

import { create } from "zustand";

import type {
  CoopView,
  GardenPartyId,
  OutingView,
  PartyPlayer,
  Pose,
  TableView,
} from "@party/protocol";
import type { Warmth } from "@party/games/outings";

/**
 * Party state, session-only on purpose.
 *
 * Nothing here is persisted and nothing here is progress: it is who is in the
 * room with you right now, what they last said, and where they are flying. The
 * game store persists; this one evaporates with the tab, which is the same
 * promise the chat makes.
 *
 * Poses are NOT React state. They arrive eight times a second per player and
 * are read by the frame loop; routing them through setState would re-render
 * the HUD at 80Hz for data React never draws. They live in a mutable map the
 * GL scene reads directly, the same pattern the store already uses for
 * per-frame values.
 */

export type ChatLine = {
  key: string;
  sub: string;
  name: string;
  text: string;
  /** When this client saw it. Expiry is measured from here, CHAT_TTL_MS later. */
  seenAt: number;
};

export type PartyStatus =
  | "out"
  | "connecting"
  | "in"
  | "full"
  | "unauthorized"
  /**
   * The door would not open at all.
   *
   * Distinct from `unauthorized`, which is the room telling you why. This is
   * the socket failing before there is a socket to be told anything on, which
   * in practice means the ticket did not verify: the pass is signed with one
   * secret and checked against another.
   */
  | "rejected"
  /**
   * The ticket could not be had: the network, or a bad moment on the server.
   * Only a first knock lands here. A reconnect keeps retrying under `lost`.
   */
  | "unreachable"
  | "lost";

type PartyState = {
  status: PartyStatus;
  party: GardenPartyId | null;
  you: PartyPlayer | null;
  /** Everyone else in the room, in join order. */
  others: PartyPlayer[];
  chat: ChatLine[];
  /**
   * The chat box has the keyboard.
   *
   * The scene listens on window and calls preventDefault on most of the letters
   * you need to write a sentence, so while this is true the frame loop treats
   * the park the way it treats an open popover and takes its hands off the
   * keys. The input also stops its own events from bubbling that far, but this
   * flag is what handles the case the stopped events cannot: holding W to fly,
   * then clicking into the chat box, whose blocked keyup would otherwise leave
   * the bee flying forward forever.
   */
  chatFocused: boolean;
  /**
   * Every game in the room, as the server last described it.
   *
   * Replaced wholesale on each update rather than patched. The room sends the
   * whole list, and a client that tried to merge diffs would be one dropped
   * message away from drawing a board that does not exist.
   */
  tables: TableView[];
  /**
   * The flower you are working, if somebody else is working it too.
   *
   * One at a time, because you can only stand on one plant. Cleared when you
   * take off, so a stale board cannot follow you to the next flower.
   */
  coop: CoopView | null;
  /**
   * Every round out in the park, as the room last described them. Replaced
   * whole, as the tables are.
   */
  outings: OutingView[];
  /**
   * The room's clock minus this one, in milliseconds.
   *
   * A round's deadlines are in the room's time. This is only ever used to draw
   * a countdown: nothing is decided by it, and the hold on a racer is let go by
   * the room saying the race has started, never by this reaching zero.
   */
  clockSkew: number;
  /**
   * What the frame loop has worked out about the round you are in, from where
   * you are. Written on the pose tick and only when it changes, so a card can
   * read it without being redrawn six times a second.
   */
  sense: OutingSense;

  setStatus: (status: PartyStatus) => void;
  setTables: (tables: TableView[]) => void;
  setCoop: (coop: CoopView | null) => void;
  setOutings: (outings: OutingView[], roomNow: number) => void;
  setSense: (sense: OutingSense) => void;
  setChatFocused: (focused: boolean) => void;
  joined: (party: GardenPartyId, you: PartyPlayer, others: PartyPlayer[]) => void;
  playerJoined: (player: PartyPlayer) => void;
  playerLeft: (sub: string) => void;
  chatArrived: (line: Omit<ChatLine, "key" | "seenAt">) => void;
  chatExpired: (now: number, ttl: number) => void;
  left: () => void;
};

/** sub -> latest pose. Written by the socket, read by the frame loop. */
export const partyPoses = new Map<string, Pose>();

export type OutingSense = {
  /** Races still gathering whose start you are at, by id. */
  atStart: string[];
  /**
   * Gates you have passed by this client's own reckoning. It runs the same test
   * the room does on the very poses it sends, so it is the room's answer a
   * fifth of a second early, which is the difference between a chime as you
   * pass a gate and a chime after it.
   */
  gates: number;
  /** Which way the next gate is from where you are facing, and how far. */
  cue: { way: "ahead" | "left" | "right" | "behind"; distance: number } | null;
  /** Seeking: how near the nearest hider is. */
  warmth: Warmth | null;
  /** Hiding: whether you are inside the hiding place. */
  inArea: boolean | null;
};

export const NO_SENSE: OutingSense = {
  atStart: [],
  gates: 0,
  cue: null,
  warmth: null,
  inArea: null,
};

/**
 * What a round is doing to your flight, for the frame loop.
 *
 * Mutable and outside React for the reason the poses are: it is read every
 * frame. It is written in exactly one place, `syncOutingFlight`, from the
 * rounds and the connection together, and that is the point of it. A hold that
 * was set by one message and cleared by another would be a hold that a dropped
 * connection leaves on for ever, with the bee stuck at a start line for a race
 * the room has forgotten. Here, no round or no connection is no hold, whatever
 * happened in between.
 */
export const outingFlight = {
  /** Throttle and climb are ignored. Turning is not. */
  held: false,
  /** Every pollinator flies at the bee's speed, and rain slows nobody. */
  racing: false,
  /** Counts up each time a hold begins, so the loop can stop the bee dead once. */
  epoch: 0,
  /** Hiding, or hidden: a dance must not put a column of light over the spot. */
  hiding: false,
  /** Bees not to draw: the hiders, while you are the one counting. */
  unseen: new Set<string>(),
};

/** The round you are in: one still going if there is one, or a result unread. */
export function outingOf(
  outings: OutingView[],
  you: string | undefined,
): OutingView | null {
  if (!you) {
    return null;
  }

  const mine = outings.filter(
    (outing) =>
      outing.members.some((member) => member.sub === you) &&
      !outing.done.includes(you),
  );

  return mine.find((outing) => outing.phase !== "done") ?? mine[0] ?? null;
}

function syncOutingFlight(state: {
  status: PartyStatus;
  you: PartyPlayer | null;
  outings: OutingView[];
}) {
  const you = state.you?.sub;
  const mine = state.status === "in" ? outingOf(state.outings, you) : null;
  let held = false;
  let racing = false;
  let hiding = false;
  const unseen = new Set<string>();

  if (mine && you) {
    if (mine.race) {
      const entry = mine.race.progress[you];

      // Held from the moment it is begun to the moment the room says go.
      held = mine.phase === "countdown" && entry !== undefined;
      racing =
        held || (mine.phase === "running" && entry?.finishedIn === null);
    } else if (mine.hide) {
      const hider = mine.hide.hiders.includes(you);
      const seeker = mine.hide.seekers.includes(you);

      if (mine.phase === "hiding") {
        hiding = hider;
        // The seeker waits where they are. A hider who has said they are
        // hidden stays hidden: no pressing the button and then moving.
        held = seeker || (hider && mine.hide.ready.includes(you));

        if (seeker) {
          for (const sub of mine.hide.hiders) {
            unseen.add(sub);
          }
        }
      } else if (mine.phase === "seeking") {
        hiding = hider;
        held = hider;
      }
    }
  }

  if (held && !outingFlight.held) {
    outingFlight.epoch += 1;
  }

  // Forget where they were. The room stops sending a hider's poses while you
  // count, and the last one it did send is where they set off from.
  for (const sub of unseen) {
    if (!outingFlight.unseen.has(sub)) {
      partyPoses.delete(sub);
    }
  }

  outingFlight.held = held;
  outingFlight.racing = racing;
  outingFlight.hiding = hiding;
  outingFlight.unseen = unseen;
}

let chatKey = 0;

export const usePartyStore = create<PartyState>()((set, get) => ({
  status: "out",
  party: null,
  you: null,
  others: [],
  chat: [],
  chatFocused: false,
  tables: [],
  coop: null,
  outings: [],
  clockSkew: 0,
  sense: NO_SENSE,

  setStatus: (status) => {
    set({ status });
    syncOutingFlight(get());
  },

  setTables: (tables) => set({ tables }),

  setCoop: (coop) => set({ coop }),

  setOutings: (outings, roomNow) => {
    const before = outingOf(get().outings, get().you?.sub);
    const after = outingOf(outings, get().you?.sub);

    set({
      outings,
      clockSkew: roomNow - Date.now(),
      // A different round, or none: what was sensed about the last one is
      // about the last one.
      ...(before?.id === after?.id ? {} : { sense: NO_SENSE }),
    });
    syncOutingFlight(get());
  },

  setSense: (sense) => set({ sense }),

  setChatFocused: (chatFocused) => set({ chatFocused }),

  joined: (party, you, others) => {
    set({
      status: "in",
      party,
      you,
      others,
      chat: [],
      tables: [],
      coop: null,
      // The room sends its list straight after the welcome. Until it does,
      // whatever was held from before a reconnect is not to be trusted.
      outings: [],
      sense: NO_SENSE,
    });
    syncOutingFlight(get());
  },

  playerJoined: (player) =>
    set((state) => ({
      others: [
        ...state.others.filter((other) => other.sub !== player.sub),
        player,
      ],
    })),

  playerLeft: (sub) => {
    partyPoses.delete(sub);
    set((state) => ({
      others: state.others.filter((other) => other.sub !== sub),
    }));
  },

  chatArrived: (line) =>
    set((state) => ({
      chat: [
        ...state.chat,
        { ...line, key: `c${chatKey++}`, seenAt: Date.now() },
      ],
    })),

  /** Called on a slow tick; sixty seconds after a line was seen, it is gone. */
  chatExpired: (now, ttl) =>
    set((state) => {
      const alive = state.chat.filter((line) => now - line.seenAt < ttl);

      return alive.length === state.chat.length ? state : { chat: alive };
    }),

  left: () => {
    partyPoses.clear();
    set({
      status: "out",
      party: null,
      you: null,
      others: [],
      chat: [],
      chatFocused: false,
      tables: [],
      coop: null,
      outings: [],
      sense: NO_SENSE,
    });
    syncOutingFlight(get());
  },
}));
