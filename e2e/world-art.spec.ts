import { expect, test, type Page } from "@playwright/test";

import { columnTop, waterLevel } from "../src/features/game/world/terrain";
import { buildTerrainGeometry } from "../src/features/game/world/terrain-mesh";
import { enterGame, whole } from "./helpers";

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

/**
 * Everything planted in the park as it is drawn: each instance of the trees,
 * the grass and the small stuff, and each flower and fungus.
 */
const planted = (page: Page) =>
  page.evaluate(() => {
    type Node = {
      isInstancedMesh?: boolean;
      count?: number;
      instanceMatrix?: { array: ArrayLike<number> };
      userData: { planted?: boolean; shadowOnly?: boolean; plant?: string };
      position: { x: number; y: number; z: number };
      children: Node[];
    };
    const meshes: { count: number; at: [number, number, number][] }[] = [];
    const plants: [number, number, number][] = [];
    const walk = (node: Node) => {
      if (node.isInstancedMesh && node.userData?.planted && !node.userData.shadowOnly) {
        const matrix = (node.instanceMatrix as { array: ArrayLike<number> }).array;
        const count = node.count as number;
        const at: [number, number, number][] = [];
        // Up to a couple of hundred of each, spread through the whole list.
        const stride = Math.max(1, Math.floor(count / 200));

        for (let index = 0; index < count; index += stride) {
          at.push([matrix[index * 16 + 12], matrix[index * 16 + 13], matrix[index * 16 + 14]]);
        }

        meshes.push({ count, at });
      }

      if (node.userData?.plant) {
        plants.push([node.position.x, node.position.y, node.position.z]);
      }

      node.children.forEach(walk);
    };

    walk((window as unknown as { __scoutScene: Node }).__scoutScene);

    return { meshes, plants };
  });

test.describe("what is planted, on the fine park", () => {
  test.describe.configure({ timeout: 180_000 });

  test.beforeEach(async ({ page }) => {
    await enterGame(page);
    await page.goto("/play?debug=1&hour=13&month=7&weather=clear&quality=high");
    await page.waitForSelector("canvas");
    await whole(page);
  });

  test("is where it was scattered once the fine models are in", async ({ page }) => {
    /**
     * The whole lawn stood on one spot. An instanced mesh is remounted when its
     * model sharpens, a new one starts with every instance at the origin, and
     * the grass (alone: its placements are the same array every render) was
     * never laid out again. Thousands of blades, one on top of another, at the
     * middle of the map.
     */
    const { meshes } = await planted(page);

    expect(meshes.length, "nothing planted was found in the scene").toBeGreaterThan(10);

    for (const mesh of meshes.filter((candidate) => candidate.count > 40)) {
      const xs = mesh.at.map(([x]) => x);

      expect(
        Math.max(...xs) - Math.min(...xs),
        `${mesh.count} of something are standing in one place`,
      ).toBeGreaterThan(60);
    }
  });

  test("stands on the ground as it is drawn, not over it", async ({ page }) => {
    /**
     * The fine ground is stepped, a whole unit at a time, and sits up to a unit
     * under the height everything is scattered on. Flowers hovered over it by
     * as much as half a unit and the grass by as much again.
     */
    const { meshes, plants } = await planted(page);
    const floating = (x: number, y: number, z: number) =>
      // The lily pads float, and are meant to.
      columnTop(x, z) < waterLevel() ? 0 : y - columnTop(x, z);

    expect(plants.length, "no flower or fungus was found in the scene").toBeGreaterThan(20);

    const worst = Math.max(
      ...plants.map(([x, y, z]) => floating(x, y, z)),
      ...meshes.flatMap((mesh) => mesh.at.map(([x, y, z]) => floating(x, y, z))),
    );

    expect(worst, "something is hovering over the ground").toBeLessThanOrEqual(0.001);
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
