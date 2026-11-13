import { expect, test, type Page } from "@playwright/test";

import { findPlant, openPlay } from "./helpers";

/**
 * Feel, on a phone and a tablet.
 *
 * Runs only in the `phone` and `tablet` projects (the file name is what puts it
 * there). Two things are a phone's alone: it starts on the low detail, because
 * nothing has ever measured the fine park on one, and it can answer a thumb in
 * the hand. A test machine has no motor to buzz, so the vibration call is
 * replaced with a list and the list is read.
 */

const buzzes = (page: Page) =>
  page.evaluate(() => (window as unknown as { __buzz: unknown[] }).__buzz.length);

async function arrive(page: Page, subject: string) {
  await page.addInitScript(() => {
    const holder = window as unknown as { __buzz: unknown[] };

    holder.__buzz = [];
    Object.defineProperty(Navigator.prototype, "vibrate", {
      configurable: true,
      value(pattern: unknown) {
        holder.__buzz.push(pattern);

        return true;
      },
    });
  });
  await openPlay(page, subject);
  await page.getByRole("button", { name: "Skip", exact: true }).tap();
}

test.describe("feel on touch", () => {
  test.describe.configure({ timeout: 180_000 });

  test("a thumb starts on low detail, and can ask for high", async ({ page }, info) => {
    await arrive(page, `feel-detail-${info.project.name}`);
    await page.getByRole("button", { name: "Show actions" }).tap();

    const detail = page.getByRole("button", { name: /^Detail:/ });

    await expect(detail).toHaveAttribute("data-quality", "low");

    const box = await detail.boundingBox();

    expect(box!.height, "the detail switch is too small for a thumb").toBeGreaterThanOrEqual(44);

    await detail.tap();
    await expect(detail).toHaveAttribute("data-quality", "high");
  });

  test("landing buzzes, and stops buzzing when told to", async ({ page }, info) => {
    await arrive(page, `feel-buzz-${info.project.name}`);
    expect(await findPlant(page), "never got near the flower").toBe(true);

    const before = await buzzes(page);

    await page.keyboard.press("Space");
    await expect(page.getByRole("button", { name: "Take off" })).toBeVisible();
    await page.waitForTimeout(400);
    expect(await buzzes(page), "feet down, and nothing in the hand").toBeGreaterThan(before);

    await page.keyboard.press("Escape");
    await expect(page.getByRole("button", { name: "Take off" })).toHaveCount(0);

    await page.getByRole("button", { name: "Show actions" }).tap();
    await page.getByRole("button", { name: "Buzz: On" }).tap();
    await expect(page.getByRole("button", { name: "Buzz: Off" })).toBeVisible();

    const quiet = await buzzes(page);

    await page.keyboard.press("Space");
    await expect(page.getByRole("button", { name: "Take off" })).toBeVisible();
    await page.waitForTimeout(400);
    expect(await buzzes(page), "it buzzed after being switched off").toBe(quiet);
  });
});
