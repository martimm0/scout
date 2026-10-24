import { expect, test } from "@playwright/test";

import { registerAccount } from "./helpers";

/**
 * The waitlist is a queue, which is what its page says it is.
 *
 * "When a place opens up, it opens up in order." Sign-in admitted whoever
 * signed in next while there was room, so a place freed by the admin went to
 * a stranger who had never waited, ahead of everybody on the list. Asked of
 * the real `registerSignIn` with one seat free.
 */
test("a free seat goes to the person who has waited longest, not to whoever arrives", async () => {
  // Any registration, so the suite's database URL is loaded for the import.
  const ok = await registerAccount("waitlist-probe", "waitlist-probe@example.com");
  test.skip(!ok, "no database configured");

  const { sql } = await import("@vercel/postgres");
  const accounts = await import("../src/lib/accounts");
  const before = await accounts.getCeiling();
  const oneSeatFree = async () => {
    const { rows } = await sql<{ n: number }>`SELECT count(*)::int AS n FROM accounts`;

    await accounts.setCeiling(rows[0].n + 1);
  };

  await sql`DELETE FROM accounts WHERE user_id IN ('queue-first', 'queue-jumper')`;
  await sql`DELETE FROM waitlist WHERE email IN ('queue-first@example.com', 'queue-jumper@example.com')`;
  await sql`INSERT INTO waitlist (email, created_at) VALUES ('queue-first@example.com', now() - interval '1 day')`;

  try {
    await oneSeatFree();
    expect(
      await accounts.registerSignIn({
        userId: "queue-jumper",
        email: "queue-jumper@example.com",
        name: "Jumper",
      }),
      "a newcomer took the seat ahead of somebody who had waited a day",
    ).toBe("waitlisted");

    await oneSeatFree();
    expect(
      await accounts.registerSignIn({
        userId: "queue-first",
        email: "queue-first@example.com",
        name: "First",
      }),
    ).toBe("ok");

    const { rows } = await sql`SELECT 1 FROM waitlist WHERE email = 'queue-first@example.com'`;
    expect(rows, "admitted, and still on the list").toHaveLength(0);
  } finally {
    await accounts.setCeiling(before);
  }
});

test("somebody already let in does not hold a place in the queue", async () => {
  /**
   * Until the queue existed, being let in never took you off the list, so the
   * list still holds people who have had an account for weeks. Counted as
   * waiting, they stood ahead of every newcomer: enough of them and a free
   * seat could never be taken by anybody new at all.
   */
  const ok = await registerAccount("queue-stale", "queue-stale@example.com");
  test.skip(!ok, "no database configured");

  const { sql } = await import("@vercel/postgres");
  const accounts = await import("../src/lib/accounts");
  const before = await accounts.getCeiling();

  await sql`DELETE FROM accounts WHERE user_id = 'queue-newcomer'`;
  await sql`DELETE FROM waitlist WHERE email IN ('queue-stale@example.com', 'queue-newcomer@example.com')`;
  // In, and still on the list from before admission took people off it.
  await sql`INSERT INTO waitlist (email, created_at) VALUES ('queue-stale@example.com', now() - interval '30 days')`;

  try {
    const { rows } = await sql<{ n: number }>`SELECT count(*)::int AS n FROM accounts`;
    const { rows: waiting } = await sql<{ n: number }>`
      SELECT count(*)::int AS n FROM waitlist w
      WHERE NOT EXISTS (SELECT 1 FROM accounts a WHERE a.email = w.email)
    `;

    // Exactly enough seats for everybody genuinely waiting, plus one.
    await accounts.setCeiling(rows[0].n + waiting[0].n + 1);

    expect(
      await accounts.registerSignIn({
        userId: "queue-newcomer",
        email: "queue-newcomer@example.com",
        name: "Newcomer",
      }),
      "a player who already has an account was counted as waiting",
    ).toBe("ok");
  } finally {
    await accounts.setCeiling(before);
  }
});
