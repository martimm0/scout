import type { Metadata } from "next";
import { notFound } from "next/navigation";

import {
  getAnalytics,
  listAccounts,
  listWaitlist,
} from "@/lib/accounts";
import { auth } from "@/lib/auth";
import { env, isAdminEmail } from "@/lib/env";

import { AdminDashboard } from "./admin-dashboard";

export const metadata: Metadata = {
  title: "Admin · Scout",
  robots: { index: false, follow: false },
};

/**
 * The admin tool.
 *
 * Gated to the one admin email, and hidden from everyone else: a stranger who
 * guesses the URL gets the same 404 they would for any page that does not exist,
 * rather than a locked door that tells them there is a room behind it. The gate is
 * the session email, checked on the server, so it cannot be faked from the client.
 */
export default async function AdminPage() {
  const session = await auth();

  if (!isAdminEmail(session?.user?.email)) {
    notFound();
  }

  const [analytics, accounts, waitlist] = await Promise.all([
    getAnalytics(),
    listAccounts(),
    listWaitlist(),
  ]);

  return (
    <main className="page-container">
      <AdminDashboard
        adminEmail={env.adminEmail}
        initialAccounts={accounts}
        initialAnalytics={analytics}
        initialWaitlist={waitlist}
      />
    </main>
  );
}
