import { expect, test, type Page } from "@playwright/test";

import { typicalRate } from "../src/features/game/world/pace";
import { enterGame, hold, openPlay, pinPanels, whole } from "./helpers";

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
    // The park arrives coarse and sharpens: count it once it is whole.
    await whole(page);

    const fine = await triangles(page);

    await detail(page).click();
    await expect(detail(page)).toHaveAttribute("data-quality", "low");
    await page.waitForTimeout(2500);

    const coarse = await triangles(page);

    expect(coarse, "low drew as much as high: nothing was rebuilt").toBeLessThan(fine * 0.5);
  });

  test("switching down and back up does not keep the old models", async ({ page }) => {
    /**
     * Going to low disposed the fine models and then, on the way back to high,
     * handed the same disposed set to the scene again: the renderer uploaded
     * every one of them a second time, the freshly built set replaced them, and
     * nothing was left holding the first to let it go. One whole park of
     * geometry, including the fine ground, for every round trip.
     */
    const held = () =>
      page.evaluate(
        () =>
          (window as unknown as { __scoutGl: { info: { memory: { geometries: number } } } }).__scoutGl
            .info.memory.geometries,
      );

    await arrive(page, "quality-round-trip", "&weather=clear");
    await whole(page);

    const before = await held();

    for (let trip = 0; trip < 2; trip += 1) {
      await detail(page).click();
      await expect(detail(page)).toHaveAttribute("data-quality", "low");
      await page.waitForTimeout(1500);
      await detail(page).click();
      await expect(detail(page)).toHaveAttribute("data-quality", "high");
      await page.waitForTimeout(500);
      await whole(page);
    }

    // A handful either way is what happens to be in view (a mote, a visitor).
    expect(await held(), "the park is holding models it no longer draws").toBeLessThan(before + 12);
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

  test("the park is flyable before the fine models are ready", async ({ page }) => {
    await openPlay(page, "quality-progressive");
    await page.goto("/play?debug=1&hour=12&month=7&weather=clear&quality=high");

    // The canvas is up and drawing while models are still being compiled...
    await page.waitForSelector("canvas");

    const early = await page.evaluate(() => ({
      building: Number(document.documentElement.dataset.scoutBuilding ?? "0"),
      triangles: (window as unknown as { __scoutGl?: { info: { render: { triangles: number } } } }).__scoutGl
        ?.info.render.triangles,
    }));

    await whole(page);

    // ...and ends up drawing far more than it started with.
    expect(await triangles(page), "the park never sharpened").toBeGreaterThan(
      Math.max(early.triangles ?? 0, 300_000) * 2,
    );
  });

  test("low costs no more than the whole park did before", async ({ page, browserName }) => {
    // The count depends on what is in view, and the old figure was taken in
    // this browser at this window size.
    test.skip(browserName !== "chromium", "measured in chromium");

    await enterGame(page);
    // A clear sky: the count must not depend on how cloudy Pittsburgh is today.
    await page.goto("/play?debug=1&hour=12&month=7&weather=clear&quality=low");
    await page.waitForTimeout(5000);
    await hold(page, "ArrowUp", 1500);

    expect(await triangles(page), "low is heavier than the park it replaced").toBeLessThanOrEqual(
      TRIANGLES_BEFORE,
    );
  });
});

test.describe("the frame rate guard, as data", () => {
  test.skip(({ browserName }) => browserName !== "chromium", "no browser involved");

  test("tells a slow machine from a window that is not in front", () => {
    // A window behind another is handed frames in bursts: each one quick, with
    // long gaps between. Counted per second that is five frames a second, and
    // it dropped a fast computer to Low. The typical frame is still quick.
    const throttled = [...Array.from({ length: 30 }, () => 0.0084), 0.9, 1.4, 0.7, 1.1];

    expect(throttled.length / throttled.reduce((sum, value) => sum + value, 0), "the old measure").toBeLessThan(10);
    expect(typicalRate(throttled)).toBeGreaterThan(100);
    // A machine that really is drawing four a second is still caught.
    expect(typicalRate(Array.from({ length: 16 }, () => 0.25))).toBe(4);
    // And one hitch among smooth frames is not a slow machine.
    expect(typicalRate([...Array.from({ length: 40 }, () => 1 / 60), 0.4])).toBeCloseTo(60, 0);
  });
});
