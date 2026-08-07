"use client";

import { signIn, signOut, useSession } from "next-auth/react";

import { NavMenu } from "@/components/nav-menu";
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

  /**
   * Signed in: a name and a Sign out button used to sit out on the bar, which
   * on a long name is most of the right-hand side. Folded into a menu of its
   * own now, labelled with the first name so it still says who you are.
   */
  if (session?.user) {
    const name = session.user.name ?? "Signed in";

    return (
      <NavMenu
        label={name.split(" ")[0] || name}
        items={[
          { kind: "note", label: name },
          { kind: "link", href: "/profile", label: "Profile" },
          { kind: "link", href: "/customize", label: "Customize" },
          { kind: "action", label: "Sign out", onSelect: () => void signOut() },
        ]}
      />
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
