/**
 * Environment, and what the app is allowed to assume about it.
 *
 * Everything here is optional. Scout has to run with an empty `.env`, no Google
 * client, no database, because that is how it runs on a fresh clone, and a game
 * that crashes on boot because nobody configured OAuth is a game nobody plays.
 *
 * With the variables absent the app runs in **local mode**: progress lives in
 * localStorage, sign-in is hidden, and nothing on screen promises a feature that
 * isn't there. With them present, sign-in and server autosave light up on their
 * own. No code path is conditional on a boolean somebody has to remember to flip.
 */

export const env = {
  // Auth.js v5 reads AUTH_*; the older NEXTAUTH_* names are accepted too, since
  // that's what .env.example shipped with.
  authSecret: process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET ?? "",
  googleClientId:
    process.env.AUTH_GOOGLE_ID ?? process.env.GOOGLE_CLIENT_ID ?? "",
  googleClientSecret:
    process.env.AUTH_GOOGLE_SECRET ?? process.env.GOOGLE_CLIENT_SECRET ?? "",
  // Vercel Postgres injects POSTGRES_URL; a plain Neon/Postgres string works too.
  databaseUrl: process.env.POSTGRES_URL ?? process.env.DATABASE_URL ?? "",
  assetBaseUrl: process.env.NEXT_PUBLIC_ASSET_BASE_URL ?? "",
  // Who gets the admin door. The owner's address, overridable for a fork.
  adminEmail: (
    process.env.ADMIN_EMAIL ?? "martin.mufuka.miles@gmail.com"
  ).toLowerCase(),
} as const;

/** True for the one account allowed into the admin tool. */
export function isAdminEmail(email: string | null | undefined): boolean {
  return Boolean(email) && email!.toLowerCase() === env.adminEmail;
}

/** True only when Google sign-in is fully configured. */
export const authConfigured = Boolean(
  env.googleClientId && env.googleClientSecret && env.authSecret,
);

/** True only when there is somewhere to save to. */
export const databaseConfigured = Boolean(env.databaseUrl);

/** Cloud saves need both: somebody to save for, and somewhere to put it. */
export const cloudSaveConfigured = authConfigured && databaseConfigured;
