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

/** Which way this browser is storing photographs, once we have asked the server. */
export type Mode = "unknown" | "cloud" | "local";

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

type PhotoState = {
  photos: Photo[];
  mode: Mode;
  loaded: boolean;
  load: () => Promise<void>;
  capture: (photo: Omit<Photo, "id" | "takenAt">) => Promise<void>;
  remove: (id: string) => Promise<void>;
};

export const usePhotoStore = create<PhotoState>()((set, get) => ({
  photos: [],
  mode: "unknown",
  loaded: false,

  /**
   * Ask the server for the album. A 501 means no database is configured and a
   * 401 means nobody is signed in; either way there is no account to hold
   * photographs, so this browser keeps its own.
   */
  load: async () => {
    try {
      const response = await fetch("/api/photos");

      if (!response.ok) {
        set({ photos: readLocal(), mode: "local", loaded: true });

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
      set({ photos: readLocal(), mode: "local", loaded: true });
    }
  },

  capture: async (photo) => {
    // The shutter fires while the player is flying, and the game must not wait
    // on a round-trip to find out where the album lives. Post it; if the server
    // will not have it, it goes on the device instead.
    try {
      const response = await fetch("/api/photos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(photo),
      });

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
          ].slice(0, MAX_PHOTOS),
        }));

        return;
      }
    } catch {
      // Offline, or no server. Fall through and keep it here.
    }

    const local: Photo = {
      ...photo,
      id: `local-${Date.now()}-${get().photos.length}`,
      takenAt: Date.now(),
    };

    const photos = [local, ...readLocal()].slice(0, MAX_PHOTOS);
    writeLocal(photos);
    set({ photos, mode: "local" });
  },

  remove: async (id) => {
    if (get().mode === "cloud" && !id.startsWith("local-")) {
      await fetch(`/api/photos/${id}`, { method: "DELETE" }).catch(() => {
        // It stays on the server. Better than telling the player it is gone.
      });
    } else {
      writeLocal(readLocal().filter((photo) => photo.id !== id));
    }

    set((state) => ({
      photos: state.photos.filter((photo) => photo.id !== id),
    }));
  },
}));
