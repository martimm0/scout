"use client";

import { signIn } from "next-auth/react";

import styles from "./sign-in-required.module.css";

/** The one interactive part of the gate, so the gate itself can stay a server component. */
export function SignInButton() {
  return (
    <button
      className={styles.primary}
      onClick={() => signIn("google", { callbackUrl: window.location.pathname })}
      type="button"
    >
      Sign in with Google
    </button>
  );
}
