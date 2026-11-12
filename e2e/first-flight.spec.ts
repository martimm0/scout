import { expect, test, type Page } from "@playwright/test";

import { findPlant, hold, openPlay } from "./helpers";

/**
 * The first flight teaches by doing.
 *
 * It used to be four cards of reading in front of the park. Now each step waits
 * for the player to actually turn, fly, climb, find and land, over the live
 * park, and only the last one talks. So the tests drive the bee and read the
 * card back: a step that moved on by itself, or never moved on, is the bug.
 */

// Named by its step's title, which changes, so found by what labels it.
const coach = (page: Page) => page.locator('[role="region"][aria-labelledby="first-flight-title"]');
const title = (page: Page) => coach(page).getByRole("heading");

test.describe("the first flight", () => {
  test.describe.configure({ timeout: 180_000 });

  test("a step waits until you do it", async ({ page }) => {
    await openPlay(page, "first-flight-steps");

    await expect(title(page)).toHaveText("Look around.");
    // Waiting is not doing.
    await page.waitForTimeout(3000);
    await expect(title(page), "the first step moved on by itself").toHaveText("Look around.");

    await hold(page, "ArrowLeft", 900);
    await expect(title(page)).toHaveText("Fly.");
    await hold(page, "ArrowUp", 1500);
    await expect(title(page)).toHaveText("Climb, then drop.");
    await hold(page, "KeyE", 600);
    await expect(title(page)).toHaveText("Find a flower.");
  });

  test("it coaches all the way to a landing, stands aside for it, then asks about sound", async ({
    page,
  }) => {
    await openPlay(page, "first-flight-loop");

    // The flight helper turns, flies and climbs on its way, which is the lesson.
    expect(await findPlant(page), "never got near the flower").toBe(true);
    await expect(title(page)).toHaveText("Land on it.");

    await page.keyboard.press("Space");
    const takeOff = page.getByRole("button", { name: "Take off" });

    await expect(takeOff).toBeVisible();
    // The landing menu has the screen: the card waits rather than cover it.
    await expect(coach(page), "the coach sat on top of the landing menu").toHaveCount(0);

    await takeOff.click();
    await expect(title(page)).toHaveText("That's the job.");

    await coach(page).getByRole("button", { name: "Fly, with sound" }).click();
    await expect(coach(page)).toHaveCount(0);
    await expect(page.getByRole("button", { name: /Sound on/i })).toBeVisible();
  });

  test("Skip ends it, and it stays gone after a reload", async ({ page }) => {
    await openPlay(page, "first-flight-skip");

    await coach(page).getByRole("button", { name: "Skip", exact: true }).click();
    await expect(coach(page)).toHaveCount(0);

    await page.reload();
    await page.waitForTimeout(3000);
    await expect(coach(page), "a skipped walkthrough came back").toHaveCount(0);
  });

  test("Show me again replays it from the start", async ({ page }) => {
    await openPlay(page, "first-flight-replay");

    await coach(page).getByRole("button", { name: "Skip", exact: true }).click();
    await expect(coach(page)).toHaveCount(0);

    // Controls opens once the walkthrough is out of the way.
    await page.getByRole("button", { name: "Show me again" }).click();
    await expect(title(page)).toHaveText("Look around.");
    await expect(coach(page)).toContainText("1 of 6");
  });

  test("the bee still flies, and the park still takes a click, under the card", async ({
    page,
  }) => {
    await openPlay(page, "first-flight-click");

    const box = await coach(page).boundingBox();
    expect(box).not.toBeNull();

    // Just beside the card: on the old scrim, this landed on the dimmer.
    const x = box!.x - 20;
    const y = box!.y + box!.height / 2;
    const hit = await page.evaluate(
      ([px, py]) => document.elementFromPoint(px, py)?.tagName ?? "",
      [x, y] as const,
    );

    expect(hit, "something other than the park took the click").toBe("CANVAS");
  });
});
