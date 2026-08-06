"use client";

import { create } from "zustand";

import type {
  CoopView,
  GardenPartyId,
  PartyPlayer,
  Pose,
  TableView,
} from "@party/protocol";

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

  setStatus: (status: PartyStatus) => void;
  setTables: (tables: TableView[]) => void;
  setCoop: (coop: CoopView | null) => void;
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

let chatKey = 0;

export const usePartyStore = create<PartyState>()((set) => ({
  status: "out",
  party: null,
  you: null,
  others: [],
  chat: [],
  chatFocused: false,
  tables: [],
  coop: null,

  setStatus: (status) => set({ status }),

  setTables: (tables) => set({ tables }),

  setCoop: (coop) => set({ coop }),

  setChatFocused: (chatFocused) => set({ chatFocused }),

  joined: (party, you, others) =>
    set({
      status: "in",
      party,
      you,
      others,
      chat: [],
      tables: [],
      coop: null,
    }),

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
    });
  },
}));
