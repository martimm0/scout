import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Suspended · Scout",
  description: "This account is suspended.",
};

/**
 * Where a suspended account lands, whether it tries to sign in or is already
 * signed in when the play gate checks. Short and without a form: there is no
 * self-service appeal, only a way to reach the person who can lift it.
 */
export default function SuspendedPage() {
  return (
    <main className="page-container">
      <section style={{ maxWidth: "40rem", margin: "3rem auto" }}>
        <p className="eyebrow">Frick Park, Pittsburgh</p>
        <h1>This account is suspended.</h1>
        <p className="lead">
          Your Scout account has been suspended, so it cannot fly the parks right
          now. If you think this is a mistake, reach the person who runs Scout and
          say so.
        </p>
        <p style={{ marginTop: "1.5rem" }}>
          <Link href="/">Back home</Link>
        </p>
      </section>
    </main>
  );
}
