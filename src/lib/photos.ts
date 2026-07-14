import { sql } from "@vercel/postgres";

import { databaseConfigured } from "./env";

/**
 * The album.
 *
 * Photographs live in Postgres, next to everything else. There was a version of
 * this that kept them in localStorage, on the reasoning that a save file is a
 * few hundred bytes of booleans and a photograph is fifty kilobytes, so the two
 * do not belong together.
 *
 * That reasoning was right about the *save file* and wrong about the *database*.
 * The save file is one JSONB row that is read and written whole on every
 * autosave, so an album in there would be shipped both ways every time you found
 * a flower. But the fix for that is a second table, not a second service. A
 * capped album is under a megabyte, Postgres stores a megabyte without noticing,
 * and `bytea` is TOASTed out of line automatically, which is the exact case it
 * exists for. Blob storage earns its keep on big files, CDN delivery and
 * millions of objects. None of those are true here.
 *
 * Two decisions worth keeping:
 *
 *  - **`bytea`, not base64 text.** Base64 is a third larger, and we would pay
 *    that on every row, forever, for nothing.
 *  - **Its own endpoint, not inlined into JSON.** An image served from a URL can
 *    be cached by the browser. An image pasted into a JSON payload is downloaded
 *    again every single time the journal is opened.
 *
 * The bytes cross the wire to Postgres as hex and come back as base64 rather
 * than being handed over as a Buffer, because the serverless driver talks HTTP
 * and its round-tripping of binary parameters is not something worth betting an
 * album on. `decode()` and `encode()` make it explicit, and the column is still
 * a compact `bytea` at rest.
 */

/** Kept per player. The oldest falls off the end. */
export const MAX_PHOTOS = 12;

/** A generous ceiling for a 720px JPEG, which really lands around 50KB. */
export const MAX_PHOTO_BYTES = 400_000;

export type PhotoMeta = {
  id: string;
  area: string;
  /** The park's clock at the moment of the shutter, e.g. "7:12 am". */
  clock: string;
  phase: string;
  takenAt: number;
};

let schemaReady = false;

async function ensureSchema() {
  if (schemaReady) {
    return;
  }

  await sql`
    CREATE TABLE IF NOT EXISTS player_photos (
      id       TEXT PRIMARY KEY,
      user_id  TEXT NOT NULL,
      area     TEXT NOT NULL,
      clock    TEXT NOT NULL,
      phase    TEXT NOT NULL,
      image    BYTEA NOT NULL,
      taken_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;

  // Every query here is "this player's photos, newest first".
  await sql`
    CREATE INDEX IF NOT EXISTS player_photos_by_owner
      ON player_photos (user_id, taken_at DESC)
  `;

  schemaReady = true;
}

export async function listPhotos(userId: string): Promise<PhotoMeta[]> {
  if (!databaseConfigured) {
    return [];
  }

  await ensureSchema();

  // Note what is NOT selected: the image. Listing the album must not drag a
  // megabyte of JPEG through the database and into a JSON response that only
  // needed the captions.
  const { rows } = await sql<{
    id: string;
    area: string;
    clock: string;
    phase: string;
    taken_at: Date;
  }>`
    SELECT id, area, clock, phase, taken_at
    FROM player_photos
    WHERE user_id = ${userId}
    ORDER BY taken_at DESC
  `;

  return rows.map((row) => ({
    id: row.id,
    area: row.area,
    clock: row.clock,
    phase: row.phase,
    takenAt: new Date(row.taken_at).getTime(),
  }));
}

export async function savePhoto(
  userId: string,
  photo: Omit<PhotoMeta, "takenAt"> & { image: Buffer },
) {
  if (!databaseConfigured) {
    return;
  }

  await ensureSchema();

  await sql`
    INSERT INTO player_photos (id, user_id, area, clock, phase, image)
    VALUES (
      ${photo.id},
      ${userId},
      ${photo.area},
      ${photo.clock},
      ${photo.phase},
      decode(${photo.image.toString("hex")}, 'hex')
    )
  `;

  // Keep the newest MAX_PHOTOS and drop the rest. Done here rather than trusting
  // the client to police its own album: a client that forgets, or a second tab
  // that does not know about the first, would otherwise grow it without limit.
  await sql`
    DELETE FROM player_photos
    WHERE user_id = ${userId}
      AND id NOT IN (
        SELECT id FROM player_photos
        WHERE user_id = ${userId}
        ORDER BY taken_at DESC
        LIMIT ${MAX_PHOTOS}
      )
  `;
}

/** The bytes, but only if they belong to the person asking. */
export async function getPhoto(
  userId: string,
  id: string,
): Promise<Buffer | null> {
  if (!databaseConfigured) {
    return null;
  }

  await ensureSchema();

  const { rows } = await sql<{ image: string }>`
    SELECT encode(image, 'base64') AS image
    FROM player_photos
    WHERE id = ${id} AND user_id = ${userId}
  `;

  if (!rows[0]) {
    return null;
  }

  return Buffer.from(rows[0].image, "base64");
}

export async function deletePhoto(userId: string, id: string) {
  if (!databaseConfigured) {
    return;
  }

  await ensureSchema();

  await sql`
    DELETE FROM player_photos WHERE id = ${id} AND user_id = ${userId}
  `;
}
