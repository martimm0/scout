import { expect, test } from "@playwright/test";

import { enterGame, findPlant, hold, readout } from "./helpers";

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

    await expect(page.getByRole("button", { name: /Pollinate/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /Read more/ })).toBeVisible();
  });

  test("Space opens a minigame — it does not just succeed", async ({ page }) => {
    await enterGame(page);

    expect(await findPlant(page)).toBe(true);

    await page.keyboard.press("Space");

    const minigame = page.getByRole("dialog", { name: /Pollinating/ });
    await expect(minigame).toBeVisible();

    // The plant must NOT be pollinated merely by pressing the key.
    const state = await readout(page);
    expect(state.Pollinated).toBe("0");
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

    const minigame = page.getByRole("dialog", { name: /Pollinating/ });
    await expect(minigame).toBeVisible();

    // Play whichever game came up: chase the ring, mash Space, answer the cue.
    for (let i = 0; i < 30; i += 1) {
      const ring = await page
        .locator('[class*="ring"]')
        .first()
        .boundingBox()
        .catch(() => null);

      if (ring) {
        await page.mouse.move(ring.x + ring.width / 2, ring.y + ring.height / 2);
      }

      await page.keyboard.press("Space");
      await page.keyboard.press("ArrowUp");
      await page.waitForTimeout(100);
    }

    // Every attempt resolves within the minigame's duration. It must never hang.
    await expect(
      minigame.getByText(/Pollinated|Not this time/),
    ).toBeVisible({ timeout: 12_000 });

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
