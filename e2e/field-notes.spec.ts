import { expect, test } from "@playwright/test";

import { dismissTutorial, enterGame } from "./helpers";

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

    // A clear summer midday: flowers are open, and a wiped save has met none of
    // Frick's sixteen plants.
    await pin(page, "hour=13&month=7&weather=clear");
    const summer = (await notes(page)).join(" \n ");
    expect(summer).toContain("Frick Park");
    expect(summer).toContain("Summer");
    expect(summer).toContain("Clear");
    expect(summer).toMatch(/flowers are open/);
    expect(summer).toMatch(/16 flowers here you have not met/);

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
});
