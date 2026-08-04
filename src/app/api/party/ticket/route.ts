import { encode } from "next-auth/jwt";

import { auth } from "@/lib/auth";
import { env } from "@/lib/env";

/**
 * `GET /api/party/ticket` — a short-lived pass into a garden party.
 *
 * The PartyKit server is on a different host, so the session cookie never
 * reaches it, and being httpOnly the browser cannot read it out to forward it.
 * So the game's own server, which CAN see the session, mints a five-minute
 * ticket signed with the same secret, and the party door verifies it on the
 * other side. No account, no ticket: this is the entire enforcement of "you
 * need an account to join", checked where the session actually is.
 *
 * Five minutes covers the walk from clicking Join to the socket opening, and
 * nothing else. Reconnections fetch a fresh one, so a leaked ticket goes stale
 * before it is interesting.
 */
export async function GET() {
  const session = await auth();

  if (!session?.user?.id) {
    return Response.json(
      { error: "a garden party needs an account" },
      { status: 401 },
    );
  }

  const ticket = await encode({
    token: {
      sub: session.user.id,
      name: session.user.name ?? "A bee",
    },
    secret: env.authSecret || "scout-local-mode-no-signin-possible",
    salt: "scout-party-ticket",
    maxAge: 5 * 60,
  });

  return Response.json({ ticket });
}
