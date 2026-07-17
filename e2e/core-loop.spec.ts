import { expect, test } from "@playwright/test";

import {
  enterGame,
  findPlant,
  hold,
  playMinigame,
  readout,
} from "./helpers";

/**
 * The core loop: fly, find, pollinate, learn.
 *
 * These are slow because they drive a real 3D game in a real browser. That is
 * the point — every serious bug in this project's history typechecked cleanly
 * and only surfaced when something actually flew the bee.
 */

test.describe("core loop", () => {
  test("the bee flies, and flying unlocks areas", async ({ page }) => {
    await enterGame(page);

    const start = await readout(page);
    expect(start.Area).toBe("Frick Environmental Center");
    expect(start.Areas).toBe("1");

    // Fly a long way in one direction.
    await hold(page, "ArrowUp", 8000);

    const after = await readout(page);

    // Somewhere else, and the somewhere-else was recorded.
    expect(after.Position).not.toBe(start.Position);
    expect(Number(after.Areas)).toBeGreaterThan(1);
  });

  test("mouse look steers the bee rather than merely looking", async ({ page }) => {
    await enterGame(page);

    const before = await readout(page);
    expect(before.Heading).toBe("0 deg");

    // Plain mouse movement over the canvas — no click, no button held.
    const canvas = page.locator("canvas").first();
    const box = await canvas.boundingBox();

    if (!box) {
      throw new Error("no canvas");
    }

    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2;

    await page.mouse.move(cx - 150, cy);

    for (let i = 0; i <= 12; i += 1) {
      await page.mouse.move(cx - 150 + i * 25, cy);
      await page.waitForTimeout(40);
    }

    await page.waitForTimeout(400);

    // Dragging right must turn RIGHT. Getting this sign backwards mirrors the
    // whole world, and it shipped that way once.
    const after = await readout(page);
    expect(Number.parseInt(after.Heading, 10)).toBeGreaterThan(5);
  });

  test("approaching a plant discovers it and offers the interaction", async ({
    page,
  }) => {
    await enterGame(page);

    expect(await findPlant(page)).toBe(true);

    const state = await readout(page);
    expect(Number(state.Found.split("/")[0])).toBeGreaterThan(0);

    await expect(page.getByRole("button", { name: /^Land/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /^Read/ })).toBeVisible();
  });

  test("Space lands, and landing offers the choice rather than taking it", async ({
    page,
  }) => {
    await enterGame(page);

    expect(await findPlant(page)).toBe(true);

    await page.keyboard.press("Space");

    // Landing puts you on the flower and asks. It does not pollinate for you.
    const menu = page.getByRole("dialog", { name: /Landed/ });
    await expect(menu).toBeVisible();
    await expect(menu.getByRole("button", { name: /Pollinate/ })).toBeVisible();
    await expect(menu.getByRole("button", { name: /quiz/i })).toBeVisible();

    const state = await readout(page);
    expect(state.Pollinated).toBe("0");
  });

  test("pressing Space then Pollinate opens the minigame", async ({ page }) => {
    await enterGame(page);

    expect(await findPlant(page)).toBe(true);

    await page.keyboard.press("Space");
    await page.getByRole("button", { name: /Pollinate/ }).click();

    const minigame = page.getByRole("dialog", { name: /Pollinating/ });
    await expect(minigame).toBeVisible();

    // The plant must NOT be pollinated merely by opening the game.
    const state = await readout(page);
    expect(state.Pollinated).toBe("0");
  });

  test("the quiz asks three questions and explains itself either way", async ({
    page,
  }) => {
    await enterGame(page);

    expect(await findPlant(page)).toBe(true);

    await page.keyboard.press("Space");
    await page.getByRole("button", { name: /quiz/i }).click();

    const quiz = page.getByRole("dialog", { name: /Quiz/i });
    await expect(quiz).toBeVisible();

    for (let question = 1; question <= 3; question += 1) {
      await expect(quiz.getByText(`question ${question} of 3`)).toBeVisible();

      // Answer with the first option, right or wrong. What is under test is that
      // the quiz explains itself either way and always reaches the end.
      await quiz.locator("ul li button").first().click();

      const onward = quiz.getByRole("button", { name: /Next|See the score/ });
      await expect(onward).toBeVisible();
      await onward.click();
    }

    // Whatever the score, it says so and lets you leave.
    await expect(quiz.getByText(/Passed|Not quite/)).toBeVisible();
    await expect(quiz.getByRole("button", { name: "Carry on" })).toBeVisible();
  });

  test("a pollination attempt always resolves, and either outcome is kind", async ({
    page,
  }) => {
    // Flying to a plant and then playing a 4-6 second minigame to completion
    // genuinely takes a while. This is the slowest test in the suite and the
    // most important one.
    test.setTimeout(240_000);

    await enterGame(page);

    expect(await findPlant(page)).toBe(true);

    await page.keyboard.press("Space");
    await page.getByRole("button", { name: /Pollinate/ }).click();

    const minigame = page.getByRole("dialog", { name: /Pollinating/ });
    await expect(minigame).toBeVisible();

    // Play whichever game came up, driven by the kind it says it is. The new
    // games run 12 to 16 seconds and none of them can be lost or won by flailing,
    // so this plays right up to the clock.
    await playMinigame(page, 18);

    // Every attempt resolves. It must never hang, whatever you did.
    await expect(
      minigame.getByText(/Pollinated|Not this time/),
    ).toBeVisible({ timeout: 20_000 });

    // Both outcomes teach something, and neither scolds.
    await expect(
      minigame.getByRole("button", { name: /Carry on|Try another/ }),
    ).toBeVisible();
  });

  test("R opens the full entry, with a photo and a Wikipedia link", async ({
    page,
  }) => {
    await enterGame(page);

    expect(await findPlant(page)).toBe(true);

    await page.keyboard.press("KeyR");

    const entry = page.getByRole("dialog");
    await expect(entry).toBeVisible();
    await expect(entry.getByRole("img")).toBeVisible();

    const wiki = entry.getByRole("link", { name: /Wikipedia/ });
    await expect(wiki).toBeVisible();
    await expect(wiki).toHaveAttribute(
      "href",
      /^https:\/\/en\.wikipedia\.org\/wiki\//,
    );

    // Attribution is a licence term, not a nicety. It must be on screen.
    await expect(entry.locator("figcaption")).toBeVisible();

    // And it must fit without the reader fighting a scrollbar.
    const fits = await entry.evaluate(
      (el) => el.scrollHeight <= el.clientHeight + 2,
    );
    expect(fits).toBe(true);
  });
});
