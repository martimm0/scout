import { expect, test } from "@playwright/test";

import {
  enterGame,
  flyToPlant,
  nearestPlantToSpawn,
  TEST_HOUR,
  TEST_MONTH,
} from "./helpers";
import {
  FORAGERS,
  OCCUPIED_FRACTION,
  occupancyOf,
  isOccupied,
  VISIT_CYCLE_SECONDS,
  VISIT_SECONDS,
} from "../src/features/game/world/foragers";

/**
 * Somebody got there first, and you can see it coming.
 *
 * The arithmetic here is load-bearing rather than decorative: this is a slice of
 * the one visit in five that the whole game is built on, moved out of a dice
 * roll and into the world. If the fraction drifts, the game starts making a
 * claim its mechanics do not honour, which has happened once already.
 */

test.describe("who is on the flower", () => {
  test("about one flower in twelve is busy at any moment", () => {
    /**
     * Measured, not asserted from the constant.
     *
     * `OCCUPIED_FRACTION` is a statement of intent; whether the schedule
     * actually produces it is a different question, and it is the one that
     * decides the real failure rate. Swept across many flowers AND many moments,
     * because a scheme that is right on average and wrong at any given second
     * would still feel broken.
     */
    let busy = 0;
    let total = 0;

    for (let flower = 0; flower < 400; flower += 1) {
      for (let step = 0; step < 40; step += 1) {
        const seconds = (step * VISIT_CYCLE_SECONDS) / 40;

        if (isOccupied(`frick:plant:goldenrod:${flower}`, seconds)) {
          busy += 1;
        }

        total += 1;
      }
    }

    expect(busy / total).toBeCloseTo(OCCUPIED_FRACTION, 2);
  });

  test("the meadow is never all busy or all free at once", () => {
    // Each flower keeps its own offset into the cycle. Without that they would
    // all fill and empty together, which is not a meadow, it is a metronome.
    const keys = Array.from({ length: 200 }, (_, i) => `frick:plant:aster:${i}`);

    for (const seconds of [0, 37, 111.5, 900, 4321]) {
      const busy = keys.filter((key) => isOccupied(key, seconds)).length;

      expect(busy, `every flower was free at ${seconds}s`).toBeGreaterThan(0);
      expect(busy, `every flower was busy at ${seconds}s`).toBeLessThan(
        keys.length,
      );
    }
  });

  test("the same flower at the same moment always gives the same answer", () => {
    /**
     * The scatter is deterministic so a player can learn where things are. This
     * has to be too, or the meadow would reshuffle every time the scene
     * rebuilt: the flower you flew across the park for would be busy, then
     * free, then busy again, with nothing having happened.
     */
    for (let i = 0; i < 50; i += 1) {
      const key = `schenley:plant:milkweed:${i}`;
      const first = occupancyOf(key, 1234.5);
      const second = occupancyOf(key, 1234.5);

      expect(second?.forager.id ?? null).toBe(first?.forager.id ?? null);
      expect(second?.freeIn ?? null).toBe(first?.freeIn ?? null);
    }
  });

  test("a busy flower always comes free, and says truthfully when", () => {
    // "Wait or fly on" is only a real choice if waiting actually works, and if
    // the number on the card is the number of seconds it really takes.
    let checked = 0;

    for (let i = 0; i < 300 && checked < 20; i += 1) {
      const key = `highland:plant:bergamot:${i}`;
      const now = occupancyOf(key, 500);

      if (!now) {
        continue;
      }

      checked += 1;

      expect(now.freeIn).toBeGreaterThan(0);
      expect(now.freeIn).toBeLessThanOrEqual(VISIT_SECONDS);

      // A hair before it is due, still busy. A hair after, free.
      expect(isOccupied(key, 500 + now.freeIn - 0.5)).toBe(true);
      expect(isOccupied(key, 500 + now.freeIn + 0.5)).toBe(false);
    }

    expect(checked, "no busy flower turned up to test").toBeGreaterThan(0);
  });

  test("it is a different insect each time round, from a real cast", () => {
    // One insect that owned a flower forever would read as a fixture rather
    // than as a meadow being worked.
    const key = "frick:plant:goldenrod:7";
    const seen = new Set<string>();

    /**
     * Swept rather than sampled once per cycle. The flower keeps its own offset
     * into the cycle, which the caller cannot see, so "one second into each
     * round" lands outside this flower's busy window every single time and
     * would have found nobody at all.
     */
    for (let t = 0; t < VISIT_CYCLE_SECONDS * 60; t += VISIT_SECONDS / 3) {
      const at = occupancyOf(key, t);

      if (at) {
        seen.add(at.forager.id);
      }
    }

    expect(seen.size, "the same insect every time").toBeGreaterThan(1);

    for (const forager of FORAGERS) {
      // Every one of them is a real animal with a real binomial, because
      // "another insect" teaches nothing.
      expect(forager.scientificName).toMatch(/^[A-Z][a-z]+ [a-z]+$/);
      expect(forager.species.length).toBeGreaterThan(3);
    }
  });

  test("a clock that has not started, or has wrapped, does not break it", () => {
    // `seconds` comes from a wall clock the module does not own. Zero and
    // negative values are cheap to get wrong and produce a NaN that silently
    // reads as "never busy".
    for (const seconds of [0, -1, -VISIT_CYCLE_SECONDS * 3.5, 1e9]) {
      const at = occupancyOf("frick:plant:aster:3", seconds);

      expect(Number.isNaN(at?.freeIn ?? 0)).toBe(false);

      if (at) {
        expect(at.freeIn).toBeGreaterThan(0);
      }
    }
  });
});

test.describe("landing on a flower somebody is already on", () => {
  test("the card says who, and offers no button to work it", async ({
    page,
  }) => {
    /**
     * The whole point of this feature, asked of the actual card.
     *
     * The pure module above proves the schedule; this proves a player is told.
     * `?busy=on` pins it, the same way `?hour=` pins the clock: which flowers
     * are taken is a function of the wall clock, so without the pin this test
     * would be asserting against a moving target.
     */
    await enterGame(page, TEST_HOUR, TEST_MONTH, undefined, "on");
    await flyToPlant(page, nearestPlantToSpawn());
    await page.keyboard.press("Space");

    const card = page.getByRole("dialog");

    await expect(card.getByText("Somebody is already on it")).toBeVisible();

    // Named, with its binomial, because "another insect" teaches nothing.
    await expect(card).toContainText(/[A-Z][a-z]+ [a-z]+/);

    // And no way to work it. A dead button would be worse than none here: the
    // flower genuinely has nothing to give for the moment.
    await expect(
      card.getByRole("button", { name: /Pollinate/ }),
      "a busy flower still offered its minigame",
    ).toHaveCount(0);

    // Reading and the quiz are still on offer. Somebody else on the flower is
    // not a reason you cannot learn what it is.
    await expect(card.getByRole("button", { name: /Read/ })).toBeVisible();
  });

  test("an empty flower is untouched by any of this", async ({ page }) => {
    // The other half. Without this the test above would pass just as well
    // against a card that always refused.
    await enterGame(page, TEST_HOUR, TEST_MONTH, undefined, "off");
    await flyToPlant(page, nearestPlantToSpawn());
    await page.keyboard.press("Space");

    const card = page.getByRole("dialog");

    await expect(card.getByRole("button", { name: /Pollinate/ })).toBeVisible();
    await expect(card.getByText("Somebody is already on it")).toHaveCount(0);
  });
});
