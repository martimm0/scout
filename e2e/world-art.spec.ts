import { expect, test, type Page } from "@playwright/test";

import { buildTerrainGeometry } from "../src/features/game/world/terrain-mesh";
import { enterGame } from "./helpers";

/**
 * The park moves, and is lit.
 *
 * Nothing in it used to: the grass stood to attention in a storm, the creek was
 * a still blue sheet, and every few minutes the whole sky jumped sideways at
 * once. These check the movement that was added, and that all of it stops for
 * anybody who has asked for less of it.
 */

type Wind = { time: { value: number }; strength: { value: number }; flow: { value: number } };

const wind = (page: Page) =>
  page.evaluate(() => {
    const live = (window as unknown as { __scoutWind: Wind }).__scoutWind;

    return { time: live.time.value, strength: live.strength.value, flow: live.flow.value };
  });

/**
 * The water's clock, read out of the program the renderer actually compiled.
 *
 * Not the value the scene writes: the uniform bound to the creek's own shader.
 * If the ripple were never patched in, the compiled program would have no such
 * uniform and this would come back undefined, which is the failure a still
 * blue sheet would have. (Counting changed pixels was tried first and cannot
 * work: the camera bobs with the bee, so the creek changes on screen whether
 * it is running or not.)
 */
async function waterClock(page: Page) {
  return page.evaluate(() => {
    type Material = { customProgramCacheKey?: () => string };
    type Node = { material?: Material; children: Node[] };
    const holder = window as unknown as {
      __scoutScene: Node;
      __scoutGl: { properties: { get: (m: Material) => { uniforms?: Record<string, { value: number }> } } };
    };
    let water: Material | null = null;
    const walk = (node: Node) => {
      if (node.material?.customProgramCacheKey?.() === "scout-ripple") water = node.material;
      node.children.forEach(walk);
    };

    walk(holder.__scoutScene);

    return water ? holder.__scoutGl.properties.get(water).uniforms?.uWaterFlow?.value : undefined;
  });
}

test.describe("the park moves", () => {
  test.describe.configure({ timeout: 180_000 });

  test("the wind blows, harder in a storm", async ({ page }) => {
    await enterGame(page, 13, 7, "clear");
    await page.waitForTimeout(800);

    const calm = await wind(page);

    await page.waitForTimeout(700);

    const later = await wind(page);

    expect(later.time, "the wind's clock is stopped").toBeGreaterThan(calm.time);
    expect(calm.strength, "still air on an ordinary day").toBeGreaterThan(0);

    await page.goto("/play?debug=1&hour=13&month=7&weather=storm");
    await page.waitForTimeout(4000);

    expect((await wind(page)).strength, "a storm blew no harder than a clear day").toBeGreaterThan(
      calm.strength * 1.5,
    );
  });

  test("and holds still for anybody who asked for less motion", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await enterGame(page, 13, 7, "storm");
    await page.waitForTimeout(1200);

    const first = await wind(page);

    await page.waitForTimeout(800);

    const second = await wind(page);

    expect(first.strength, "leaves are swaying under reduced motion").toBe(0);
    expect(second.flow, "the water is running under reduced motion").toBe(first.flow);
  });

  test("the creek runs, and stops when asked", async ({ page }) => {
    await enterGame(page, 13, 7, "clear");
    await page.waitForTimeout(1200);

    const first = await waterClock(page);

    expect(first, "the creek's shader has no ripple in it").toBeDefined();

    await page.waitForTimeout(700);

    expect(await waterClock(page), "the water is a still sheet").toBeGreaterThan(first as number);

    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.waitForTimeout(600);

    const held = await waterClock(page);

    await page.waitForTimeout(700);

    expect(await waterClock(page), "the water still runs under reduced motion").toBe(held);
  });

  test("no cloud ever jumps across the sky", async ({ page }) => {
    await enterGame(page, 13, 7, "storm");
    await page.waitForTimeout(1500);

    const worst = await page.evaluate(async () => {
      type Mesh = {
        userData: { clouds?: boolean; drifted?: { current: number } };
        count: number;
        instanceMatrix: { array: Float32Array };
        children: Mesh[];
      };
      let clouds: Mesh | null = null;
      const walk = (node: Mesh) => {
        if (node.userData?.clouds) clouds = node;
        node.children.forEach(walk);
      };

      walk((window as unknown as { __scoutScene: Mesh }).__scoutScene);

      const mesh = clouds as unknown as Mesh;

      if (!mesh) {
        return -1;
      }

      const read = () =>
        Array.from({ length: mesh.count }, (_, i) => ({
          x: mesh.instanceMatrix.array[i * 16 + 12],
          // The X scale: a cloud at the edge has shrunk to nothing.
          size: Math.abs(mesh.instanceMatrix.array[i * 16]),
        }));
      let worst = 0;

      // Wind the drift on, a few times, so different clouds are at the edge.
      for (const offset of [0, 97, 211, 333, 478, 590]) {
        mesh.userData.drifted!.current = offset;
        await new Promise((resolve) => setTimeout(resolve, 120));

        let last = read();

        for (let step = 0; step < 14; step += 1) {
          await new Promise((resolve) => setTimeout(resolve, 100));

          const now = read();

          now.forEach((cloud, i) => {
            // A lump big enough to see that moved further than the wind carries one.
            if (cloud.size > 6 && last[i].size > 6) {
              worst = Math.max(worst, Math.abs(cloud.x - last[i].x));
            }
          });
          last = now;
        }
      }

      return worst;
    });

    expect(worst, "no clouds were drawn in a storm").toBeGreaterThanOrEqual(0);
    // Nine units a second is the fastest a cloud drifts; a tenth of a second
    // of that, with room for a slow frame, is nowhere near a wrap of 680.
    expect(worst, "a cloud jumped").toBeLessThan(20);
  });

  test("trees throw shadows on high, and not on low", async ({ page }) => {
    const casters = () =>
      page.evaluate(() => {
        type Node = { isInstancedMesh?: boolean; castShadow?: boolean; children: Node[] };
        let count = 0;
        const walk = (node: Node) => {
          if (node.isInstancedMesh && node.castShadow) count += 1;
          node.children.forEach(walk);
        };

        walk((window as unknown as { __scoutScene: Node }).__scoutScene);

        return count;
      });

    await enterGame(page);
    await page.goto("/play?debug=1&hour=13&month=7&quality=high");
    await page.waitForTimeout(4000);
    expect(await casters(), "no tree casts a shadow on high").toBeGreaterThan(0);

    await page.goto("/play?debug=1&hour=13&month=7&quality=low");
    await page.waitForTimeout(4000);
    expect(await casters(), "low is paying for tree shadows").toBe(0);
  });
});

test.describe("the ground", () => {
  test.skip(({ browserName }) => browserName !== "chromium", "no browser involved");

  /** Mean brightness of the faces whose centre is within `reach` of a point. */
  function brightnessNear(geometry: ReturnType<typeof buildTerrainGeometry>, x: number, z: number, reach: number) {
    const position = geometry.getAttribute("position");
    const color = geometry.getAttribute("color");
    let sum = 0;
    let count = 0;

    for (let i = 0; i < position.count; i += 3) {
      const cx = (position.getX(i) + position.getX(i + 1) + position.getX(i + 2)) / 3;
      const cz = (position.getZ(i) + position.getZ(i + 1) + position.getZ(i + 2)) / 3;

      if (Math.hypot(cx - x, cz - z) < reach) {
        sum += color.getX(i) + color.getY(i) + color.getZ(i);
        count += 1;
      }
    }

    return sum / count;
  }

  test("is darker under whatever stands on it, at either quality", () => {
    for (const quality of ["low", "high"] as const) {
      const open = buildTerrainGeometry(quality);
      const shaded = buildTerrainGeometry(quality, [{ x: 40, z: 30, radius: 24, depth: 0.3 }]);

      expect(brightnessNear(shaded, 40, 30, 8), `${quality}: no shade under the tree`).toBeLessThan(
        brightnessNear(open, 40, 30, 8) * 0.85,
      );
      // And only there.
      expect(brightnessNear(shaded, 140, 30, 8)).toBeCloseTo(brightnessNear(open, 140, 30, 8), 5);
    }
  });

  test("is drawn finer on high", () => {
    const low = buildTerrainGeometry("low").getAttribute("position").count;
    const high = buildTerrainGeometry("high").getAttribute("position").count;

    expect(high).toBeGreaterThan(low * 3.5);
  });
});
