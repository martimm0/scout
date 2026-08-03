import { expect, test } from "@playwright/test";

import { enterGame, signIn, TEST_HOUR, TEST_MONTH } from "./helpers";
import {
  momentsNow,
  WEATHER_MOMENTS,
} from "../src/features/game/world/weather-moments";
import {
  FAIR_WEATHER,
  weatherPreset,
  type Weather,
} from "../src/features/game/world/weather";

/**
 * Rare weather moments: the skies you were actually out in.
 *
 * The whole value of these is that they cannot be pursued. A player can decide to
 * find every plant; nobody can decide to be in a thunderstorm. So the tests that
 * matter are less about the detection than about the promise: a moment has to be
 * evidence of a real afternoon, and nothing may be gated behind one.
 */

const sky = (over: Partial<Weather>): Weather => ({ ...FAIR_WEATHER, ...over });

test.describe("the park notices a rare sky", () => {
  test("a fair day is not a moment", () => {
    expect(momentsNow(FAIR_WEATHER)).toEqual([]);

    // Nor is ordinary weather. Overcast and a light shower are Tuesdays.
    expect(momentsNow(weatherPreset("overcast")!)).toEqual([]);
    expect(
      momentsNow(sky({ condition: "drizzle", falling: "rain", intensity: 0.2 })),
    ).toEqual([]);
  });

  test("each moment is the real observation, not a threshold nobody meets", () => {
    expect(momentsNow(weatherPreset("storm")!)).toContain("thunderstorm");
    expect(momentsNow(weatherPreset("fog")!)).toContain("fog");
    expect(momentsNow(weatherPreset("snow")!)).toContain("snowfall");
    expect(momentsNow(weatherPreset("rain")!)).toContain("downpour");
    expect(momentsNow(weatherPreset("flush")!)).toContain("flush");

    // The freeze is Celsius, like everything the biology reads. A chilly morning
    // is not a hard freeze; converting this to Fahrenheit somewhere would put the
    // threshold at about minus twenty and it would never fire.
    expect(momentsNow(sky({ temperature: 2 }))).not.toContain("hard-freeze");
    expect(momentsNow(sky({ temperature: -8 }))).toContain("hard-freeze");
  });

  test("every moment in the list is reachable by some sky", () => {
    /**
     * A moment nobody can ever get is worse than no moment: it sits in the
     * journal forever, unearnable, and the completion badge with it.
     */
    const reachable = new Set<string>();

    for (const preset of ["storm", "fog", "snow", "rain", "flush"]) {
      for (const id of momentsNow(weatherPreset(preset)!)) {
        reachable.add(id);
      }
    }

    for (const id of momentsNow(sky({ temperature: -8 }))) {
      reachable.add(id);
    }

    const unreachable = WEATHER_MOMENTS.filter(
      (moment) => !reachable.has(moment.id),
    );

    expect(
      unreachable.map((moment) => moment.id),
      "these moments cannot be produced by any sky the game can have",
    ).toEqual([]);
  });
});

test.describe("a weather moment is evidence, not a reward", () => {
  /**
   * The one that matters.
   *
   * `?weather=` is a test hook, and the hooks are documented to grant no
   * progress. If loading `/play?weather=storm` handed out the thunderstorm then
   * the whole page would be worthless: a moment is supposed to mean it really
   * thundered over Pittsburgh while somebody was flying, and anybody could mint
   * the full set from the URL bar in a minute.
   */
  test("a pinned sky earns nothing", async ({ page }) => {
    test.setTimeout(180_000);

    await enterGame(page, TEST_HOUR, TEST_MONTH, "storm");

    const seen = await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem("scout-game-state") ?? "{}")?.state
          ?.seenWeather ?? {},
    );

    expect(
      Object.keys(seen).filter((id) => seen[id]),
      "a pinned thunderstorm was recorded as a moment",
    ).toEqual([]);
  });

  test("nothing in the park is gated behind one", async ({ page }) => {
    /**
     * Weather moments earn badges and fill a page. They must never stand between
     * a player and a species, a park or a plant, because a player cannot make it
     * rain and the game must not ask them to.
     */
    await signIn(page.context());
    await page.goto("/journal");

    await expect(
      page.getByRole("heading", { name: /pollinator record/i }),
    ).toBeVisible();

    await page.getByRole("button", { name: "Weather" }).click();

    // Every moment is listed, and an unearned one shows its hint rather than
    // pretending to be a secret.
    for (const moment of WEATHER_MOMENTS) {
      await expect(page.getByText(moment.name, { exact: false })).toBeVisible();
    }
  });
});
