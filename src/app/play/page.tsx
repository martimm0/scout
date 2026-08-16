import type { Metadata } from "next";

import { requireSignIn } from "@/features/auth/components/sign-in-required";
import { GameScene } from "@/features/game/components/game-scene";
import { weatherPreset } from "@/features/game/world/weather";
import { PARKS, type ParkId } from "@/features/game/world/terrain";

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

  // `?month=7` pins the park's calendar. Same reason as `?hour=`: half the flora
  // is out of season at any month, so the suite pins one where its target plants
  // are actually in bloom instead of failing every winter.
  const rawMonth = Number(params.month);
  const month =
    Number.isFinite(rawMonth) && rawMonth >= 1 && rawMonth < 13
      ? rawMonth
      : undefined;

  /**
   * `?park=schenley` builds a park directly.
   *
   * It does NOT grant the unlock: the picker and the in-game warp still require
   * you to have found half of Frick's flowers, and nothing in the save file
   * changes. This only says which world to build, which is what makes it useful
   * for testing and for showing somebody the second park without asking them to
   * play the first one first.
   *
   * It was gated behind `?debug` at first, which meant you could not look at
   * Schenley without a developer overlay stapled across the screen. The lock here
   * paces discovery; it is not a security boundary, and a single-player game whose
   * progress lives in the player's own browser was never going to pretend
   * otherwise.
   */
  const debug = "debug" in params;

  // Checked against the park registry rather than a hand-written list. The list
  // said `frick | schenley`, so the day Highland was added `?park=highland`
  // silently loaded Frick instead: no error, no warning, just the wrong park.
  const requested = String(params.park ?? "");
  const park = requested in PARKS ? (requested as ParkId) : undefined;

  // `?weather=rain` pins the sky. Same idea as `?hour=`: the real weather is the
  // real weather, so on a fine day there is otherwise no way to look at the rain,
  // and no way for a test to check it falls.
  const weather = weatherPreset(String(params.weather ?? ""));

  /**
   * `?busy=on` puts another insect on every flower; `?busy=off` clears them all.
   *
   * The same reasoning as `?weather=`. Which flowers have somebody on them is a
   * function of the wall clock, so without this a test would have to wait for
   * the meadow to come round to the flower it is standing on, and would be
   * asserting against a moving target when it got there.
   */
  const raw_busy = String(params.busy ?? "");
  const busy = raw_busy === "on" || raw_busy === "off" ? raw_busy : undefined;

  return (
    <GameScene
      busy={busy}
      debug={debug}
      hour={hour}
      month={month}
      park={park}
      weather={weather}
    />
  );
}
