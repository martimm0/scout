import Image from "next/image";
import Link from "next/link";

import type { Condition } from "@/features/game/world/weather";
import type { ParkId } from "@/features/game/world/park";
import { daylightAt } from "@/features/game/world/daylight";
import { pittsburghMonth, seasonFor } from "@/features/game/world/season";
import { fetchParkForecasts } from "@/lib/forecast";

import styles from "./park-forecast.module.css";

/**
 * The home banner: what the three parks are doing right now.
 *
 * It used to be a reel of pretty frames. This keeps the frames, one per park, and
 * lays the live sky over them: the real weather over Frick, Schenley and Highland,
 * on Pittsburgh's real clock and calendar. The parks share a city, so they often
 * share a sky, which is honest. It is the whole pitch in one glance, a real place
 * on a real clock in real weather, and a way in for each park.
 */

const PARK_META: Record<
  ParkId,
  { label: string; line: string; image: string }
> = {
  frick: {
    label: "Frick",
    line: "A wood with a creek at the bottom.",
    image: "/images/gallery/frick-valley.png",
  },
  schenley: {
    label: "Schenley",
    line: "Panther Hollow, a hundred feet deep.",
    image: "/images/gallery/schenley-hollow.png",
  },
  highland: {
    label: "Highland",
    line: "A lake on top of a hill.",
    image: "/images/gallery/highland-reservoir.png",
  },
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

export async function ParkForecast() {
  const forecasts = await fetchParkForecasts();
  const daylight = daylightAt();
  const season = seasonFor(pittsburghMonth());

  return (
    <div className={styles.forecast}>
      <p className={styles.now}>
        {cap(season)} {daylight.label.toLowerCase()} in Pittsburgh · {daylight.clock}
      </p>

      <div className={styles.parks}>
        {forecasts.map(({ park, weather, live }) => {
          const meta = PARK_META[park];

          return (
            <Link className={styles.park} href="/play" key={park}>
              <Image
                alt={`${meta.label} Park`}
                className={styles.frame}
                fill
                sizes="(max-width: 720px) 100vw, 300px"
                src={meta.image}
              />
              <div className={styles.overlay}>
                <div className={styles.head}>
                  <span className={styles.name}>{meta.label}</span>
                  <span aria-hidden className={styles.glyph}>
                    {GLYPH[weather.condition]}
                  </span>
                </div>
                <p className={styles.line}>{meta.line}</p>
                <p className={styles.weather}>
                  {weather.label}, {Math.round(weather.temperature)}°C
                  {live ? "" : " · fair"}
                </p>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
