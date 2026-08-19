import NextAuth from "next-auth";
import Google from "next-auth/providers/google";

import { registerSignIn } from "./accounts";
import { authConfigured, env } from "./env";

/**
 * Google sign-in.
 *
 * The provider list is empty when Google isn't configured. Auth.js is perfectly
 * happy with that: `auth()` simply returns no session, which is what lets the
 * whole game run on a fresh clone with an empty `.env` instead of exploding at
 * import time.
 *
 * Sessions are JWT-backed rather than database-backed. The only thing we need to
 * know about a player is a stable id to hang their save file on, and a JWT gives
 * us that without a second round-trip to Postgres on every request.
 */
export const { auth, handlers, signIn, signOut } = NextAuth({
  providers: authConfigured
    ? [
        Google({
          clientId: env.googleClientId,
          clientSecret: env.googleClientSecret,
        }),
      ]
    : [],
  // Auth.js throws "there was a problem with the server configuration" on every
  // session fetch if it has no secret, which, with an empty .env, means the
  // console fills with errors and SessionProvider never settles. With no
  // providers configured nobody can sign in anyway, so a placeholder secret is
  // harmless and keeps local mode genuinely silent.
  secret: env.authSecret || "scout-local-mode-no-signin-possible",
  session: { strategy: "jwt" },
  callbacks: {
    /**
     * The door policy, run once per sign-in.
     *
     * An existing account is let back in; a new one only if there is a seat under
     * the ceiling; a suspended one is turned away; and everyone past the ceiling
     * is put on the waitlist and sent to a page that says so. Returning a URL from
     * here redirects there instead of completing the sign-in.
     */
    async signIn({ profile }) {
      if (!profile?.sub) {
        return true;
      }

      const result = await registerSignIn({
        userId: profile.sub,
        email: typeof profile.email === "string" ? profile.email : null,
        name: typeof profile.name === "string" ? profile.name : null,
      });

      if (result === "waitlisted") {
        return "/waitlist";
      }

      if (result === "suspended") {
        return "/suspended";
      }

      return true;
    },
    jwt({ token, profile }) {
      // Google's `sub` is the stable, permanent user id. The email is not, people
      // change them, and a save file keyed on an email quietly detaches from its
      // owner the day they do.
      if (profile?.sub) {
        token.sub = profile.sub;
      }

      return token;
    },
    session({ session, token }) {
      if (token.sub) {
        session.user.id = token.sub;
      }

      return session;
    },
  },
});
