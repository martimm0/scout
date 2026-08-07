import { NextResponse } from "next/server";

import {
  adminSetUsername,
  deleteAccount,
  getAnalytics,
  listAccounts,
  listWaitlist,
  removeFromWaitlist,
  resetProgressFor,
  setAccountStatus,
  setCeiling,
} from "@/lib/accounts";
import { auth } from "@/lib/auth";
import { getInsights } from "@/lib/insights";
import { env, isAdminEmail } from "@/lib/env";

/**
 * The admin tool's back end.
 *
 * Every route here is behind the one admin email. A request from anyone else gets
 * a 404, not a 403: the tool does not announce itself to people who are not
 * allowed in. The check reads the email off the SESSION, never the request body,
 * so it cannot be spoofed.
 */

async function requireAdmin() {
  const session = await auth();
  return isAdminEmail(session?.user?.email) ? session : null;
}

const notFound = () =>
  NextResponse.json({ error: "not-found" }, { status: 404 });

export async function GET() {
  if (!(await requireAdmin())) {
    return notFound();
  }

  const [analytics, accounts, waitlist, insights] = await Promise.all([
    getAnalytics(),
    listAccounts(),
    listWaitlist(),
    getInsights(),
  ]);

  return NextResponse.json({ analytics, accounts, waitlist, insights });
}

/**
 * A real number, or nothing. Deliberately NOT `Number(value)`.
 *
 * `Number` is far too willing: `Number(null)` is 0, and so are `Number("")`,
 * `Number(false)` and `Number([])`. A ceiling arriving as null would have been
 * read as a perfectly good zero and shut the door on every new account, with a
 * 200 and no complaint. A numeric string is allowed because a form field is a
 * reasonable thing to send; everything else is a mistake worth refusing.
 */
function asFiniteNumber(value: unknown): number | null {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);

    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

type Action =
  | { action: "setCeiling"; ceiling: unknown }
  | { action: "suspend"; userId: string }
  | { action: "unsuspend"; userId: string }
  | { action: "delete"; userId: string }
  | { action: "setUsername"; userId: string; username: unknown }
  | { action: "resetProgress"; userId: string }
  | { action: "removeWaitlist"; email: string };

export async function POST(request: Request) {
  if (!(await requireAdmin())) {
    return notFound();
  }

  let body: Action;

  try {
    body = (await request.json()) as Action;
  } catch {
    return NextResponse.json({ error: "bad-json" }, { status: 400 });
  }

  // The admin cannot suspend or delete themselves out of the tool. A locked-out
  // owner has no way back in, so this refuses rather than lets them.
  if (body.action === "suspend" || body.action === "delete") {
    const target = (await listAccounts()).find((a) => a.userId === body.userId);

    if (target && isAdminEmail(target.email)) {
      return NextResponse.json(
        { error: "cannot-act-on-self" },
        { status: 400 },
      );
    }
  }

  switch (body.action) {
    case "setCeiling": {
      // Say no out loud. A ceiling that will not parse used to be stored as the
      // string "NaN", which the read side then could not parse either and quietly
      // replaced with the default hundred.
      const ceiling = asFiniteNumber(body.ceiling);

      if (ceiling === null || !(await setCeiling(ceiling))) {
        return NextResponse.json({ error: "bad-ceiling" }, { status: 400 });
      }

      break;
    }
    case "suspend":
      await setAccountStatus(body.userId, "suspended");
      break;
    case "unsuspend":
      await setAccountStatus(body.userId, "active");
      break;
    case "delete":
      await deleteAccount(body.userId);
      break;
    case "setUsername": {
      if (typeof body.username !== "string") {
        return NextResponse.json({ error: "bad-username" }, { status: 400 });
      }

      const result = await adminSetUsername(body.userId, body.username);

      if (result === "taken") {
        return NextResponse.json({ error: "taken" }, { status: 409 });
      }

      if (result !== "ok") {
        return NextResponse.json({ error: result }, { status: 400 });
      }

      break;
    }
    case "resetProgress":
      /**
       * Wipes the save, keeps the account.
       *
       * Deliberately allowed on the admin's own row, unlike suspend and delete:
       * wiping your own progress is a thing you might genuinely want, and it
       * cannot lock you out of the tool the way suspending yourself would.
       */
      await resetProgressFor(body.userId);
      break;
    case "removeWaitlist":
      await removeFromWaitlist(body.email);
      break;
    default:
      return NextResponse.json({ error: "unknown-action" }, { status: 400 });
  }

  const [analytics, accounts, waitlist, insights] = await Promise.all([
    getAnalytics(),
    listAccounts(),
    listWaitlist(),
    getInsights(),
  ]);

  // Echo `env.adminEmail` so the client can grey out the admin's own row without
  // shipping the address as a literal.
  return NextResponse.json({
    ok: true,
    analytics,
    accounts,
    waitlist,
    insights,
    adminEmail: env.adminEmail,
  });
}
