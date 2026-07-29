import { sql } from "@vercel/postgres";

import { databaseConfigured } from "./env";

/**
 * Accounts, the ceiling, and the waitlist.
 *
 * Scout's sessions are JWTs keyed on Google's `sub`, so until now there was no
 * record of WHO had signed in, only of what each anonymous id had found. That is
 * fine for a save file and not enough to run a door policy. This is the door: a
 * row per real account, a hard cap on how many there can be, and a waitlist for
 * everyone who arrives after it is full.
 *
 * Like the save file it creates its tables lazily with `IF NOT EXISTS`, so a
 * fresh deploy is still "set the env vars and go", and every function is a no-op
 * without a database, so the game still runs in local mode with none of this on.
 */

export type AccountStatus = "active" | "suspended";

export type Account = {
  userId: string;
  email: string | null;
  name: string | null;
  status: AccountStatus;
  createdAt: string;
  lastSeen: string;
  /** How far along they are, joined from the save file. */
  pollinated: number;
  discovered: number;
  hasSave: boolean;
};

export type WaitlistEntry = { email: string; createdAt: string };

export type Analytics = {
  ceiling: number;
  accounts: number;
  active: number;
  suspended: number;
  waitlist: number;
  seatsLeft: number;
  /** Accounts with a saved game, and the totals across all of them. */
  withSave: number;
  totalPollinations: number;
  totalDiscoveries: number;
};

/** The starting ceiling, until the admin changes it. A hundred players. */
export const DEFAULT_CEILING = 100;

let schemaReady = false;

async function ensureSchema() {
  if (schemaReady) {
    return;
  }

  await sql`
    CREATE TABLE IF NOT EXISTS accounts (
      user_id    TEXT PRIMARY KEY,
      email      TEXT,
      name       TEXT,
      status     TEXT NOT NULL DEFAULT 'active',
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      last_seen  TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS waitlist (
      email      TEXT PRIMARY KEY,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS admin_settings (
      key   TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )
  `;

  schemaReady = true;
}

export async function getCeiling(): Promise<number> {
  if (!databaseConfigured) {
    return DEFAULT_CEILING;
  }

  await ensureSchema();

  const { rows } = await sql<{ value: string }>`
    SELECT value FROM admin_settings WHERE key = 'account_ceiling'
  `;

  const parsed = rows[0] ? Number.parseInt(rows[0].value, 10) : Number.NaN;

  return Number.isFinite(parsed) ? parsed : DEFAULT_CEILING;
}

/**
 * Refuses a ceiling that is not a number, rather than storing one.
 *
 * `Math.floor(NaN)` is NaN and `String(NaN)` is "NaN", so a bad value used to go
 * into the settings row happily. The read side is defensive and falls back to a
 * hundred when it cannot parse what it finds, which meant a fat-fingered ceiling
 * did not fail: it silently reset the door policy to the default, reopening seats
 * an admin had deliberately closed. The caller gets `false` and can say so.
 */
export async function setCeiling(ceiling: number): Promise<boolean> {
  if (!Number.isFinite(ceiling)) {
    return false;
  }

  if (!databaseConfigured) {
    return true;
  }

  await ensureSchema();

  const value = String(Math.max(0, Math.floor(ceiling)));

  await sql`
    INSERT INTO admin_settings (key, value)
    VALUES ('account_ceiling', ${value})
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
  `;

  return true;
}

async function accountCount(): Promise<number> {
  const { rows } = await sql<{ n: number }>`
    SELECT count(*)::int AS n FROM accounts
  `;

  return rows[0]?.n ?? 0;
}

export type SignInResult = "ok" | "suspended" | "waitlisted";

/**
 * The door.
 *
 * Called for every real sign-in. An account that already exists is let straight
 * back in (unless it has been suspended); a new one is admitted only if there is
 * a seat under the ceiling, and otherwise its email goes on the waitlist and it
 * is turned away.
 *
 * It FAILS OPEN. A transient database error at the door should let a real player
 * in, not lock the whole game out; the ceiling is a soft policy, not a security
 * boundary, and the admin can always suspend later. The one thing this is not is
 * a place to enforce security: it is a courtesy rope, and it is honest about that.
 */
export async function registerSignIn(account: {
  userId: string;
  email: string | null;
  name: string | null;
}): Promise<SignInResult> {
  if (!databaseConfigured) {
    return "ok";
  }

  try {
    await ensureSchema();

    const existing = await sql<{ status: AccountStatus }>`
      SELECT status FROM accounts WHERE user_id = ${account.userId}
    `;

    if (existing.rows[0]) {
      if (existing.rows[0].status === "suspended") {
        return "suspended";
      }

      await sql`
        UPDATE accounts
        SET last_seen = now(), email = ${account.email}, name = ${account.name}
        WHERE user_id = ${account.userId}
      `;

      return "ok";
    }

    const [ceiling, count] = await Promise.all([getCeiling(), accountCount()]);

    if (count >= ceiling) {
      if (account.email) {
        await sql`
          INSERT INTO waitlist (email) VALUES (${account.email})
          ON CONFLICT (email) DO NOTHING
        `;
      }

      return "waitlisted";
    }

    await sql`
      INSERT INTO accounts (user_id, email, name)
      VALUES (${account.userId}, ${account.email}, ${account.name})
      ON CONFLICT (user_id) DO NOTHING
    `;

    return "ok";
  } catch {
    return "ok";
  }
}

/**
 * The account's status, for enforcing a suspension on a session that is already
 * signed in. Returns null when there is no account row (a session from before
 * this table existed, or a test's minted cookie), which reads as "not suspended".
 */
export async function accountStatus(
  userId: string,
): Promise<AccountStatus | null> {
  if (!databaseConfigured) {
    return null;
  }

  try {
    await ensureSchema();

    const { rows } = await sql<{ status: AccountStatus }>`
      SELECT status FROM accounts WHERE user_id = ${userId}
    `;

    return rows[0]?.status ?? null;
  } catch {
    return null;
  }
}

export async function isSuspended(userId: string): Promise<boolean> {
  return (await accountStatus(userId)) === "suspended";
}

export async function listAccounts(): Promise<Account[]> {
  if (!databaseConfigured) {
    return [];
  }

  await ensureSchema();

  // Joined to the save file so the admin can see who is actually playing, not
  // just who signed in once and left.
  const { rows } = await sql<{
    user_id: string;
    email: string | null;
    name: string | null;
    status: AccountStatus;
    created_at: string;
    last_seen: string;
    pollinated: number;
    discovered: number;
    has_save: boolean;
  }>`
    SELECT
      a.user_id,
      a.email,
      a.name,
      a.status,
      a.created_at,
      a.last_seen,
      (SELECT count(*) FROM jsonb_object_keys(p.progress -> 'pollinatedPlants'))::int AS pollinated,
      (SELECT count(*) FROM jsonb_object_keys(p.progress -> 'discoveredPlants'))::int AS discovered,
      (p.user_id IS NOT NULL) AS has_save
    FROM accounts a
    LEFT JOIN player_progress p ON p.user_id = a.user_id
    ORDER BY a.last_seen DESC
  `;

  return rows.map((row) => ({
    userId: row.user_id,
    email: row.email,
    name: row.name,
    status: row.status,
    createdAt: row.created_at,
    lastSeen: row.last_seen,
    pollinated: row.pollinated,
    discovered: row.discovered,
    hasSave: row.has_save,
  }));
}

export async function setAccountStatus(
  userId: string,
  status: AccountStatus,
) {
  if (!databaseConfigured) {
    return;
  }

  await ensureSchema();

  await sql`UPDATE accounts SET status = ${status} WHERE user_id = ${userId}`;
}

/**
 * Delete an account and everything hung off it: the save file and the photo
 * album, keyed by the same id. This frees a seat under the ceiling.
 */
export async function deleteAccount(userId: string) {
  if (!databaseConfigured) {
    return;
  }

  await ensureSchema();

  await sql`DELETE FROM player_progress WHERE user_id = ${userId}`;
  await sql`DELETE FROM player_photos WHERE user_id = ${userId}`;
  await sql`DELETE FROM accounts WHERE user_id = ${userId}`;
}

export async function listWaitlist(): Promise<WaitlistEntry[]> {
  if (!databaseConfigured) {
    return [];
  }

  await ensureSchema();

  const { rows } = await sql<{ email: string; created_at: string }>`
    SELECT email, created_at FROM waitlist ORDER BY created_at ASC
  `;

  return rows.map((row) => ({ email: row.email, createdAt: row.created_at }));
}

export async function removeFromWaitlist(email: string) {
  if (!databaseConfigured) {
    return;
  }

  await ensureSchema();

  await sql`DELETE FROM waitlist WHERE email = ${email}`;
}

export async function getAnalytics(): Promise<Analytics> {
  const ceiling = await getCeiling();

  if (!databaseConfigured) {
    return {
      ceiling,
      accounts: 0,
      active: 0,
      suspended: 0,
      waitlist: 0,
      seatsLeft: ceiling,
      withSave: 0,
      totalPollinations: 0,
      totalDiscoveries: 0,
    };
  }

  await ensureSchema();

  const counts = await sql<{
    accounts: number;
    active: number;
    suspended: number;
  }>`
    SELECT
      count(*)::int AS accounts,
      count(*) FILTER (WHERE status = 'active')::int AS active,
      count(*) FILTER (WHERE status = 'suspended')::int AS suspended
    FROM accounts
  `;

  const waitlist = await sql<{ n: number }>`
    SELECT count(*)::int AS n FROM waitlist
  `;

  const progress = await sql<{
    with_save: number;
    pollinations: number;
    discoveries: number;
  }>`
    SELECT
      count(*)::int AS with_save,
      COALESCE(sum((p.progress -> 'stats' ->> 'pollinationSuccesses')::int), 0)::int AS pollinations,
      COALESCE(sum(dk.n), 0)::int AS discoveries
    FROM player_progress p
    LEFT JOIN LATERAL (
      SELECT count(*)::int AS n FROM jsonb_object_keys(p.progress -> 'discoveredPlants')
    ) dk ON true
  `;

  const row = counts.rows[0];
  const accounts = row?.accounts ?? 0;

  return {
    ceiling,
    accounts,
    active: row?.active ?? 0,
    suspended: row?.suspended ?? 0,
    waitlist: waitlist.rows[0]?.n ?? 0,
    seatsLeft: Math.max(0, ceiling - accounts),
    withSave: progress.rows[0]?.with_save ?? 0,
    totalPollinations: progress.rows[0]?.pollinations ?? 0,
    totalDiscoveries: progress.rows[0]?.discoveries ?? 0,
  };
}
