import { create } from "zustand";
import { persist } from "zustand/middleware";

/**
 * The photographs you take in the park.
 *
 * Deliberately a store of its own, and deliberately **not** part of the save
 * file. Two reasons, and both of them are about size.
 *
 * The save file is a few hundred bytes of booleans, and it goes to Postgres as a
 * single JSONB row on every autosave. A photograph is fifty kilobytes. Putting
 * them in the same document would mean shipping the entire album back to the
 * server every time you found a flower, and it would turn a tidy little row into
 * something nobody wants to look at.
 *
 * So the album lives on the device, in its own localStorage key, and it says so
 * on the page. That is an honest trade rather than a silent one: the photos are
 * yours, they are here, and they do not follow you to another browser.
 *
 * localStorage gives us somewhere around 5MB. A capture is downscaled to 720px
 * and encoded as JPEG, which lands at 40-80KB, and the album is capped so the
 * oldest falls off the end rather than the write throwing QuotaExceededError
 * halfway through and corrupting the key.
 */

export type Photo = {
  id: string;
  /** A JPEG data URL. */
  src: string;
  /** Where you were standing. */
  area: string;
  /** The park's clock at the moment of the shutter, e.g. "7:12 am". */
  clock: string;
  phase: string;
  takenAt: number;
};

/** Beyond this the oldest photograph is dropped to make room. */
export const MAX_PHOTOS = 12;

type PhotoState = {
  photos: Photo[];
  capture: (photo: Omit<Photo, "id" | "takenAt">) => void;
  remove: (id: string) => void;
  clear: () => void;
};

export const usePhotoStore = create<PhotoState>()(
  persist(
    (set) => ({
      photos: [],

      capture: (photo) =>
        set((state) => {
          const next: Photo = {
            ...photo,
            id: `photo-${Date.now()}-${state.photos.length}`,
            takenAt: Date.now(),
          };

          // Newest first, oldest over the side.
          return { photos: [next, ...state.photos].slice(0, MAX_PHOTOS) };
        }),

      remove: (id) =>
        set((state) => ({
          photos: state.photos.filter((photo) => photo.id !== id),
        })),

      clear: () => set({ photos: [] }),
    }),
    { name: "scout-photos" },
  ),
);
