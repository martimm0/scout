import { expect, test, type Page } from "@playwright/test";

import { enterGame, hold, openPlay, pinPanels } from "./helpers";

/**
 * Two qualities, and a promise about the lower one.
 *
 * High is the fine voxel park. Low is the same shapes in larger blocks, and it
 * is held to what the whole park cost before the fine models existed, because
 * Low is what a phone runs and a phone was never given any headroom. That
 * number is measured here rather than argued: the renderer is asked how many
 * triangles it drew.
 */

/**
 * What one frame of Frick cost on main before this work: 236,486 triangles,
 * after flying forward from the spawn for a second and a half at noon in July.
 * Measured on the commit before the voxel grid was introduced.
 */
const TRIANGLES_BEFORE = 236_486;

const detail = (page: Page) => page.getByRole("button", { name: /^Detail:/ });

async function triangles(page: Page) {
  return page.evaluate(
    () =>
      (window as unknown as { __scoutGl: { info: { render: { triangles: number } } } }).__scoutGl
        .info.render.triangles,
  );
}

/** Past the walkthrough, with Controls pinned open so the switch is on screen. */
async function arrive(page: Page, subject: string, query = "") {
  await openPlay(page, subject);

  if (query) {
    await page.goto(`/play?debug=1&hour=12&month=7${query}`);
    await page.waitForTimeout(2500);
  }

  await page.getByRole("button", { name: "Skip", exact: true }).click();
  await pinPanels(page);
}

test.describe("detail: high and low", () => {
  test.describe.configure({ timeout: 150_000 });

  test("a mouse starts on high, and the switch rebuilds the park coarser", async ({ page }) => {
    await arrive(page, "quality-switch");

    await expect(detail(page)).toHaveAttribute("data-quality", "high");
    await page.waitForTimeout(1500);

    const fine = await triangles(page);

    await detail(page).click();
    await expect(detail(page)).toHaveAttribute("data-quality", "low");
    await page.waitForTimeout(2500);

    const coarse = await triangles(page);

    expect(coarse, "low drew as much as high: nothing was rebuilt").toBeLessThan(fine * 0.5);
  });

  test("the choice is remembered", async ({ page }) => {
    await arrive(page, "quality-remembered");

    await detail(page).click();
    await expect(detail(page)).toHaveAttribute("data-quality", "low");

    await page.reload();
    await page.waitForTimeout(3000);
    await pinPanels(page);

    await expect(detail(page), "the park forgot it was asked for low").toHaveAttribute(
      "data-quality",
      "low",
    );
  });

  test("?quality= wins over the saved choice", async ({ page }) => {
    await arrive(page, "quality-pin", "&quality=low");

    await expect(detail(page)).toHaveAttribute("data-quality", "low");
  });

  test("low costs no more than the whole park did before", async ({ page, browserName }) => {
    // The count depends on what is in view, and the old figure was taken in
    // this browser at this window size.
    test.skip(browserName !== "chromium", "measured in chromium");

    await enterGame(page);
    await page.goto("/play?debug=1&hour=12&month=7&quality=low");
    await page.waitForTimeout(5000);
    await hold(page, "ArrowUp", 1500);

    expect(await triangles(page), "low is heavier than the park it replaced").toBeLessThanOrEqual(
      TRIANGLES_BEFORE,
    );
  });
});
