import type { Metadata } from "next";

import { auth } from "@/lib/auth";
import { Pocket } from "@/features/game/components/pocket";
import { authConfigured } from "@/lib/env";

export const metadata: Metadata = {
  title: "Pocket · Scout",
  description:
    "Your pollinator, out of the park: a fact a day, questions it will answer, and a camera to stand it in your kitchen.",
};

/**
 * Deliberately NOT behind `requireSignIn`.
 *
 * That gate is all or nothing, and this page has a real signed-out mode: the
 * camera works for anybody, with the default bee and the badge. So it reads the
 * session itself and hands the fact down as a prop, the same way the profile
 * page hands down `authConfigured`, because a client component cannot see env.
 */
export default async function PocketPage() {
  const session = await auth();
  const signedIn = Boolean(session?.user?.id);
  // Local mode has no sign-in, so the save in the browser is simply yours.
  const yours = signedIn || !authConfigured;

  return (
    <main className="page-container">
      <p className="eyebrow">Your pollinator</p>
      <h1>Pocket</h1>
      <p className="lead">
        {yours
          ? "It remembers what you have found, and it will talk about it."
          : "Point your camera at something and put a bee in the picture."}
      </p>
      <Pocket authConfigured={authConfigured} signedIn={signedIn} />
    </main>
  );
}
