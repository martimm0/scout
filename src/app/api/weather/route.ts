import { NextResponse } from "next/server";

import { fromWmoCode, FAIR_WEATHER, type Weather } from "@/features/game/world/weather";
import { PARK_COORDS } from "@/lib/forecast";

/**
 * The real weather over Frick Park.
 *
 * Fetched on the server and cached for ten minutes, for three reasons. It keeps
 * one upstream request serving every player instead of one per browser; the
 * observation only updates every fifteen minutes anyway, so a fresher fetch would
 * buy nothing; and it means the game is not making a cross-origin call to a third
 * party from the player's machine.
 *
 * Open-Meteo needs no API key and asks for no attribution beyond good manners,
 * which is the only reason this is a feature and not a bill.
 *
 * If it fails, the park gets a fair day. A weather service being down is not a
 * reason for the sky to be missing.
 */

/**
 * Frick Park, Pittsburgh, from the one sourced copy of the parks' coordinates.
 *
 * This used to hold its own pair, 40.4406, -79.9959, which is not Frick Park: it
 * is about eight kilometres west of it. The park has claimed since it was built
 * to pull "the real observation for Frick Park's own coordinates", and for that
 * whole time it was reading downtown's sky instead. Nothing ever looked wrong,
 * because the two skies are usually the same sky.
 */
const { lat: LATITUDE, lon: LONGITUDE } = PARK_COORDS.frick;

/**
 * The sky now, and how wet the last ten days have been.
 *
 * The daily history is for the mushrooms. Fungi fruit two to ten days after a
 * soaking rather than during it, so the flush needs last week's rainfall and the
 * current observation cannot supply it. `past_days=10` covers the whole of that
 * window; `forecast_days=1` keeps today on the end of the array so "how many days
 * ago" is just an index from the back.
 */
const ENDPOINT =
  `https://api.open-meteo.com/v1/forecast` +
  `?latitude=${LATITUDE}&longitude=${LONGITUDE}` +
  `&current=temperature_2m,weather_code,cloud_cover,wind_speed_10m,precipitation` +
  `&daily=precipitation_sum&past_days=10&forecast_days=1` +
  `&timezone=America%2FNew_York`;

type Upstream = {
  current?: {
    time?: string;
    temperature_2m?: number;
    weather_code?: number;
    cloud_cover?: number;
    wind_speed_10m?: number;
    precipitation?: number;
  };
  daily?: {
    time?: string[];
    precipitation_sum?: (number | null)[];
  };
};

export async function GET() {
  try {
    const response = await fetch(ENDPOINT, {
      // Ten minutes. The observation itself only moves every fifteen.
      next: { revalidate: 600 },
    });

    if (!response.ok) {
      return NextResponse.json({ weather: FAIR_WEATHER, live: false });
    }

    const body = (await response.json()) as Upstream;
    const current = body.current;

    if (!current || typeof current.weather_code !== "number") {
      return NextResponse.json({ weather: FAIR_WEATHER, live: false });
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
      // A drizzle is 0.1mm/h and a downpour is 8. Anything past 4 looks the same
      // through a windscreen, and this is a windscreen.
      intensity:
        condition === "thunderstorm"
          ? Math.max(0.7, Math.min(1, precipitation / 4))
          : Math.min(1, precipitation / 4),
      observedAt: current.time ?? "",
      // Nulls happen: the daily series can have gaps. A gap is not a downpour,
      // so it reads as a dry day rather than being dropped, which would shift
      // every other day's position in the array and move the flush window.
      recentRain: (body.daily?.precipitation_sum ?? []).map((mm) =>
        typeof mm === "number" && Number.isFinite(mm) ? mm : 0,
      ),
    };

    // A "rain" code with no measured precipitation is still rain: the gauge is
    // hourly and the shower may have just started. Give it something to draw.
    if (weather.falling !== "none" && weather.intensity < 0.15) {
      weather.intensity = 0.15;
    }

    return NextResponse.json({ weather, live: true });
  } catch {
    return NextResponse.json({ weather: FAIR_WEATHER, live: false });
  }
}
