import { NextResponse } from "next/server";

import { bumpPartyCounter, type PartyCounter } from "@/lib/accounts";
import { auth } from "@/lib/auth";

/**
 * Counting garden party usage, without recording anybody's afternoon.
 *
 * The room server keeps nothing, deliberately: chat promised to vanish must not
 * sit in a log. But "is anybody using this at all" is a fair question, so the
 * APP counts, and it counts TOTALS rather than events.
 *
 * That distinction is the whole design. A row per join would be a record of who
 * was in a room with whom and when, which is exactly the thing the room refuses
 * to keep. A running total answers the question and describes nobody: there is
 * no user id here, no party id, and no timestamp beyond the counter moving.
 *
 * Signed in only, so a stranger cannot inflate the numbers, but the account is
 * used to check the door and then thrown away rather than written down.
 */

/**
 * A closed set, and deliberately only things that happen once a session.
 *
 * A chat counter lived here and fired a request per line typed, which put a
 * per-message cost back on the one feature built to have none.
 */
const ALLOWED = new Set<PartyCounter>([
  "joins",
  "coop_pollinations",
  "games_played",
]);

export async function POST(request: Request) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "not-signed-in" }, { status: 401 });
  }

  let name: string | undefined;

  try {
    ({ name } = (await request.json()) as { name?: string });
  } catch {
    return NextResponse.json({ error: "bad-request" }, { status: 400 });
  }

  if (!name || !ALLOWED.has(name as PartyCounter)) {
    return NextResponse.json({ error: "unknown-counter" }, { status: 400 });
  }

  await bumpPartyCounter(name as PartyCounter);

  // No body worth reading. This is fire-and-forget from the client's side and
  // must never be something a player waits on.
  return new NextResponse(null, { status: 204 });
}
