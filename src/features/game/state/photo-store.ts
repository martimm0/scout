import { create } from "zustand";

import { MAX_PHOTOS } from "@/lib/photos";

/**
 * The album.
 *
 * Photographs belong to the player, so they live in the player's account: a row
 * each in Postgres, fetched by URL and cached by the browser like any other
 * image. They are deliberately NOT part of the save file, which is one JSONB row
 * read and written whole on every autosave; an album in there would be shipped
 * both ways every time somebody found a flower. A second table costs nothing and
 * settles it.
 *
 * The local fallback is not a convenience, it is a correctness requirement. Scout
 * runs on a fresh clone with an empty `.env`, where there is no account to own an
 * album and no database to put it in. In that mode the photographs sit in
 * localStorage, and the journal says so rather than implying they are safe
 * somewhere they are not.
 */

export type Photo = {
  id: string;
  /** Where to get the image: an API URL in the cloud, a data URL on the device. */
  src: string;
  area: string;
  /** The park's clock at the moment of the shutter, e.g. "7:12 am". */
  clock: string;
  phase: string;
  takenAt: number;
};

export { MAX_PHOTOS };

/**
 * Which way this browser is storing photographs, once we have asked the server.
 *
 * `unreachable` is the account album that could not be fetched just now. It is
 * not `local`: the photographs are still in the account, and saying they live on
 * this device would be wrong twice over.
 */
export type Mode = "unknown" | "cloud" | "local" | "unreachable";

/**
 * The one answer that means "keep it on this device".
 *
 * A 501 is the server saying there is no account system to keep anything in,
 * which is the fresh clone the local album exists for. Every other failure (a
 * 500, a lapsed session, a dropped connection) happens to a player who HAS an
 * account album, and the journal on a deployment with accounts only ever reads
 * that. A photograph filed on the device instead was told it was kept and then
 * never shown again.
 */
const NO_ACCOUNTS = 501;

const LOCAL_KEY = "scout-photos";

function readLocal(): Photo[] {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(LOCAL_KEY);

    return raw ? (JSON.parse(raw) as Photo[]) : [];
  } catch {
    return [];
  }
}

function writeLocal(photos: Photo[]) {
  try {
    window.localStorage.setItem(LOCAL_KEY, JSON.stringify(photos));
  } catch {
    // The quota. Nothing to do but keep flying: a photograph that cannot be kept
    // is not a reason to take the game down.
  }
}

/**
 * What happened when the shutter fired. The HUD says so either way.
 *
 * `signed-out` and `not-kept` both mean nothing was stored anywhere; they are
 * split only so the HUD can say which, since one is fixed by signing in and the
 * other by trying again.
 */
export type CaptureResult = "saved" | "album-full" | "signed-out" | "not-kept";

type PhotoState = {
  photos: Photo[];
  mode: Mode;
  loaded: boolean;
  load: () => Promise<void>;
  capture: (photo: Omit<Photo, "id" | "takenAt">) => Promise<CaptureResult>;
  remove: (id: string) => Promise<void>;
};

export const usePhotoStore = create<PhotoState>()((set, get) => ({
  photos: [],
  mode: "unknown",
  loaded: false,

  /**
   * Ask the server for the album. A 501 means there is no account system, so
   * this browser keeps its own. Anything else that fails leaves the album where
   * it is, in the account, and says it could not be fetched.
   */
  load: async () => {
    try {
      const response = await fetch("/api/photos");

      if (response.status === NO_ACCOUNTS) {
        set({ photos: readLocal(), mode: "local", loaded: true });

        return;
      }

      if (!response.ok) {
        set({ photos: [], mode: "unreachable", loaded: true });

        return;
      }

      const body = (await response.json()) as {
        photos: Omit<Photo, "src">[];
      };

      set({
        photos: body.photos.map((photo) => ({
          ...photo,
          src: `/api/photos/${photo.id}`,
        })),
        mode: "cloud",
        loaded: true,
      });
    } catch {
      set({ photos: [], mode: "unreachable", loaded: true });
    }
  },

  capture: async (photo) => {
    try {
      const response = await fetch("/api/photos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(photo),
      });

      // The album is full. Emphatically NOT a reason to fall back to saving on
      // the device: that would route around the very cap we just enforced, and
      // the player would be told the photo was kept when it was kept somewhere
      // they will never look for it.
      if (response.status === 409) {
        set({ mode: "cloud" });

        return "album-full";
      }

      if (response.ok) {
        const { id, takenAt } = (await response.json()) as {
          id: string;
          takenAt: number;
        };

        set((state) => ({
          mode: "cloud",
          photos: [
            { ...photo, id, takenAt, src: `/api/photos/${id}` },
            ...state.photos,
          ],
        }));

        return "saved";
      }

      if (response.status === 401) {
        return "signed-out";
      }

      if (response.status !== NO_ACCOUNTS) {
        return "not-kept";
      }
    } catch {
      // Offline. The account album is still the album; nothing was kept.
      return "not-kept";
    }

    // Local mode: no account system, so no album to fill. The same cap applies,
    // and it refuses in the same way rather than quietly binning the oldest.
    const existing = readLocal();

    if (existing.length >= MAX_PHOTOS) {
      set({ photos: existing, mode: "local" });

      return "album-full";
    }

    const local: Photo = {
      ...photo,
      id: `local-${Date.now()}-${get().photos.length}`,
      takenAt: Date.now(),
    };

    const photos = [local, ...existing];
    writeLocal(photos);
    set({ photos, mode: "local" });

    return "saved";
  },

  remove: async (id) => {
    if (get().mode === "cloud" && !id.startsWith("local-")) {
      const response = await fetch(`/api/photos/${id}`, {
        method: "DELETE",
      }).catch(() => null);

      // It stays on the server, so it stays in the album. Taking it off the page
      // anyway told the player it was gone, and the next visit put it back. A
      // 404 is already gone, which is what was asked for.
      if (!response || (!response.ok && response.status !== 404)) {
        return;
      }
    } else {
      writeLocal(readLocal().filter((photo) => photo.id !== id));
    }

    set((state) => ({
      photos: state.photos.filter((photo) => photo.id !== id),
    }));
  },
}));
