"use client";

import { signIn, signOut, useSession } from "next-auth/react";

import styles from "./sign-in.module.css";

/**
 * Sign in with Google.
 *
 * Renders nothing at all when auth isn't configured. A dead "Sign in" button that
 * throws when clicked is worse than no button: it promises something the build
 * cannot deliver.
 */
export function SignIn({ configured }: { configured: boolean }) {
  const { data: session, status } = useSession();

  if (!configured) {
    return null;
  }

  if (status === "loading") {
    return <span className={styles.pending}>…</span>;
  }

  if (session?.user) {
    return (
      <div className={styles.wrap}>
        <span className={styles.who}>{session.user.name ?? "Signed in"}</span>
        <button
          className={styles.button}
          onClick={() => signOut()}
          type="button"
        >
          Sign out
        </button>
      </div>
    );
  }

  return (
    <button
      className={styles.button}
      onClick={() => signIn("google")}
      type="button"
    >
      Sign in with Google
    </button>
  );
}
