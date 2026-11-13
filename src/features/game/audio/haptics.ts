import { useGameStore } from "../state/game-store";

/**
 * Small buzzes, on a phone.
 *
 * The touch controls are a whole second way to play, and until now nothing a
 * thumb did was ever answered in the hand. These are the same moments the new
 * sounds mark: feet down on a flower, a bump into a trunk, a result.
 *
 * Android only, in practice. Safari on an iPhone has no vibration API at all,
 * so `navigator.vibrate` is simply absent there and every call is a no-op.
 * Never on a mouse: a laptop that buzzed would be a fault report.
 */
export type Buzz = "land" | "bump" | "match" | "success" | "fail";

/** Milliseconds on, off, on. Short: these are taps, not alarms. */
const PATTERN: Record<Buzz, number | number[]> = {
  land: 12,
  bump: 28,
  match: 10,
  success: [14, 40, 22],
  fail: 34,
};

export function buzz(kind: Buzz) {
  if (typeof navigator === "undefined" || typeof navigator.vibrate !== "function") {
    return;
  }

  if (typeof window === "undefined" || !window.matchMedia?.("(pointer: coarse)").matches) {
    return;
  }

  // Unset means on.
  if (useGameStore.getState().settings.hapticsOn === false) {
    return;
  }

  navigator.vibrate(PATTERN[kind]);
}
