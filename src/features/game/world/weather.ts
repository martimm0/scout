import type { Daylight } from "./daylight";

/**
 * The weather over Pittsburgh, right now, actually.
 *
 * Not a simulation and not a random roll: the park pulls the real observation for
 * Frick Park's own coordinates and renders what is genuinely happening outside
 * the window. If it is raining in Squirrel Hill it is raining in the game.
 *
 * That is the whole point of the thing. Scout is supposed to be a way to nerd out
 * about plants when it is raining outside, and a game that answers "it is raining
 * outside" with a cloudless summer meadow is quietly telling you it is somewhere
 * else. The park keeps Pittsburgh's clock; it should keep Pittsburgh's sky.
 *
 * Consequences worth knowing, because they are the point rather than side effects:
 * an overcast day is genuinely dimmer and harder to spot a flower in, fog closes
 * the park down to a few dozen units of visibility, and in a thunderstorm you can
 * barely see the far bank of the creek.
 */

export type Condition =
  | "clear"
  | "cloudy"
  | "overcast"
  | "fog"
  | "drizzle"
  | "rain"
  | "snow"
  | "thunderstorm";

export type Weather = {
  condition: Condition;
  /** "Light rain". Shown to the player. */
  label: string;
  /** Celsius. */
  temperature: number;
  /** 0 to 1. */
  cloudCover: number;
  /** km/h. Blows the rain sideways and drags the clouds across. */
  wind: number;
  /** mm in the last hour. */
  precipitation: number;
  /** What is falling out of the sky, if anything. */
  falling: "none" | "rain" | "snow";
  /** How hard, 0 to 1. */
  intensity: number;
  /** When the observation was taken, in Pittsburgh. */
  observedAt: string;
};

/** What the park looks like when nobody can reach the weather service. */
export const FAIR_WEATHER: Weather = {
  condition: "clear",
  label: "Clear",
  temperature: 18,
  cloudCover: 0.1,
  wind: 6,
  precipitation: 0,
  falling: "none",
  intensity: 0,
  observedAt: "",
};

/**
 * WMO weather codes, which is what every weather service in the world speaks and
 * what nobody can read without a table. This is the table.
 */
export function fromWmoCode(code: number): { condition: Condition; label: string } {
  if (code === 0) return { condition: "clear", label: "Clear" };
  if (code === 1) return { condition: "clear", label: "Mostly clear" };
  if (code === 2) return { condition: "cloudy", label: "Partly cloudy" };
  if (code === 3) return { condition: "overcast", label: "Overcast" };
  if (code === 45 || code === 48) return { condition: "fog", label: "Fog" };

  if (code >= 51 && code <= 57) {
    return { condition: "drizzle", label: "Drizzle" };
  }

  if (code === 61) return { condition: "rain", label: "Light rain" };
  if (code === 63) return { condition: "rain", label: "Rain" };
  if (code === 65) return { condition: "rain", label: "Heavy rain" };
  if (code === 66 || code === 67) {
    return { condition: "rain", label: "Freezing rain" };
  }

  if (code === 71) return { condition: "snow", label: "Light snow" };
  if (code === 73) return { condition: "snow", label: "Snow" };
  if (code === 75) return { condition: "snow", label: "Heavy snow" };
  if (code === 77) return { condition: "snow", label: "Snow grains" };

  if (code === 80) return { condition: "rain", label: "Light showers" };
  if (code === 81) return { condition: "rain", label: "Showers" };
  if (code === 82) return { condition: "rain", label: "Violent showers" };
  if (code === 85 || code === 86) {
    return { condition: "snow", label: "Snow showers" };
  }

  if (code >= 95) return { condition: "thunderstorm", label: "Thunderstorm" };

  return { condition: "cloudy", label: "Cloudy" };
}

export function isPrecipitating(condition: Condition) {
  return (
    condition === "drizzle" ||
    condition === "rain" ||
    condition === "snow" ||
    condition === "thunderstorm"
  );
}

/**
 * The weather, folded into the light.
 *
 * The daylight module already decides what the sun is doing at this hour. This
 * takes that answer and puts a sky over it: cloud eats the sun and flattens the
 * shadows, rain greys the whole world down, and fog closes it in until the far
 * bank of the creek is a rumour.
 *
 * It is applied ON TOP of the hour rather than replacing it, so a wet dawn is
 * still recognisably a dawn: dim, pink, and miserable, which is exactly what a
 * wet dawn is.
 */
export function applyWeather(daylight: Daylight, weather: Weather): Daylight {
  const { cloudCover, condition, intensity } = weather;

  // Cloud eats the sun. Under a solid overcast the direct light is almost gone
  // and what is left is ambient bounce, which is why an overcast day has no
  // shadows in it.
  const direct = 1 - cloudCover * 0.8;
  const stormy = condition === "thunderstorm" ? 0.55 : 1;

  // Ambient does NOT fall away with cloud. A cloud is a diffuser: it takes the
  // light out of the sun and spreads it across the whole sky. Dimming both is the
  // classic way to make an overcast scene look like a broken night scene.
  const ambient = 1 - cloudCover * 0.15;

  const grey = (hex: string, amount: number) => {
    const r = Number.parseInt(hex.slice(1, 3), 16);
    const g = Number.parseInt(hex.slice(3, 5), 16);
    const b = Number.parseInt(hex.slice(5, 7), 16);
    const mid = (r + g + b) / 3;
    const mix = (channel: number) =>
      Math.round(channel + (mid - channel) * amount)
        .toString(16)
        .padStart(2, "0");

    return `#${mix(r)}${mix(g)}${mix(b)}`;
  };

  // Wet air is grey air.
  const wash = Math.min(0.75, cloudCover * 0.5 + intensity * 0.35);

  // Fog is the big one. Rain halves your sight and a real fog closes the park to
  // almost nothing, which changes how it plays: you have to fly low and follow
  // the trails, because you cannot navigate by landmarks you cannot see.
  const fogScale =
    condition === "fog"
      ? 9
      : condition === "thunderstorm"
        ? 3.2
        : 1 + intensity * 1.8 + cloudCover * 0.4;

  return {
    ...daylight,
    sunIntensity: daylight.sunIntensity * direct * stormy,
    ambientIntensity: daylight.ambientIntensity * ambient * stormy,
    hemiIntensity: daylight.hemiIntensity * ambient,
    sunColor: grey(daylight.sunColor, wash),
    ambientColor: grey(daylight.ambientColor, wash * 0.8),
    fogColor: grey(daylight.fogColor, wash),
    fogDensity: daylight.fogDensity * fogScale,
    // A cloudy sky is a hazier, flatter sky.
    turbidity: daylight.turbidity + cloudCover * 8,
    rayleigh: daylight.rayleigh * (1 - cloudCover * 0.5),
  };
}

/**
 * A named sky, for testing and for looking at.
 *
 * The real weather is the real weather, which means that on a fine day in
 * Pittsburgh there is no way to see the rain you just wrote, and no way for a
 * test to check it. `?weather=rain` pins it. Nothing about the player's progress
 * changes; it only decides what falls out of the sky.
 */
export function weatherPreset(name: string): Weather | undefined {
  switch (name) {
    case "clear":
      return FAIR_WEATHER;
    case "cloudy":
      return {
        ...FAIR_WEATHER,
        condition: "cloudy",
        label: "Partly cloudy",
        cloudCover: 0.55,
      };
    case "overcast":
      return {
        ...FAIR_WEATHER,
        condition: "overcast",
        label: "Overcast",
        cloudCover: 0.95,
      };
    case "fog":
      return {
        ...FAIR_WEATHER,
        condition: "fog",
        label: "Fog",
        cloudCover: 0.8,
        wind: 2,
      };
    case "rain":
      return {
        ...FAIR_WEATHER,
        condition: "rain",
        label: "Rain",
        cloudCover: 0.9,
        wind: 14,
        precipitation: 2.4,
        falling: "rain",
        intensity: 0.6,
      };
    case "storm":
      return {
        ...FAIR_WEATHER,
        condition: "thunderstorm",
        label: "Thunderstorm",
        cloudCover: 1,
        wind: 34,
        precipitation: 7,
        falling: "rain",
        intensity: 1,
        temperature: 19,
      };
    case "snow":
      return {
        ...FAIR_WEATHER,
        condition: "snow",
        label: "Snow",
        cloudCover: 0.9,
        wind: 9,
        precipitation: 1.5,
        falling: "snow",
        intensity: 0.6,
        temperature: -2,
      };
    default:
      return undefined;
  }
}
