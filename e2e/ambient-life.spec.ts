import { expect, test } from "@playwright/test";

import { AMBIENT_COHORTS } from "../src/features/game/data/ambient";
import { FAIR_WEATHER, weatherPreset } from "../src/features/game/world/weather";
import { dismissTutorial, enterGame } from "./helpers";

/**
 * Ambient life.
 *
 * The cheap test first, because the rules are the point: the other things in the
 * park are out exactly when they would really be out, and that gating is pure, so
 * it can be checked without a browser. Then a smoke pass that the park still
 * renders with them in it, by night and by day.
 */

const cohort = (id: string) => {
  const found = AMBIENT_COHORTS.find((c) => c.id === id);

  if (!found) {
    throw new Error(`no ambient cohort ${id}`);
  }

  return found;
};

test.describe("ambient life keeps the park's own hours", () => {
  test("foragers keep bee hours and bee weather", () => {
    const foragers = cohort("foragers");

    expect(foragers.active("midday", FAIR_WEATHER)).toBe(true);
    // Shut after dark, like the flowers they work.
    expect(foragers.active("night", FAIR_WEATHER)).toBe(false);
    // A honeybee does not fly much below ten degrees.
    expect(
      foragers.active("midday", { ...FAIR_WEATHER, temperature: 6 }),
    ).toBe(false);
    // Nor in hard rain.
    expect(foragers.active("midday", weatherPreset("storm")!)).toBe(false);
  });

  test("fireflies want a calm, dry dusk or night", () => {
    const fireflies = cohort("fireflies");

    expect(fireflies.active("night", FAIR_WEATHER)).toBe(true);
    expect(fireflies.active("dusk", FAIR_WEATHER)).toBe(true);
    // Not by day.
    expect(fireflies.active("midday", FAIR_WEATHER)).toBe(false);
    // Not in wind (a thunderstorm blows at 34 km/h).
    expect(fireflies.active("night", weatherPreset("storm")!)).toBe(false);
    // Not in the wet.
    expect(fireflies.active("night", weatherPreset("rain")!)).toBe(false);
  });

  test("birds are out by day and shelter from a storm", () => {
    const birds = cohort("birds");

    expect(birds.active("morning", FAIR_WEATHER)).toBe(true);
    expect(birds.active("night", FAIR_WEATHER)).toBe(false);
    expect(birds.active("afternoon", weatherPreset("storm")!)).toBe(false);
  });

  test("something is always out except deep in a cold clear night", () => {
    // A fair midday has foragers and birds; a fair night has fireflies. There is
    // no ordinary hour where the park is completely still.
    const anyAt = (phase: Parameters<(typeof AMBIENT_COHORTS)[number]["active"]>[0]) =>
      AMBIENT_COHORTS.some((c) => c.active(phase, FAIR_WEATHER));

    expect(anyAt("midday")).toBe(true);
    expect(anyAt("night")).toBe(true);
    expect(anyAt("dusk")).toBe(true);
  });
});

test.describe("the park still renders with life in it", () => {
  test("night mounts fireflies without throwing", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(String(error)));

    await enterGame(page, 22);
    await page.goto("/play?hour=22&weather=clear&debug=1");
    await page.waitForTimeout(3500);
    await dismissTutorial(page);
    await page.waitForTimeout(1500);

    // The canvas is drawing something, not a blank frame.
    const drawn = await page.evaluate(() => {
      const canvas = document.querySelector("canvas") as HTMLCanvasElement;
      const scratch = document.createElement("canvas");
      scratch.width = 64;
      scratch.height = 64;
      const context = scratch.getContext("2d")!;
      context.drawImage(canvas, 0, 0, 64, 64);
      const { data } = context.getImageData(0, 0, 64, 64);
      let sum = 0;
      for (let i = 0; i < data.length; i += 4) {
        sum += data[i] + data[i + 1] + data[i + 2];
      }
      return sum;
    });

    expect(drawn).toBeGreaterThan(0);
    expect(errors, errors.join("\n")).toEqual([]);
  });
});
