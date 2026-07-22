import Link from "next/link";
import { redirect } from "next/navigation";

import { isSuspended } from "@/lib/accounts";
import { auth } from "@/lib/auth";
import { authConfigured } from "@/lib/env";
import { SignInButton } from "./sign-in-button";
import styles from "./sign-in-required.module.css";

/**
 * The gate on the saved game.
 *
 * The park keeps a record of you: what you have found, where you have been, what
 * you have learned. That record has to belong to somebody, and an anonymous
 * visitor is nobody. So the save file, and the two screens that show it, are
 * behind a sign-in.
 *
 * **Not** behind it: the ten-minute run. It saves nothing by design, so there is
 * nothing to own and nobody to ask. Anyone can fly it, and that is the way in
 * for a player who is not ready to hand over a Google account to look at some
 * flowers.
 *
 * When auth is NOT configured, this gate does not exist. On a fresh clone with an
 * empty `.env` there is no sign-in to offer, so gating the game behind one would
 * simply make it unplayable: the whole point of local mode is that the game runs.
 */
export async function requireSignIn() {
  if (!authConfigured) {
    return null;
  }

  const session = await auth();

  if (session?.user) {
    // A suspension has to bite even on a session that is already signed in, not
    // only at the next sign-in, so the gate checks it here. Fails open: a missing
    // account row or a database hiccup reads as "not suspended", so no real player
    // is locked out by an outage.
    if (session.user.id && (await isSuspended(session.user.id))) {
      redirect("/suspended");
    }

    return null;
  }

  return (
    <main className="page-container">
      <section className={styles.gate}>
        <p className="eyebrow">Frick Park, Pittsburgh</p>
        <h1>Sign in to fly</h1>
        <p className="lead">
          The park remembers you: the plants you found, the fungi you turned up
          after dark, the quizzes you passed, the corners you have been to. That
          record has to belong to somebody, so it is kept against your account
          rather than against a browser you might not be sitting at tomorrow.
        </p>

        <div className={styles.actions}>
          <SignInButton />
          <Link className={styles.secondary} href="/offline">
            Or take the ten-minute run
          </Link>
        </div>

        <p className={styles.note}>
          The ten-minute run needs no account. It saves nothing, which is exactly
          why it can ask nothing of you.
        </p>
      </section>
    </main>
  );
}
