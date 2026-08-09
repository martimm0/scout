import { sql } from "@vercel/postgres";

/**
 * Put the database back.
 *
 * The suite signs in as a few dozen invented players, and every one of them
 * leaves a real row behind: the app cannot tell a test's session cookie from
 * anybody else's, which is exactly what makes those tests worth running. The
 * cost is that a full run used to end with more invented accounts in the table
 * than real ones.
 *
 * That matters more than untidiness now the admin tool exists. "Accounts: 10 of
 * 100" is a number somebody reads and acts on, and it was counting Ada, Bo and
 * eight other people who do not exist. Invented players were also taking seats
 * against the ceiling, which is a door policy enforced against nobody.
 *
 * Narrow by construction. `example.com` is reserved by RFC 2606 precisely so it
 * can never belong to a real person, so matching on it cannot reach a player's
 * account however the suite is run. Anything the tests create under some other
 * address is left alone rather than guessed at.
 */
async function main() {
  if (!process.env.POSTGRES_URL && !process.env.DATABASE_URL) {
    // Local mode. Nothing was written, so there is nothing to take back.
    return;
  }

  try {
    const { rows } = await sql<{ user_id: string }>`
      SELECT user_id FROM accounts WHERE LOWER(email) LIKE '%@example.com'
    `;

    for (const { user_id: userId } of rows) {
      try {
        // Progress and photos before the account, so a save can never outlive
        // the row it belonged to.
        await sql`DELETE FROM player_progress WHERE user_id = ${userId}`;
        await sql`DELETE FROM player_photos WHERE user_id = ${userId}`;
        await sql`DELETE FROM accounts WHERE user_id = ${userId}`;
      } catch {
        // Per player, so one row that will not go does not strand the rest.
      }
    }

    // The waitlist fills up from the same invented addresses whenever a test
    // pushes the ceiling down to prove the door works.
    await sql`DELETE FROM waitlist WHERE LOWER(email) LIKE '%@example.com'`;

    if (rows.length > 0) {
      console.log(`[teardown] removed ${rows.length} test accounts`);
    }
  } catch {
    // Nothing here is worth failing a green run over. A row left behind is
    // untidy; a suite reporting failure because it could not tidy up is
    // actively misleading.
  }
}

export default main;
