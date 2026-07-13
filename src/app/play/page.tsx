import type { Metadata } from "next";

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
  const params = await searchParams;

  return <GameScene debug={"debug" in params} />;
}
