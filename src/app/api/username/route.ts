import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { getUsername, setUsername } from "@/lib/accounts";
import { usernameProblem, usernameProblemSays } from "@/lib/username";

/**
 * Choosing what you are called.
 *
 * `GET` answers what this account is called, or null if it has not chosen. The
 * whole prompting flow hangs off that null: there is no separate "has been
 * asked" flag, because a flag can disagree with the thing it describes.
 *
 * `POST` claims a name. The rules are checked HERE as well as in the form, and
 * that is not belt and braces: the form is a courtesy to somebody typing, and
 * this is the thing that actually decides. A disabled button is a suggestion.
 */

export async function GET() {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "not-signed-in" }, { status: 401 });
  }

  return NextResponse.json({ username: await getUsername(session.user.id) });
}

export async function POST(request: Request) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "not-signed-in" }, { status: 401 });
  }

  let wanted = "";

  try {
    const body = (await request.json()) as { username?: unknown };

    wanted = typeof body.username === "string" ? body.username.trim() : "";
  } catch {
    return NextResponse.json({ error: "bad-request" }, { status: 400 });
  }

  const problem = usernameProblem(wanted);

  if (problem) {
    return NextResponse.json(
      { error: problem, says: usernameProblemSays(problem) },
      { status: 400 },
    );
  }

  const result = await setUsername(session.user.id, wanted);

  if (result === "taken") {
    return NextResponse.json(
      { error: "taken", says: usernameProblemSays("taken") },
      { status: 409 },
    );
  }

  if (result === "unavailable") {
    // No database. Local mode has no accounts to be unique against, so there
    // is nothing honest to say except that this cannot be saved.
    return NextResponse.json(
      { error: "unavailable", says: "Names cannot be saved in local mode." },
      { status: 501 },
    );
  }

  if (result === "no-account") {
    /**
     * Signed in, but no account row. That means the account was deleted while
     * this session was still valid, so the honest answer is that there is
     * nothing to attach a name to, NOT to make a row and let them back in.
     */
    return NextResponse.json({ error: "no-account" }, { status: 403 });
  }

  if (result === "invalid") {
    return NextResponse.json({ error: "invalid" }, { status: 400 });
  }

  return NextResponse.json({ username: wanted });
}
