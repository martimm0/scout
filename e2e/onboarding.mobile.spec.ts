import { expect, test, type Page } from "@playwright/test";

import { findPlant, openPlay } from "./helpers";

/**
 * The first flight and the folding HUD, on a phone and a tablet.
 *
 * Runs only in the `phone` and `tablet` projects (the file name is what puts it
 * there). The card shares a landscape phone with two thumbsticks, a tray and
 * Field Notes, so beyond teaching the pad's own controls it has to keep out of
 * their way: these tests measure that rather than eyeball it.
 */

const coach = (page: Page) =>
  page.locator('[role="region"][aria-labelledby="first-flight-title"]');
const title = (page: Page) => coach(page).getByRole("heading");

/** Everything the card must never sit on. */
const OBSTACLES = [
  '[aria-label="Fly"]',
  '[aria-label="Boost"]',
  '[aria-label="Tilt the view"]',
  '[aria-label="Climb"]',
  '[aria-label="Dive"]',
  '[aria-label="Show actions"]',
  'aside[aria-label="Field notes"]',
];

async function expectClearLayout(page: Page) {
  // The card rises in, scaled: measure it where it lands, not on the way.
  await page.waitForTimeout(400);
  const card = await coach(page).boundingBox();
  const screen = page.viewportSize()!;

  expect(card, "no coach card").not.toBeNull();
  expect(card!.x, "card off the left edge").toBeGreaterThanOrEqual(0);
  expect(card!.x + card!.width, "card off the right edge").toBeLessThanOrEqual(screen.width);
  expect(card!.y + card!.height, "card off the bottom").toBeLessThanOrEqual(screen.height);

  for (const selector of OBSTACLES) {
    const box = await page.locator(selector).first().boundingBox();

    if (!box) {
      continue;
    }

    const overlaps =
      card!.x < box.x + box.width &&
      box.x < card!.x + card!.width &&
      card!.y < box.y + box.height &&
      box.y < card!.y + card!.height;

    expect(
      overlaps,
      `the card ${JSON.stringify(card)} covers ${selector} ${JSON.stringify(box)}`,
    ).toBe(false);
  }

  const scroll = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(scroll, "the page scrolls sideways").toBeLessThanOrEqual(0);
}

/** A thumb on a control, pushed, held, and let go. */
async function thumb(page: Page, selector: string, dx: number, dy: number, ms: number) {
  const box = await page.locator(selector).first().boundingBox();
  const x = box!.x + box!.width / 2;
  const y = box!.y + box!.height / 2;

  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + dx, y + dy, { steps: 8 });
  await page.waitForTimeout(ms);
  await page.mouse.up();
  await page.waitForTimeout(300);
}

test.describe("the first flight on a touch screen", () => {
  test.describe.configure({ timeout: 180_000 });

  test("it teaches the pad, by the pad, and keeps out of its way", async ({ page }, info) => {
    await openPlay(page, `touch-coach-${info.project.name}`);

    await expect(title(page)).toHaveText("Look around.");
    await expect(coach(page)).toContainText("FLY circle");
    await expect(coach(page), "a phone was told about the mouse").not.toContainText("mouse");
    await expectClearLayout(page);

    await thumb(page, '[aria-label="Fly"]', 70, 0, 1000);
    await expect(title(page)).toHaveText("Fly.");
    await expectClearLayout(page);

    await thumb(page, '[aria-label="Fly"]', 0, -70, 1600);
    await expect(title(page)).toHaveText("Climb, then drop.");
    await expectClearLayout(page);

    await thumb(page, '[aria-label="Climb"]', 0, 0, 700);
    await expect(title(page)).toHaveText("Find a flower.");
    await expectClearLayout(page);
  });

  test("the last card fits, with both sound buttons", async ({ page }, info) => {
    await openPlay(page, `touch-finish-${info.project.name}`);

    expect(await findPlant(page), "never got near the flower").toBe(true);
    await page.keyboard.press("Space");
    await expect(page.getByRole("button", { name: "Take off" })).toBeAttached();
    // Escape rather than a click: on a 293px screen Playwright scrolls the page
    // to reach the button, and that scroll is the test's, not the player's.
    await page.keyboard.press("Escape");
    await expect(title(page)).toHaveText("That's the job.");
    await expectClearLayout(page);

    const screen = page.viewportSize()!;

    for (const name of ["Fly, with sound", "Fly in silence"]) {
      const box = await coach(page).getByRole("button", { name }).boundingBox();

      expect(box, `no ${name} button`).not.toBeNull();
      expect(box!.y + box!.height, `${name} is off the screen`).toBeLessThanOrEqual(screen.height);
      expect(box!.height, `${name} is too small for a thumb`).toBeGreaterThanOrEqual(44);
    }
  });

  test("Field Notes opens by tap, folds by itself, and pins by tap", async ({ page }, info) => {
    await openPlay(page, `touch-fold-${info.project.name}`);
    await coach(page).getByRole("button", { name: "Skip", exact: true }).tap();

    const notes = page.locator('aside[aria-label="Field notes"]');

    // Folded on a touch screen to begin with: a third of a phone is a lot.
    await expect(notes).toHaveAttribute("data-open", "false");

    await notes.getByRole("button", { name: "Field Notes", exact: true }).tap();
    await expect(notes).toHaveAttribute("data-open", "true");
    await expect(notes, "it never folded").toHaveAttribute("data-open", "false", {
      timeout: 12_000,
    });

    const pin = page.getByRole("button", { name: "Keep Field Notes open" });
    const box = await pin.boundingBox();

    expect(box!.width, "the pin is too small for a thumb").toBeGreaterThanOrEqual(44);
    await pin.tap();
    await page.waitForTimeout(10_000);
    await expect(notes, "a pinned panel folded").toHaveAttribute("data-open", "true");
  });

  test("Show me again is in the tray", async ({ page }, info) => {
    await openPlay(page, `touch-replay-${info.project.name}`);
    await coach(page).getByRole("button", { name: "Skip", exact: true }).tap();
    await expect(coach(page)).toHaveCount(0);

    await page.getByRole("button", { name: "Show actions" }).tap();
    await page.getByRole("button", { name: "Show me again" }).tap();
    await expect(title(page)).toHaveText("Look around.");
  });
});
