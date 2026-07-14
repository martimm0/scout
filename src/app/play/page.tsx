import type { Metadata } from "next";

import { requireSignIn } from "@/features/auth/components/sign-in-required";
import { GameScene } from "@/features/game/components/game-scene";

export const metadata: Metadata = {
  title: "Play · Scout",
  description: "Fly Frick Park as a pollinator.",
};

export default async function PlayPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  // The developer readout is opt-in. Players never see it; `?debug=1` brings it
  // back for us, and the e2e suite reads flight state out of it.
  // The saved game belongs to somebody. Press Fly without an account and you are
  // asked for one, rather than being handed a park whose record of you evaporates.
  const gate = await requireSignIn();

  if (gate) {
    return gate;
  }

  const params = await searchParams;

  // `?hour=13.5` pins the park's clock. Not a player-facing feature: it exists
  // so the tests can find an open flower at three in the morning.
  const raw = Number(params.hour);
  const hour = Number.isFinite(raw) ? ((raw % 24) + 24) % 24 : undefined;

  return <GameScene debug={"debug" in params} hour={hour} />;
}
