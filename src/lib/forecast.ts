import {
  fromWmoCode,
  FAIR_WEATHER,
  type Weather,
} from "@/features/game/world/weather";
import type { ParkId } from "@/features/game/world/park";

/**
 * The live weather over each park, for the home page.
 *
 * The three parks are all in Pittsburgh, a few miles apart, so their skies are
 * nearly the same sky: that is not a bug, it is the city. But they are real
 * places at real coordinates, and Open-Meteo will answer for each of them, so the
 * home page shows what it is actually doing over Frick, Schenley and Highland
 * right now. It is the field-notes idea as a lure: a real place, on a real clock,
 * in real weather, before you have even pressed Fly.
 *
 * One request for all three, cached ten minutes, on the server: the same reasons
 * the in-game weather is fetched the way it is.
 */

/**
 * Where the parks actually are, from each one's Wikipedia article.
 *
 * Sourced, not remembered, and it matters that they are: Frick was at
 * 40.4406, -79.9959 for as long as this file has existed, which is not Frick
 * Park. It is about eight kilometres west of it, near downtown. Nothing looked
 * wrong, because Pittsburgh's weather is Pittsburgh's weather and the banner read
 * plausibly either way, which is exactly how a made-up fact survives.
 *
 * Exported, because `api/weather/route.ts` asks Open-Meteo about Frick too and
 * had its own copy of the same wrong number. Two copies of a fact are two chances
 * to be wrong about it.
 */
export const PARK_COORDS: Record<ParkId, { lat: number; lon: number }> = {
  // https://en.wikipedia.org/wiki/Frick_Park
  frick: { lat: 40.4325, lon: -79.905 },
  // https://en.wikipedia.org/wiki/Schenley_Park
  schenley: { lat: 40.4344, lon: -79.9428 },
  // https://en.wikipedia.org/wiki/Highland_Park_(Pittsburgh)
  highland: { lat: 40.478, lon: -79.916 },
};

const PARK_ORDER: ParkId[] = ["frick", "schenley", "highland"];

export type ParkForecast = { park: ParkId; weather: Weather; live: boolean };

type UpstreamCurrent = {
  time?: string;
  temperature_2m?: number;
  weather_code?: number;
  cloud_cover?: number;
  wind_speed_10m?: number;
  precipitation?: number;
};

/** One park's current, from Open-Meteo's `current` block. */
function weatherFrom(current: UpstreamCurrent | undefined): Weather | null {
  if (!current || typeof current.weather_code !== "number") {
    return null;
  }

  const { condition, label } = fromWmoCode(current.weather_code);
  const precipitation = current.precipitation ?? 0;

  const weather: Weather = {
    condition,
    label,
    temperature: current.temperature_2m ?? FAIR_WEATHER.temperature,
    cloudCover: Math.min(1, Math.max(0, (current.cloud_cover ?? 0) / 100)),
    wind: current.wind_speed_10m ?? 0,
    precipitation,
    falling:
      condition === "snow"
        ? "snow"
        : condition === "drizzle" ||
            condition === "rain" ||
            condition === "thunderstorm"
          ? "rain"
          : "none",
    intensity:
      condition === "thunderstorm"
        ? Math.max(0.7, Math.min(1, precipitation / 4))
        : Math.min(1, precipitation / 4),
    observedAt: current.time ?? "",
    // The home banner shows the sky, not the mushrooms, so it does not ask for
    // the rainfall history. Empty reads as a dry spell, which shows no flush.
    recentRain: [],
  };

  if (weather.falling !== "none" && weather.intensity < 0.15) {
    weather.intensity = 0.15;
  }

  return weather;
}

const fallback = (): ParkForecast[] =>
  PARK_ORDER.map((park) => ({ park, weather: FAIR_WEATHER, live: false }));

export async function fetchParkForecasts(): Promise<ParkForecast[]> {
  const lats = PARK_ORDER.map((p) => PARK_COORDS[p].lat).join(",");
  const lons = PARK_ORDER.map((p) => PARK_COORDS[p].lon).join(",");

  const endpoint =
    `https://api.open-meteo.com/v1/forecast` +
    `?latitude=${lats}&longitude=${lons}` +
    `&current=temperature_2m,weather_code,cloud_cover,wind_speed_10m,precipitation` +
    `&timezone=America%2FNew_York`;

  try {
    const response = await fetch(endpoint, { next: { revalidate: 600 } });

    if (!response.ok) {
      return fallback();
    }

    // Multiple locations come back as an array, one location as an object. Fold
    // both to an array so the shape below is the same either way.
    const body = (await response.json()) as
      | { current?: UpstreamCurrent }
      | Array<{ current?: UpstreamCurrent }>;
    const list = Array.isArray(body) ? body : [body];

    return PARK_ORDER.map((park, i) => {
      const weather = weatherFrom(list[i]?.current);
      return weather
        ? { park, weather, live: true }
        : { park, weather: FAIR_WEATHER, live: false };
    });
  } catch {
    return fallback();
  }
}
