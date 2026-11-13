import { expect, test, type Page } from "@playwright/test";

import { scatterFoliage } from "../src/features/game/world/scatter";
import { startPosition } from "../src/features/game/world/terrain";
import { enterGame, hold, readout } from "./helpers";

/**
 * How flying feels, pinned where it can be measured.
 *
 * The rule for this pass was that nothing gets faster or slower: the flight
 * helpers steer the whole suite by dead reckoning at 26, 2 and 17, and so does
 * a player's hand. What changed is how the bee gets up to those speeds and what
 * its body, the camera and the speakers do while it is there. So the first test
 * here is the one that protects everything else: a held climb still covers what
 * it always covered.
 */

type Bee = { x: number; y: number; z: number; pitch: number; roll: number; squash: number };

const bee = (page: Page) =>
  page.evaluate(() => {
    type Node = {
      userData: { playerBee?: boolean };
      position: { x: number; y: number; z: number };
      rotation: { x: number; z: number };
      scale: { y: number };
      children: Node[];
    };
    let found: Node | null = null;
    const walk = (node: Node) => {
      if (node.userData?.playerBee) found = node;
      node.children.forEach(walk);
    };

    walk((window as unknown as { __scoutScene: Node }).__scoutScene);

    const node = found as unknown as Node;

    return {
      x: node.position.x,
      y: node.position.y,
      z: node.position.z,
      pitch: node.rotation.x,
      roll: node.rotation.z,
      squash: node.scale.y,
    } as Bee;
  });

const fov = (page: Page) =>
  page.evaluate(() => (window as unknown as { __scoutCamera: { fov: number } }).__scoutCamera.fov);

const sounds = (page: Page) =>
  page.evaluate(() => (window as unknown as { __scoutSounds: string[] }).__scoutSounds);

test.describe("how flying feels", () => {
  test.describe.configure({ timeout: 150_000 });

  test("a held climb covers what it always did, then stops", async ({ page }) => {
    await enterGame(page);

    const before = Number.parseFloat((await readout(page)).Altitude);

    await hold(page, "KeyE", 1000);
    await page.waitForTimeout(700);

    const after = Number.parseFloat((await readout(page)).Altitude);

    // Seventeen units a second, for a second. Easing in loses a little and
    // coasting out gives it back.
    expect(after - before, "a second of climb no longer covers seventeen units").toBeGreaterThan(15);
    expect(after - before, "the bee coasts on long after the key is up").toBeLessThan(19.5);

    await page.waitForTimeout(400);

    const settled = Number.parseFloat((await readout(page)).Altitude);

    expect(Math.abs(settled - after), "still drifting a second after letting go").toBeLessThan(0.3);
  });

  test("the nose goes up into a climb, down into a dive, and level again", async ({ page }) => {
    await enterGame(page);

    await page.keyboard.down("KeyE");
    await page.waitForTimeout(500);
    const climbing = await bee(page);

    await page.keyboard.up("KeyE");
    await page.waitForTimeout(900);
    const level = await bee(page);

    await page.keyboard.down("KeyQ");
    await page.waitForTimeout(500);
    const diving = await bee(page);

    await page.keyboard.up("KeyQ");

    expect(climbing.pitch, "no nose-up in a climb").toBeGreaterThan(0.15);
    expect(diving.pitch, "no nose-down in a dive").toBeLessThan(-0.15);
    expect(Math.abs(level.pitch), "still pitched after levelling off").toBeLessThan(0.05);
  });

  test("the view widens when the bee hurries, and comes back", async ({ page }) => {
    await enterGame(page);

    expect(await fov(page)).toBeCloseTo(52, 0);

    await page.keyboard.down("ShiftLeft");
    await page.keyboard.down("ArrowUp");
    await page.waitForTimeout(1100);
    const hurrying = await fov(page);

    await page.keyboard.up("ArrowUp");
    await page.keyboard.up("ShiftLeft");
    await page.waitForTimeout(1600);

    expect(hurrying, "boosting did nothing to the view").toBeGreaterThan(55.5);
    expect(await fov(page), "the view stayed wide after the boost").toBeLessThan(52.6);
  });

  test("and does not, for anybody who asked for less motion", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await enterGame(page);

    await page.keyboard.down("ShiftLeft");
    await page.keyboard.down("ArrowUp");
    await page.waitForTimeout(1100);
    const hurrying = await fov(page);

    await page.keyboard.up("ArrowUp");
    await page.keyboard.up("ShiftLeft");

    expect(hurrying, "the lens moved under reduced motion").toBeCloseTo(52, 1);
  });

  test("flying into a tree is one bump, not one a frame", async ({ page }) => {
    await page.addInitScript(() => {
      (window as unknown as { __scoutSounds: string[] }).__scoutSounds = [];
    });
    await enterGame(page);

    // The nearest thing with a trunk. The scatter is deterministic, so ask.
    const [sx, , sz] = startPosition();
    const scatter = scatterFoliage();
    const trunk = [...scatter.oak, ...scatter.hemlock, ...scatter.snag]
      .map((placement) => ({
        x: placement.position[0],
        z: placement.position[2],
        distance: Math.hypot(placement.position[0] - sx, placement.position[2] - sz),
      }))
      .sort((a, b) => a.distance - b.distance)[0];
    // Forward is (sin y, 0, -cos y), and the bee starts facing zero.
    const bearing = Math.atan2(trunk.x - sx, -(trunk.z - sz));

    await hold(page, bearing > 0 ? "ArrowRight" : "ArrowLeft", (Math.abs(bearing) / 2) * 1000);

    await page.keyboard.down("ShiftLeft");
    await page.keyboard.down("ArrowUp");
    // Long enough to get there at a boost, and then to lean on it for a while.
    await page.waitForTimeout((trunk.distance / 57) * 1000 + 2500);
    await page.keyboard.up("ArrowUp");
    await page.keyboard.up("ShiftLeft");

    const bumps = (await sounds(page)).filter((name) => name === "bump").length;

    expect(bumps, "flew into a tree in silence").toBeGreaterThanOrEqual(1);
    expect(bumps, "one collision made a drum roll").toBeLessThanOrEqual(3);
    // And the boost itself announced itself, once.
    expect((await sounds(page)).filter((name) => name === "boost").length).toBe(1);
  });
});
