import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { cloudSaveConfigured } from "@/lib/env";
import { deletePhoto, getPhoto } from "@/lib/photos";

/**
 * One photograph: fetch the bytes, or throw it away.
 *
 * Both are scoped to the signed-in user in the SQL itself, not filtered after
 * the fact. An id is a UUID and unguessable in practice, but "unguessable in
 * practice" is not an access control policy: somebody else's photograph must be
 * a 404 even to somebody holding its id.
 */

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!cloudSaveConfigured) {
    return new NextResponse(null, { status: 501 });
  }

  const session = await auth();

  if (!session?.user?.id) {
    return new NextResponse(null, { status: 401 });
  }

  const { id } = await params;
  const image = await getPhoto(session.user.id, id);

  if (!image) {
    return new NextResponse(null, { status: 404 });
  }

  return new NextResponse(new Uint8Array(image), {
    headers: {
      "Content-Type": "image/jpeg",
      // A photograph never changes, so it can be cached hard. Private, because
      // it belongs to one person and must not sit in a shared cache.
      "Cache-Control": "private, max-age=31536000, immutable",
    },
  });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
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

  const { id } = await params;
  await deletePhoto(session.user.id, id);

  return NextResponse.json({ ok: true });
}
