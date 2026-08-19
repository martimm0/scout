import { track } from "@vercel/analytics";

/**
 * Gameplay events.
 *
 * Page views alone tell you nothing about a game. What matters is the funnel:
 * do people finish the tutorial, do they ever find a plant, do they pollinate
 * one: and, the question this game is actually built around, does a failed
 * pollination make them leave? If failure is driving people off, the twenty
 * percent is wrong and the copy isn't doing its job.
 *
 * Nothing here identifies anybody. There is no user id, no session stitching,
 * and no third-party script, Vercel Analytics is first-party and cookieless,
 * which is why the site needs no consent banner.
 */

export type GameEvent =
  | { name: "tutorial_completed"; withSound: boolean }
  | { name: "plant_discovered"; plant: string }
  | { name: "pollination_attempted"; plant: string; minigame: string }
  | {
      name: "pollination_resolved";
      plant: string;
      success: boolean;
      /** The minigame score, 0 to 1. Without it we cannot tell a hard game
       *  from an unfair one, or know whether failure is what drives people off. */
      minigame: string;
      score: number;
    }
  | { name: "badge_earned"; badge: string }
  | { name: "area_entered"; area: string }
  | { name: "offline_run_finished"; pollinated: number; found: number }
  | { name: "pollinator_customized" };

export function trackEvent(event: GameEvent) {
  const { name, ...properties } = event;

  try {
    track(name, properties as Record<string, string | number | boolean>);
  } catch {
    // Analytics must never be able to break the game. If the endpoint is down,
    // blocked by an extension, or the plan doesn't include custom events, the
    // player should not notice in any way.
  }
}
