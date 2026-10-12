import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { cloudSaveConfigured } from "@/lib/env";
import {
  MAX_PROGRESS_BYTES,
  loadProgress,
  saveProgress,
  type SavedProgress,
} from "@/lib/progress";

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

  /**
   * Measured before it is parsed, and refused if it is not an object.
   *
   * Read as text first so the size is the size of what arrived, then parsed.
   * The shape check is not the save's validation, which the client's repair
   * merge already does on the way back in; it is the floor under it. An array,
   * a string or a bare null spread into the row as `{ ...body }` produced a
   * save of index keys or of nothing, and stored it as if it were progress.
   */
  let text: string;

  try {
    text = await request.text();
  } catch {
    return NextResponse.json({ error: "bad-json" }, { status: 400 });
  }

  const size = new TextEncoder().encode(text).length;

  if (size === 0 || size > MAX_PROGRESS_BYTES) {
    return NextResponse.json(
      { error: "bad-size", limit: MAX_PROGRESS_BYTES },
      { status: 413 },
    );
  }

  let parsed: unknown;

  try {
    parsed = JSON.parse(text);
  } catch {
    return NextResponse.json({ error: "bad-json" }, { status: 400 });
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return NextResponse.json({ error: "bad-shape" }, { status: 400 });
  }

  const body = parsed as SavedProgress;

  // Never trust the client's idea of who it is. The user id comes from the
  // session, not the payload, otherwise anyone could overwrite anyone's save by
  // posting a different id.
  await saveProgress(session.user.id, {
    ...body,
    savedAt: Date.now(),
  });

  return NextResponse.json({ ok: true });
}
