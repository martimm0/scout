import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { cloudSaveConfigured } from "@/lib/env";
import { loadProgress, saveProgress, type SavedProgress } from "@/lib/progress";

/**
 * Save and load.
 *
 * Both routes answer honestly when cloud saves aren't configured: 501, with a
 * reason: rather than pretending to work. The client checks for that and stays
 * in local mode instead of silently dropping the player's afternoon into a void.
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

  const progress = await loadProgress(session.user.id);

  return NextResponse.json({ progress });
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

  let body: SavedProgress;

  try {
    body = (await request.json()) as SavedProgress;
  } catch {
    return NextResponse.json({ error: "bad-json" }, { status: 400 });
  }

  // Never trust the client's idea of who it is. The user id comes from the
  // session, not the payload, otherwise anyone could overwrite anyone's save by
  // posting a different id.
  await saveProgress(session.user.id, {
    ...body,
    savedAt: Date.now(),
  });

  return NextResponse.json({ ok: true });
}
