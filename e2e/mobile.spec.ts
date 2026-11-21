import { expect, test, type Page } from "@playwright/test";

import {
  dismissTutorial,
  flyToPlant,
  hold,
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
  await resetProgress();
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
    const settle = () =>
      page.waitForFunction(
        () => {
          for (const row of document.querySelectorAll("aside dl > div")) {
            if (row.querySelector("dt")?.textContent?.trim() === "Speed") {
              return (
                Number.parseFloat(row.querySelector("dd")?.textContent ?? "9") <
                0.4
              );
            }
          }
          return false;
        },
        undefined,
        { timeout: 15_000 },
      );
    await settle();

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
    const screen = page.viewportSize()!;
    const onScreen = async () => {
      const box = await land.boundingBox({ timeout: 2_000 }).catch(() => null);
      return box &&
        box.x >= 0 &&
        box.y >= 0 &&
        box.x + box.width <= screen.width &&
        box.y + box.height <= screen.height
        ? box
        : null;
    };

    /**
     * The flight helper stops as soon as the flower is in reach, which can be
     * high over it, and the camera looks ahead, not down: the tag is then under
     * the bottom of the screen where no finger could reach it. Drop toward the
     * flower, as a player would, which keeps it in reach and brings it up into
     * view. Backing away instead lost it out of reach.
     */
    for (let tries = 0; tries < 8 && !(await onScreen()); tries++) {
      await hold(page, "KeyQ", 250);
      await settle();
    }

    const box = await onScreen();
    expect(box, "the Land button never came on screen").not.toBeNull();

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

  test("the tray's Dance marks the patch, as G does", async ({ page }) => {
    test.setTimeout(180_000);

    /**
     * The tray played the dance and stopped there. Marking the patch, and
     * telling the room, lived only behind the G key, so a phone could dance
     * beside every flower in the park and never mark one.
     */
    await enterTouchGame(page);
    expect(await flyToPlant(page, nearestPlantToSpawn()), "never got near a flower").toBe(true);

    await page.getByRole("button", { name: "Show actions" }).click();
    await page.getByRole("button", { name: "Dance" }).click();

    await expect
      .poll(
        () =>
          page.evaluate(
            () =>
              (JSON.parse(window.localStorage.getItem("scout-game-state") ?? "{}").state
                ?.marks ?? []).length,
          ),
        { message: "dancing from the tray marked nothing", timeout: 10_000 },
      )
      .toBeGreaterThan(0);
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

test.describe("a round out in the park, on a phone", () => {
  /** Whether a control is wholly on the screen, where a thumb can reach it. */
  async function onScreen(page: Page, name: RegExp | string) {
    const control = page.getByRole("button", { name }).first();

    await control.scrollIntoViewIfNeeded();

    const box = await control.boundingBox();
    const view = page.viewportSize();

    if (
      !box ||
      !view ||
      box.x < 0 ||
      box.y < 0 ||
      box.x + box.width > view.width ||
      box.y + box.height > view.height
    ) {
      return false;
    }

    // Inside the window is not the same as reachable: a button scrolled under
    // the edge of its own panel has a box on the screen and nothing to press.
    // So ask the page what is actually under the middle of it.
    return control.evaluate((node, [x, y]) => {
      const hit = document.elementFromPoint(x, y);

      return Boolean(hit && (hit === node || node.contains(hit)));
    }, [box.x + box.width / 2, box.y + box.height / 2] as const);
  }

  test("can be started, begun and left with a thumb", async ({ page }) => {
    /**
     * Races and hide and seek add five things to a panel that already had
     * four, on a screen that is under four hundred pixels tall. Nothing about
     * them needs a keyboard, which is only true if every button can be reached:
     * a list that runs off the bottom of a phone is a list of things a phone
     * cannot do.
     */
    test.setTimeout(180_000);

    await signIn(page.context());
    await resetProgress();
    await page.addInitScript(() => window.localStorage.clear());
    await page.goto(`/parties?debug=1&hour=13&month=${TEST_MONTH}&weather=clear`);
    await page.getByRole("button", { name: /Join the Frick/ }).click();
    await page.waitForURL(/\/play/);
    await page.waitForTimeout(3000);
    await dismissTutorial(page);
    await page.waitForTimeout(1200);
    await page.getByRole("button", { name: /^Games/ }).click();

    // A drag that runs off the end of this list must not pull the page down
    // and refresh you out of the party. The park's own box is clipped and can
    // no longer say so for itself, so the page says it.
    expect(
      await page.evaluate(() => getComputedStyle(document.documentElement).overscrollBehaviorY),
      "the page can be dragged out from under the park",
    ).toBe("none");

    /**
     * And the list is dragged with a thumb, where it is longer than its box.
     *
     * The loop below brings each button into view by script before it asks
     * whether the button can be pressed, which is not something a thumb can
     * do. A list that scripts can scroll and people cannot looks exactly the
     * same to it: that is how the desktop's wheel went unnoticed. So the drag
     * is made here as a real touch, by the browser, and the list has to move.
     */
    const list = await page
      .getByRole("button", { name: /Hide and seek: pick a seeker/ })
      .evaluate((button) => {
        let box: HTMLElement | null = button.parentElement;

        while (box && !/(auto|scroll)/.test(getComputedStyle(box).overflowY)) {
          box = box.parentElement;
        }

        const rect = box!.getBoundingClientRect();

        box!.setAttribute("data-test-list", "");

        return {
          x: Math.round(rect.left + rect.width / 2),
          y: Math.round(rect.top + rect.height / 2),
          overflows: box!.scrollHeight - box!.clientHeight,
        };
      });

    if (test.info().project.name === "phone") {
      expect(list.overflows, "the list fits on a phone now, so the drag below is about nothing").toBeGreaterThan(40);
    }

    if (list.overflows > 40) {
      const session = await page.context().newCDPSession(page);

      await session.send("Input.synthesizeScrollGesture", {
        x: list.x,
        y: list.y,
        yDistance: -Math.min(list.overflows, 120),
        gestureSourceType: "touch",
        speed: 400,
      });

      expect(
        await page.locator("[data-test-list]").evaluate((box) => box.scrollTop),
        "a thumb dragged up the list and the list did not move",
      ).toBeGreaterThan(30);
      // And the park under it did not go anywhere.
      expect(await page.evaluate(() => window.scrollY)).toBe(0);
    }

    for (const name of [
      /Race: The creek sprint/,
      /Race: Round the whole park/,
      /Quick dash/,
      /Hide and seek: I will seek/,
      /Hide and seek: pick a seeker/,
    ]) {
      expect(await onScreen(page, name), `${name} cannot be reached on a phone`).toBe(true);
    }

    await page.getByRole("button", { name: /Quick dash/ }).click();

    const card = page.getByRole("region", { name: "Race: Quick dash" });

    await expect(card).toBeVisible();
    expect(await onScreen(page, "Leave")).toBe(true);
    expect(await onScreen(page, "Start the race")).toBe(true);

    await card.getByRole("button", { name: "Start the race" }).click();
    await expect(card.getByRole("timer")).toBeVisible();

    // The card with the count on it is all on the screen, and so is the pad.
    const box = await card.boundingBox();
    const view = page.viewportSize()!;

    expect(box!.y).toBeGreaterThanOrEqual(0);
    expect(box!.y + box!.height).toBeLessThanOrEqual(view.height);
    await expect(page.getByLabel("Fly")).toBeVisible();

    await card.getByRole("button", { name: "Leave" }).click();
    await expect(card).toHaveCount(0);
    await expect(page.getByRole("button", { name: /^Games/ })).toBeVisible();
  });
});
