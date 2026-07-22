import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Waitlist · Scout",
  description: "Scout is full for now. You are on the list.",
};

/**
 * Where a sign-in lands when the park is full.
 *
 * The ceiling is a real number set in the admin tool, and when it is reached new
 * accounts are turned away here rather than created. Their email is already on the
 * waitlist by the time they read this; there is nothing for them to do but wait,
 * so the page does not pretend there is.
 */
export default function WaitlistPage() {
  return (
    <main className="page-container">
      <section style={{ maxWidth: "40rem", margin: "3rem auto" }}>
        <p className="eyebrow">Frick Park, Pittsburgh</p>
        <h1>The park is full, for now.</h1>
        <p className="lead">
          Scout is small on purpose, and it is at its limit of players. You have
          been added to the waitlist with the address you signed in with. When a
          place opens up, it opens up in order.
        </p>
        <p className="lead">
          Nothing else is needed from you. In the meantime the ten-minute run
          needs no account at all, and it is the whole game, only shorter.
        </p>
        <p style={{ marginTop: "1.5rem" }}>
          <Link href="/offline">Take the ten-minute run</Link> ·{" "}
          <Link href="/">Back home</Link>
        </p>
      </section>
    </main>
  );
}
