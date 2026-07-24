import type { Condition } from "@/features/game/world/weather";
import { daylightAt } from "@/features/game/world/daylight";
import { pittsburghMonth, seasonFor } from "@/features/game/world/season";
import { fetchParkForecasts } from "@/lib/forecast";

import styles from "./weather-banner.module.css";

/**
 * A ticker across the very top of the page: the live sky over the three parks,
 * scrolling by on Pittsburgh's real clock and calendar.
 *
 * The parks share a city, so they usually share a sky, which is honest, and the
 * whole thing is real: it is the field-notes idea as the first thing you see. Pure
 * CSS, two copies of the content sliding left as one, so there is no seam and no
 * JavaScript. It holds still for anyone who has asked for less motion.
 */

const PARK_LABEL: Record<string, string> = {
  frick: "Frick",
  schenley: "Schenley",
  highland: "Highland",
};

const GLYPH: Record<Condition, string> = {
  clear: "☀︎",
  cloudy: "⛅︎",
  overcast: "☁︎",
  fog: "🌫︎",
  drizzle: "🌦︎",
  rain: "🌧︎",
  snow: "❄︎",
  thunderstorm: "⛈︎",
};

function cap(text: string) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export async function WeatherBanner() {
  const forecasts = await fetchParkForecasts();
  const daylight = daylightAt();
  const season = seasonFor(pittsburghMonth());

  const items = [
    <span className={styles.lead} key="now">
      {cap(season)} {daylight.label.toLowerCase()} in Pittsburgh · {daylight.clock}
    </span>,
    ...forecasts.map(({ park, weather }) => (
      <span className={styles.item} key={park}>
        <span aria-hidden className={styles.glyph}>
          {GLYPH[weather.condition]}
        </span>
        <span className={styles.park}>{PARK_LABEL[park] ?? park}</span>
        <span className={styles.reading}>
          {weather.label}, {Math.round(weather.temperature)}°C
        </span>
      </span>
    )),
  ];

  return (
    <div
      aria-label="Live weather over the parks"
      className={styles.banner}
      role="marquee"
    >
      {/* Two copies so the loop is seamless: the track slides one copy-width. */}
      <div className={styles.track}>
        <div className={styles.run} aria-hidden={false}>
          {items}
        </div>
        <div className={styles.run} aria-hidden>
          {items}
        </div>
      </div>
    </div>
  );
}
