import { expect, test } from "@playwright/test";

import { dismissTutorial, enterGame } from "./helpers";
import { plantsIn } from "../src/features/game/state/game-store";

/**
 * Field notes: the "what's out today" card.
 *
 * The card is entirely derived from the park's real month, hour, weather and the
 * save, so the way to test it is to pin all of those and read the copy back.
 * Assert the thing the player reads, not a proxy: the lines change with the
 * calendar, the clock and the sky.
 */

/** The lines the panel is showing, top to bottom. */
async function notes(page: import("@playwright/test").Page) {
  return page.locator('aside[aria-label="Field notes"] li').allTextContents();
}

/** Reload the pinned park without re-minting the session. */
async function pin(
  page: import("@playwright/test").Page,
  query: string,
) {
  await page.goto(`/play?${query}`);
  await page.waitForTimeout(2500);
  await dismissTutorial(page);
  await page.waitForTimeout(400);
}

test.describe("field notes", () => {
  test("the card reads the season, the hour, the sky and the save", async ({
    page,
  }) => {
    // Signs in and wipes the save, so every plant is unmet.
    await enterGame(page, 13);

    /**
     * A clear summer midday: flowers are open, and a wiped save has met none of
     * Frick's plants.
     *
     * The COUNT is derived rather than typed in. It was the literal 16, which
     * broke the day three night-blooming species shipped, and it would have
     * broken for every future species too. Worse, a hard-coded number that
     * happens to be right tells you nothing about whether the card is counting
     * the correct set: `plantsIn` is the same function the card reads, so this
     * now asserts they agree rather than asserting a constant against itself.
     */
    await pin(page, "hour=13&month=7&weather=clear");
    const summer = (await notes(page)).join(" \n ");
    expect(summer).toContain("Frick Park");
    expect(summer).toContain("Summer");
    expect(summer).toContain("Clear");
    expect(summer).toMatch(/flowers are open/);
    expect(summer).toMatch(
      new RegExp(`${plantsIn("frick").length} flowers here you have not met`),
    );

    // A clear spring midday: the ephemerals are out, and the card calls them out
    // before they shut for the afternoon.
    await pin(page, "hour=13&month=4&weather=clear");
    const spring = (await notes(page)).join(" \n ");
    expect(spring).toContain("Spring");
    expect(spring).toContain("mid-afternoon");

    // The deep of winter: nothing is in bloom, and the card says so rather than
    // pretending. This is the seasonal twin of the after-dark line.
    await pin(page, "hour=13&month=1&weather=clear");
    const winter = (await notes(page)).join(" \n ");
    expect(winter).toContain("Winter");
    expect(winter).toMatch(/Nothing is in bloom/);

    // The weather changes the sky line and nothing else has to.
    await pin(page, "hour=13&month=7&weather=fog");
    expect((await notes(page)).join(" ")).toContain("Fog");

    // After dark, nothing pollinates, and the night badge's own hint leads the
    // way. Which nighttime hint depends on what the player has already earned:
    // simply being here after dark earns the night badge, so the card points past
    // it to the things that glow in the dark.
    await pin(page, "hour=22&month=7&weather=clear");
    const night = (await notes(page)).join(" \n ");
    expect(night).toMatch(/night in Frick Park/i);
    expect(night).toMatch(/Nothing is open to pollinate after dark/);
    expect(night).toMatch(/makes its own light|does not close|old wood was glowing/);
  });

  /**
   * The flush line, which is the only thing the card says about weather that has
   * already been and gone.
   *
   * A player has no way to know that today's clear sky is the good mushroom day
   * rather than the wet one that made it, so the card has to say so. `?weather=
   * flush` is a fine afternoon with a soaking five days behind it.
   */
  test("the card notices the wood is flushing, on a day with no rain in it", async ({
    page,
  }) => {
    await enterGame(page, 13);

    await pin(page, "hour=13&month=7&weather=flush");
    const wet = (await notes(page)).join(" \n ");

    expect(wet).toMatch(/mushrooms/i);
    expect(wet).toMatch(/a few days behind the weather/i);

    // And it is genuinely a clear day: the flush is about last week, not today.
    expect(wet).toContain("Clear");

    // A dry fortnight says nothing about mushrooms at all.
    await pin(page, "hour=13&month=7&weather=dry");
    const dry = (await notes(page)).join(" \n ");

    expect(dry).toContain("Clear");
    expect(dry, "a dry spell is claiming a flush").not.toMatch(/mushrooms/i);
  });

  /**
   * Fahrenheit on the card, Celsius under it.
   *
   * The whole game reads in Fahrenheit now, and the sky line was the awkward one:
   * the same rounded Celsius local fed both that sentence and the "too cold for
   * most bees" rule below it. Converting the local would have read correctly and
   * moved the bees' threshold from ten degrees to about minus twelve, so the note
   * would simply never have fired again.
   *
   * The snow preset is -2C, which is 28F and is genuinely too cold to forage. Both
   * halves are asserted together, because either one alone would have passed
   * through the bug.
   */
  test("the sky line reads Fahrenheit, and the cold rule still bites", async ({
    page,
  }) => {
    await enterGame(page, 13);

    await pin(page, "hour=13&month=1&weather=snow");
    const cold = (await notes(page)).join(" \n ");

    // -2C rendered in Fahrenheit, and no Celsius left anywhere on the card.
    expect(cold).toContain("28°F");
    expect(cold).not.toContain("°C");

    // And the rule that reads the Celsius underneath still fires.
    expect(cold).toMatch(/Too cold for most bees/);

    // A fair day is 18C, 64F, and warm enough that the note stays away.
    await pin(page, "hour=13&month=7&weather=clear");
    const warm = (await notes(page)).join(" \n ");

    expect(warm).toContain("64°F");
    expect(warm).not.toMatch(/Too cold for most bees/);
  });
});
