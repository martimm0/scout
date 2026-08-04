import type { Metadata } from "next";

import { requireSignIn } from "@/features/auth/components/sign-in-required";
import { PartyPicker } from "@/features/game/components/party-picker";

export const metadata: Metadata = {
  title: "Garden parties · Scout",
  description: "Fly a Pittsburgh park with up to nine other pollinators.",
};

/**
 * The three garden parties.
 *
 * Signed in only, and that is the whole of the enforcement story on this side:
 * the page will not render without a session, and the party server will not
 * open a socket without a ticket that only a session can mint. Neither gate
 * trusts the other.
 *
 * A party does NOT require the park to be unlocked. Highland is a reward for
 * learning Frick when you are playing alone, but being invited somewhere is not
 * the same as earning it, and a friend saying "come to Highland" should not be
 * answered by the game with a locked door. What you find there counts, which is
 * the generous reading and the one that makes an invitation worth accepting.
 */
export default async function PartiesPage() {
  const gate = await requireSignIn();

  if (gate) {
    return gate;
  }

  return <PartyPicker />;
}
