import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { cloudSaveConfigured } from "@/lib/env";
import {
  listPhotos,
  savePhoto,
  MAX_PHOTOS,
  MAX_PHOTO_BYTES,
} from "@/lib/photos";

/**
 * The album: list it, and add to it.
 *
 * Like the save routes, these answer honestly with a 501 when there is nowhere
 * to save to, rather than pretending to work. The client reads that and keeps
 * the album on the device instead of quietly dropping the player's photographs
 * into a void.
 */

export async function GET() {
  if (!cloudSaveConfigured) {
    return NextResponse.json(
      { error: "cloud-save-not-configured" },
      { status: 501 },
    );
  }

  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "not-signed-in" }, { status: 401 });
  }

  return NextResponse.json({ photos: await listPhotos(session.user.id) });
}

export async function POST(request: Request) {
  if (!cloudSaveConfigured) {
    return NextResponse.json(
      { error: "cloud-save-not-configured" },
      { status: 501 },
    );
  }

  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "not-signed-in" }, { status: 401 });
  }

  let body: { src?: string; area?: string; clock?: string; phase?: string };

  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "bad-json" }, { status: 400 });
  }

  const match = /^data:image\/jpeg;base64,([A-Za-z0-9+/=]+)$/.exec(
    body.src ?? "",
  );

  // A JPEG data URL, and nothing else. The client is the only thing that posts
  // here, but "the client is the only thing that posts here" is an assumption,
  // not a guarantee, and this row gets served back out as an image later.
  if (!match) {
    return NextResponse.json({ error: "not-a-jpeg" }, { status: 400 });
  }

  const image = Buffer.from(match[1], "base64");

  if (image.length === 0 || image.length > MAX_PHOTO_BYTES) {
    return NextResponse.json({ error: "bad-size" }, { status: 413 });
  }

  // The magic number. A base64 blob that decodes to something which is not a
  // JPEG has no business being stored and handed back with an image/jpeg header.
  if (image[0] !== 0xff || image[1] !== 0xd8) {
    return NextResponse.json({ error: "not-a-jpeg" }, { status: 400 });
  }

  const id = crypto.randomUUID();

  // The owner comes from the session, never from the payload. Otherwise anyone
  // could file a photograph in somebody else's album.
  const result = await savePhoto(session.user.id, {
    id,
    area: String(body.area ?? "Frick Park").slice(0, 80),
    clock: String(body.clock ?? "").slice(0, 20),
    phase: String(body.phase ?? "").slice(0, 20),
    image,
  });

  // The album is full. This is a 409 rather than a 507 or a silent success:
  // there is a conflict with the state of the album, the player can resolve it,
  // and the only honest thing to do is tell them so.
  if (!result.ok) {
    return NextResponse.json(
      { error: result.reason, limit: MAX_PHOTOS },
      { status: 409 },
    );
  }

  return NextResponse.json({ id, takenAt: Date.now() });
}
