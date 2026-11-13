import { expect, test, type Page } from "@playwright/test";

import { perchPoint } from "../src/features/game/world/perch";
import { enterGame, findPlant, nearestPlantToSpawn, readout } from "./helpers";

/**
 * Landing is something the bee does.
 *
 * It used to be a card that opened while the bee hung in the air nine units
 * from the flower it was supposedly standing on. Now the bee that is drawn
 * flies down and settles on the flower, and lifts off when it is done. The bee
 * that is flown does not move at all, and both halves are checked: the drawn
 * one against the flower, the flown one against where it was.
 */

const drawnBee = (page: Page) =>
  page.evaluate(() => {
    type Node = {
      userData: { playerBee?: boolean };
      position: { x: number; y: number; z: number };
      children: Node[];
    };
    let found: Node | null = null;
    const walk = (node: Node) => {
      if (node.userData?.playerBee) found = node;
      node.children.forEach(walk);
    };

    walk((window as unknown as { __scoutScene: Node }).__scoutScene);

    const { x, y, z } = (found as unknown as Node).position;

    return { x, y, z };
  });

const sounds = (page: Page) =>
  page.evaluate(() => (window as unknown as { __scoutSounds: string[] }).__scoutSounds);

const apart = (a: { x: number; y: number; z: number }, b: number[]) =>
  Math.hypot(a.x - b[0], a.y - b[1], a.z - b[2]);

test.describe("landing", () => {
  test.describe.configure({ timeout: 180_000 });

  test("the bee settles on the flower, and the flight position stays put", async ({ page }) => {
    await page.addInitScript(() => {
      (window as unknown as { __scoutSounds: string[] }).__scoutSounds = [];
    });
    await enterGame(page);
    expect(await findPlant(page), "never got near the flower").toBe(true);

    const perch = perchPoint(nearestPlantToSpawn());
    const hovering = await drawnBee(page);
    const flown = await readout(page);

    await page.keyboard.press("Space");
    await expect(page.getByRole("button", { name: "Take off" })).toBeVisible();
    await page.waitForTimeout(1200);

    const settled = await drawnBee(page);

    expect(apart(settled, perch), "the drawn bee is not on the flower").toBeLessThan(1.2);
    // It had somewhere to go: landing from where you stopped is not a no-op.
    expect(apart(hovering, perch)).toBeGreaterThan(apart(settled, perch));

    const during = await readout(page);

    expect(during.Position, "landing moved the flight position").toBe(flown.Position);
    expect(Math.abs(Number.parseFloat(during.Altitude) - Number.parseFloat(flown.Altitude))).toBeLessThan(0.3);

    await page.keyboard.press("Escape");
    await expect(page.getByRole("button", { name: "Take off" })).toHaveCount(0);
    await page.waitForTimeout(1300);

    const back = await drawnBee(page);

    expect(
      Math.hypot(back.x - hovering.x, back.z - hovering.z),
      "the bee did not come back to where it was flying",
    ).toBeLessThan(0.6);

    const heard = await sounds(page);

    expect(heard.indexOf("land"), "landing was silent").toBeGreaterThanOrEqual(0);
    expect(heard.indexOf("takeoff"), "take-off was silent").toBeGreaterThan(heard.indexOf("land"));
  });

  test("the landing is shown before the card comes up", async ({ page }) => {
    await enterGame(page);
    expect(await findPlant(page), "never got near the flower").toBe(true);

    const perch = perchPoint(nearestPlantToSpawn());
    const hovering = await drawnBee(page);
    const takeOff = page.getByRole("button", { name: "Take off" });

    await page.keyboard.press("Space");
    await page.waitForTimeout(350);

    // A third of a second in: the bee is on its way down, and nothing is in
    // front of it yet.
    expect(await takeOff.count(), "the card came up over the landing").toBe(0);
    expect(apart(await drawnBee(page), perch), "the bee has not started down").toBeLessThan(
      apart(hovering, perch),
    );

    // And the controls are already frozen, card or no card.
    const before = await readout(page);

    await page.keyboard.press("KeyW");
    await page.keyboard.press("KeyE");

    await expect(takeOff).toBeVisible();
    expect((await readout(page)).Position, "the bee could still be flown while landing").toBe(
      before.Position,
    );
  });

  test("with less motion asked for, the card does not wait", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await enterGame(page);
    expect(await findPlant(page), "never got near the flower").toBe(true);

    await page.keyboard.press("Space");
    await expect(page.getByRole("button", { name: "Take off" })).toBeVisible({ timeout: 400 });
  });

  test("it stays on the flower through the minigame", async ({ page }) => {
    await enterGame(page);
    expect(await findPlant(page)).toBe(true);

    const perch = perchPoint(nearestPlantToSpawn());

    await page.keyboard.press("Space");
    await page.getByRole("button", { name: /^Pollinate/ }).click();
    await page.waitForTimeout(1500);

    // The card that held it is gone, and the bee has not gone anywhere.
    expect(apart(await drawnBee(page), perch), "the bee left the flower mid-minigame").toBeLessThan(1.2);
  });
});
