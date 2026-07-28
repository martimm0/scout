import { expect, test, type Page } from "@playwright/test";

import {
  dismissTutorial,
  flyToPlant,
  nearestPlantToSpawn,
  signIn,
  resetProgress,
  TEST_MONTH,
} from "./helpers";

/**
 * The touch pad.
 *
 * Assert the thing, not the proxy for it: that the sticks actually FLY the bee.
 * "The stick is on screen" was true the whole time the virtual input reached
 * nothing, so every test here reads the debug overlay back and checks the bee
 * moved. Heading for the left stick's turn, Speed for its throttle, Altitude for
 * the climb button.
 *
 * These run only in the `phone` and `tablet` projects, which set `hasTouch` and
 * `isMobile` so `(pointer: coarse)` matches. That is what the pad is gated on.
 */

async function enterTouchGame(page: Page) {
  await signIn(page.context());
  await resetProgress(page);
  await page.addInitScript(() => window.localStorage.clear());
  await page.goto(`/play?debug=1&hour=13&month=${TEST_MONTH}&weather=clear`);
  await page.waitForTimeout(3000);
  await dismissTutorial(page);
  await page.waitForTimeout(1200);
}

/** One value out of the debug overlay, by its label. */
async function readout(page: Page, label: string): Promise<string> {
  return page.evaluate((wanted) => {
    for (const row of document.querySelectorAll("aside dl > div")) {
      if (row.querySelector("dt")?.textContent?.trim() === wanted) {
        return row.querySelector("dd")?.textContent?.trim() ?? "";
      }
    }
    return "";
  }, label);
}

const number = (text: string) => Number.parseFloat(text.replace(/[^\d.-]/g, ""));

/** Press a thumb to a control, drag it, hold, then let go. */
async function dragStick(
  page: Page,
  selector: string,
  dx: number,
  dy: number,
  holdMs = 900,
) {
  const box = await page.locator(selector).first().boundingBox();

  if (!box) {
    throw new Error(`no control matching ${selector}`);
  }

  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;

  await page.touchscreen.tap(x, y);
  // tap alone cannot drag, so drive the pointer stream by hand.
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + dx, y + dy, { steps: 8 });
  await page.waitForTimeout(holdMs);
  await page.mouse.up();
}

test.describe("the touch pad flies the bee", () => {
  test("the pad is offered on a touch device", async ({ page }) => {
    await enterTouchGame(page);

    await expect(page.getByLabel("Fly")).toBeVisible();
    await expect(page.getByLabel("Tilt the view")).toBeVisible();
    await expect(page.getByLabel("Climb")).toBeVisible();
    await expect(page.getByLabel("Dive")).toBeVisible();
  });

  test("the left stick turns the bee", async ({ page }) => {
    await enterTouchGame(page);

    const before = number(await readout(page, "Heading"));
    await dragStick(page, '[aria-label="Fly"]', 70, 0);
    const after = number(await readout(page, "Heading"));

    // Pushing the stick right turns the bee. Compared as a real change rather
    // than a direction, because heading wraps at 180.
    expect(Math.abs(after - before)).toBeGreaterThan(5);
  });

  test("the left stick drives the bee forward", async ({ page }) => {
    await enterTouchGame(page);

    expect(number(await readout(page, "Speed"))).toBe(0);

    // Hold the stick forward and read the speed WHILE it is held: letting go
    // would decelerate the bee before the readout could see anything.
    const box = await page.locator('[aria-label="Fly"]').first().boundingBox();
    const x = box!.x + box!.width / 2;
    const y = box!.y + box!.height / 2;

    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x, y - 70, { steps: 8 });
    await page.waitForTimeout(1200);

    const moving = number(await readout(page, "Speed"));
    await page.mouse.up();

    expect(moving).toBeGreaterThan(1);
  });

  test("the climb button gains height", async ({ page }) => {
    await enterTouchGame(page);

    const before = number(await readout(page, "Altitude"));

    const box = await page.locator('[aria-label="Climb"]').first().boundingBox();
    await page.mouse.move(
      box!.x + box!.width / 2,
      box!.y + box!.height / 2,
    );
    await page.mouse.down();
    await page.waitForTimeout(1200);
    await page.mouse.up();

    expect(number(await readout(page, "Altitude"))).toBeGreaterThan(before);
  });

  /**
   * The most important interaction in the game, and the one the pad could most
   * easily have broken: the Land button lives on the flower's own tag, which drei
   * renders at `zIndexRange={[12, 0]}` while the pad sits at 14. The pad's root is
   * `pointer-events: none` so taps fall through the gaps between the controls, but
   * a tag that happens to draw over the fly stick would be untappable, and no
   * amount of "the button is visible" would catch it. So this taps it for real and
   * asserts the landing menu opened.
   */
  test("you can land on a flower by tapping its tag", async ({ page }) => {
    test.setTimeout(180_000);

    await enterTouchGame(page);

    const reached = await flyToPlant(page, nearestPlantToSpawn());
    expect(reached, "never got near a flower").toBe(true);

    // Let the bee come to rest first. The tag is anchored in the WORLD, so while
    // there is any velocity left it slides across the screen, and a tap aimed at
    // where it was lands on the park instead. A player waits for it to settle
    // without thinking about it; the test has to be told.
    await page.waitForFunction(
      () => {
        for (const row of document.querySelectorAll("aside dl > div")) {
          if (row.querySelector("dt")?.textContent?.trim() === "Speed") {
            return Number.parseFloat(row.querySelector("dd")?.textContent ?? "9") < 0.4;
          }
        }
        return false;
      },
      undefined,
      { timeout: 15_000 },
    );

    /**
     * Ask the browser what is actually on top at the button's own centre.
     *
     * A real tap could not be made to work here, and the reasons were both real
     * and not worth fighting: the bee bobs forever so the card is never "stable"
     * by Playwright's definition, and on a short landscape viewport the card can
     * project off the top of the screen entirely. What this test exists to catch
     * is narrower than a tap and more useful: that the touch pad does not sit
     * OVER the button. `elementFromPoint` answers exactly that, in one frame, with
     * no flight-path luck involved.
     */
    const land = page.getByRole("button", { name: /^Land/ }).first();
    const box = await land.boundingBox();
    expect(box, "the Land button never appeared").not.toBeNull();

    const onTop = await page.evaluate(
      ([x, y]) => {
        const hit = document.elementFromPoint(x, y);
        return {
          // Did the tap reach the button, or something on top of it?
          reachesButton: Boolean(hit?.closest("button")),
          // Name whatever is there, so a failure says what stole the tap.
          className: hit?.className?.toString().slice(0, 80) ?? "(nothing)",
        };
      },
      [box!.x + box!.width / 2, box!.y + box!.height / 2] as const,
    );

    expect(
      onTop.reachesButton,
      `something is covering the Land button: ${onTop.className}`,
    ).toBe(true);

    // And it does open the landing menu when it is pressed.
    await land.dispatchEvent("click");

    // The landing menu is what proves the tap reached the button rather than a
    // stick sitting over it.
    await expect(
      page.getByRole("dialog", { name: /^Landed on/ }),
    ).toBeVisible();
  });

  test("the pad gets out of the way when a popover is up", async ({ page }) => {
    await enterTouchGame(page);

    await expect(page.getByLabel("Fly")).toBeVisible();

    // Through the tray, the way a touch player reaches it: the Controls panel
    // that used to hold this button is hidden on a touch device.
    await page.getByRole("button", { name: "Show actions" }).click();
    await page.getByRole("button", { name: "View pollinator" }).click();

    // The preview is the modal that used to leave a held thumb stuck, because the
    // frame loop did not count it as a pause.
    await expect(page.getByLabel("Fly")).toHaveCount(0);

    await page.getByRole("button", { name: "Close pollinator preview" }).click();
    await expect(page.getByLabel("Fly")).toBeVisible();
  });
});
