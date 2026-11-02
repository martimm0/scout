import { daylightAt } from "@/features/game/world/daylight";
import { pittsburghMonth, seasonFor } from "@/features/game/world/season";

function cap(text: string) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/**
 * The banner's lead: the season and the time of day in Pittsburgh. Its own
 * module, with no "use client", because the server renders the first one and
 * the visitor's browser every one after it.
 */
export function bannerLineAt(now: Date) {
  const daylight = daylightAt(now);

  return `${cap(seasonFor(pittsburghMonth(now)))} ${daylight.label.toLowerCase()} in Pittsburgh · ${daylight.clock}`;
}
