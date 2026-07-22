import { NextResponse } from "next/server";

import {
  deleteAccount,
  getAnalytics,
  listAccounts,
  listWaitlist,
  removeFromWaitlist,
  setAccountStatus,
  setCeiling,
} from "@/lib/accounts";
import { auth } from "@/lib/auth";
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

  const [analytics, accounts, waitlist] = await Promise.all([
    getAnalytics(),
    listAccounts(),
    listWaitlist(),
  ]);

  return NextResponse.json({ analytics, accounts, waitlist });
}

type Action =
  | { action: "setCeiling"; ceiling: number }
  | { action: "suspend"; userId: string }
  | { action: "unsuspend"; userId: string }
  | { action: "delete"; userId: string }
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
    case "setCeiling":
      await setCeiling(Number(body.ceiling));
      break;
    case "suspend":
      await setAccountStatus(body.userId, "suspended");
      break;
    case "unsuspend":
      await setAccountStatus(body.userId, "active");
      break;
    case "delete":
      await deleteAccount(body.userId);
      break;
    case "removeWaitlist":
      await removeFromWaitlist(body.email);
      break;
    default:
      return NextResponse.json({ error: "unknown-action" }, { status: 400 });
  }

  const [analytics, accounts, waitlist] = await Promise.all([
    getAnalytics(),
    listAccounts(),
    listWaitlist(),
  ]);

  // Echo `env.adminEmail` so the client can grey out the admin's own row without
  // shipping the address as a literal.
  return NextResponse.json({
    ok: true,
    analytics,
    accounts,
    waitlist,
    adminEmail: env.adminEmail,
  });
}
