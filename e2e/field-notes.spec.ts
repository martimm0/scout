import { expect, test } from "@playwright/test";

import { dismissTutorial, enterGame } from "./helpers";

/**
 * Field notes: the "what's out today" card.
 *
 * The card is entirely derived from the park's real hour, the real weather and
 * the save, so the way to test it is to pin the hour and the sky and read the
 * copy back. Assert the thing the player reads, not a proxy: the actual lines in
 * the panel change with the clock and the weather.
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
  test("the card reads the hour, the sky and the save", async ({ page }) => {
    // Signs in and wipes the save, so every plant is unmet.
    await enterGame(page, 13);

    // A clear midday: flowers are open, and the ephemerals among them are on
    // their way out, which the card should say.
    await pin(page, "hour=13&weather=clear");

    let lines = await notes(page);
    const midday = lines.join(" \n ");

    expect(midday).toContain("Frick Park");
    expect(midday).toContain("Clear");
    expect(midday).toContain("Midday");
    // Something is open, and the ephemerals get called out before they shut.
    expect(midday).toMatch(/flowers are open/);
    expect(midday).toContain("mid-afternoon");
    // A wiped save has met nothing; Frick has sixteen plants.
    expect(midday).toMatch(/16 flowers here you have not met/);

    // The weather changes the sky line and nothing else has to.
    await pin(page, "hour=13&weather=fog");
    lines = await notes(page);
    expect(lines.join(" ")).toContain("Fog");

    // After dark the park is a different place, and the card is honest about it:
    // nothing pollinates at night, and the night badge's own hint leads the way.
    await pin(page, "hour=22&weather=clear");
    lines = await notes(page);
    const night = lines.join(" \n ");

    expect(night).toContain("Night in Frick Park");
    expect(night).toMatch(/Nothing is open to pollinate after dark/);
    // The soft goal is a nighttime one. Which exactly depends on what the player
    // has already earned: simply being here after dark earns the night badge, so
    // the card then points past it to the things that glow in the dark.
    expect(night).toMatch(/makes its own light|does not close|old wood was glowing/);
  });
});
