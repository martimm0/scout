import { fungusFlush, isPrecipitating, type Weather } from "./weather";

/**
 * The skies worth having been there for.
 *
 * The park has kept Pittsburgh's real weather since it was built, and said
 * nothing about it afterwards. A player who happened to be flying through a
 * thunderstorm saw a thunderstorm and then, forever after, had no record that it
 * ever happened. These are the handful of skies that are genuinely uncommon, and
 * the journal remembers each one you were actually in.
 *
 * Three rules, and they are the reason this is a small list rather than a long
 * one.
 *
 * **They are the real observation, never a roll.** Nothing here can be made to
 * happen. If it has not thundered over Frick Park while you were flying, you do
 * not have the thunderstorm, and no amount of playing will produce it. That is
 * the whole value of them: a weather moment is evidence of a real afternoon.
 *
 * **They cannot be missed, only waited for.** Nothing expires and nothing is
 * exclusive. Pittsburgh gets fog and snow and thunder every year, so every one of
 * these comes round again, which is what keeps them from being a punishment for
 * having started playing in June.
 *
 * **No moment gates anything.** They earn badges and fill a page in the journal.
 * A species, a park and a plant are never behind one, because a player cannot
 * make it rain and the game must never ask them to.
 */

export type WeatherMoment = {
  id: string;
  /** What the journal calls it. */
  name: string;
  /** What you were in the middle of, said once you have it. */
  description: string;
  /** What it takes, for somebody who has not had it yet. */
  hint: string;
};

export const WEATHER_MOMENTS: WeatherMoment[] = [
  {
    id: "thunderstorm",
    name: "Caught in the Storm",
    description:
      "Thunder over the park, and the far bank of the creek gone. A bee this size does not fly in it, and neither should you have been.",
    hint: "Be in the park when it is actually thundering over Pittsburgh.",
  },
  {
    id: "fog",
    name: "The Park in Fog",
    description:
      "Fog closed the wood down to a few dozen feet. You had to fly low and follow the trails, because there were no landmarks left to steer by.",
    hint: "Fog closes the park down to almost nothing. Be here for one.",
  },
  {
    id: "snowfall",
    name: "Snow Falling",
    description:
      "Snow coming down over Frick. Nothing is in bloom, nothing is open, and it is one of the best-looking afternoons the park has.",
    hint: "Be in the park while snow is actually falling on Pittsburgh.",
  },
  {
    id: "hard-freeze",
    name: "Hard Freeze",
    description:
      "Well below freezing. Nothing was flying but you, and you were shivering to do it, the way a real bee warms its flight muscles before it can move at all.",
    hint: "Come out on a genuinely bitter day, several degrees below freezing.",
  },
  {
    id: "downpour",
    name: "A Proper Soaking",
    description:
      "Rain hard enough to fly heavy in. Somewhere under it the mycelium is taking a long drink, and in a few days the wood will be full of mushrooms.",
    hint: "Fly through real rain, the heavy kind rather than a drizzle.",
  },
  {
    id: "flush",
    name: "The Wood Flushing",
    description:
      "You came out in the few days after a soaking, when the mushrooms answer it. This is the one that has nothing to do with the sky you flew under.",
    hint: "Mushrooms come up a few days behind the rain. Be here for those days.",
  },
];

/**
 * Which of them the park is in, right now.
 *
 * Returns ids rather than the moments themselves, because that is what the save
 * holds: a moment is remembered by id forever, and the list can grow later
 * without a migration.
 *
 * The thresholds are the same ones the rest of the game already uses, so the
 * moment agrees with what the player can see. A hard freeze is below minus five
 * Celsius, which is well past the ten degrees that grounds the other foragers and
 * the twelve that starts your own bee shivering. A downpour is the intensity the
 * weather layer is already drawing hard rain at.
 */
export function momentsNow(weather: Weather): string[] {
  const found: string[] = [];

  if (weather.condition === "thunderstorm") {
    found.push("thunderstorm");
  }

  if (weather.condition === "fog") {
    found.push("fog");
  }

  if (weather.falling === "snow") {
    found.push("snowfall");
  }

  // Celsius, like everything the biology reads. Minus five is a real freeze
  // rather than a chilly morning.
  if (weather.temperature <= -5) {
    found.push("hard-freeze");
  }

  // Rain you would notice, not a drizzle. `isPrecipitating` keeps snow out of it.
  if (
    isPrecipitating(weather.condition) &&
    weather.falling === "rain" &&
    weather.intensity >= 0.5
  ) {
    found.push("downpour");
  }

  if (fungusFlush(weather) > 0.55) {
    found.push("flush");
  }

  return found;
}
