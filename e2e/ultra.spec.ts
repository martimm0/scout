import { expect, test, type Page } from "@playwright/test";

import { PLANTS } from "../src/features/game/data/plants";
import { buildPlantGeometry } from "../src/features/game/models/flora";
import { latticeOf } from "../src/features/game/models/lattice";
import { buildPollinatorGeometry } from "../src/features/game/models/pollinators";
import { parseQuality } from "../src/features/game/models/quality";
import { triangleCount } from "../src/features/game/models/voxel-grid";
import { LOOKS, surface } from "../src/features/game/world/surface";
import { enterGame, findPlant, openPlay, pinPanels, whole } from "./helpers";

/**
 * Ultra: High's park, photographed.
 *
 * The same blocks, lit and shaded the way a model on a table would be. Three
 * promises are checked here. It is never anybody's default and it has its own
 * switch, so nobody passes through it on the way to Low. When it is on, the
 * picture really is going through the lens and the materials really are the
 * physically based ones (it would be easy to ship a switch that changed a
 * label). And when it is off again, everything it built is gone.
 */

type Material = { isMeshStandardMaterial?: boolean; isMeshLambertMaterial?: boolean };
type Node = {
  isMesh?: boolean;
  isInstancedMesh?: boolean;
  material?: Material | Material[];
  userData: { planted?: boolean; shadowOnly?: boolean };
  children: Node[];
  environment?: unknown;
};

const ultra = (page: Page) => page.getByRole("button", { name: /^Ultra:/ });
const detail = (page: Page) => page.getByRole("button", { name: /^Detail:/ });

/** What the scene is made of right now, and whether the sky is lighting it. */
const state = (page: Page) =>
  page.evaluate(() => {
    const scene = (window as unknown as { __scoutScene: Node }).__scoutScene;
    let physical = 0;
    let matte = 0;
    const walk = (node: Node) => {
      if (node.isInstancedMesh && node.userData?.planted && !node.userData.shadowOnly) {
        const material = (Array.isArray(node.material) ? node.material[0] : node.material) as Material;

        if (material.isMeshStandardMaterial) physical += 1;
        if (material.isMeshLambertMaterial) matte += 1;
      }

      node.children.forEach(walk);
    };

    walk(scene);

    const gl = (window as unknown as { __scoutGl: { info: { memory: { textures: number } } } }).__scoutGl;

    return {
      lens: document.documentElement.dataset.scoutUltra ?? "off",
      lit: scene.environment != null,
      matte,
      physical,
      textures: gl.info.memory.textures,
    };
  });

/** Past the walkthrough, with Controls pinned open so the switches are on screen. */
async function arrive(page: Page, subject: string, query = "") {
  await openPlay(page, subject);

  if (query) {
    await page.goto(`/play?debug=1&hour=13&month=7&weather=clear${query}`);
    await page.waitForTimeout(2500);
  }

  await page.getByRole("button", { name: "Skip", exact: true }).click();
  await pinPanels(page);
}

test.describe("ultra", () => {
  test.describe.configure({ timeout: 240_000 });

  test("is off until asked for, and is its own switch", async ({ page }) => {
    await arrive(page, "ultra-switch");
    await whole(page);

    await expect(ultra(page)).toHaveAttribute("data-ultra", "off");
    await expect(detail(page)).toHaveAttribute("data-quality", "high");

    const before = await state(page);

    expect(before.lens, "the lens is on for somebody who never asked").toBe("off");
    expect(before.lit).toBe(false);
    expect(before.physical, "High is drawing Ultra's materials").toBe(0);
    expect(before.matte).toBeGreaterThan(10);

    await ultra(page).click();
    await expect(ultra(page)).toHaveAttribute("data-ultra", "on");
    // Ultra draws High's park: the detail switch says so, and one press of it
    // goes to Low, not round through anything heavier.
    await expect(detail(page)).toHaveText("Detail: High");
    await page.waitForTimeout(800);
    await whole(page);

    const on = await state(page);

    expect(on.lens, "the picture is not going through the lens").toBe("on");
    expect(on.lit, "the sky is not lighting the park").toBe(true);
    expect(on.matte, "something planted is still matte").toBe(0);
    expect(on.physical).toBeGreaterThan(10);

    await detail(page).click();
    await expect(detail(page)).toHaveAttribute("data-quality", "low");
    await expect(ultra(page)).toHaveAttribute("data-ultra", "off");
  });

  test("off again leaves nothing of itself behind", async ({ page }) => {
    await arrive(page, "ultra-round-trip", "&quality=high");
    await page.goto("/play?debug=1&hour=13&month=7&weather=clear");
    await page.waitForTimeout(2500);
    await pinPanels(page);
    await whole(page);

    const before = await state(page);

    for (let trip = 0; trip < 2; trip += 1) {
      await ultra(page).click();
      await expect(ultra(page)).toHaveAttribute("data-ultra", "on");
      await page.waitForTimeout(800);
      await whole(page);
      await page.waitForTimeout(1200);
      await ultra(page).click();
      await expect(ultra(page)).toHaveAttribute("data-ultra", "off");
      await page.waitForTimeout(800);
      await whole(page);
    }

    const after = await state(page);

    expect(after.lens).toBe("off");
    expect(after.lit, "the sky is still lighting a park that is back on High").toBe(false);
    expect(after.physical).toBe(0);
    // The lens's buffers, the sky's environment and the water's depth map.
    expect(after.textures, "Ultra's pictures were never let go").toBeLessThanOrEqual(before.textures + 2);
  });

  test("draws a picture, and a different one from High", async ({ page }) => {
    /**
     * Mean brightness and how much of the frame is not one flat tone, read off
     * the canvas itself. A pipeline that is wired up wrong draws black, or
     * white, or the last frame for ever; a pipeline that is not wired up at all
     * draws exactly what High does.
     */
    const picture = () =>
      page.evaluate(async () => {
        const canvas = document.querySelector("canvas") as HTMLCanvasElement;
        const image = new Image();

        image.src = canvas.toDataURL("image/png");
        await image.decode();

        const small = document.createElement("canvas");

        small.width = 96;
        small.height = 54;

        const context = small.getContext("2d") as CanvasRenderingContext2D;

        context.drawImage(image, 0, 0, small.width, small.height);

        const { data } = context.getImageData(0, 0, small.width, small.height);
        const luma: number[] = [];

        for (let i = 0; i < data.length; i += 4) {
          luma.push((data[i] * 0.2126 + data[i + 1] * 0.7152 + data[i + 2] * 0.0722) / 255);
        }

        const mean = luma.reduce((sum, value) => sum + value, 0) / luma.length;
        const spread = Math.sqrt(luma.reduce((sum, value) => sum + (value - mean) ** 2, 0) / luma.length);

        return { luma, mean, spread };
      });

    await enterGame(page);
    await page.goto("/play?debug=1&hour=13&month=7&weather=clear&quality=high");
    await page.waitForSelector("canvas");
    await whole(page);
    await page.waitForTimeout(1500);

    const high = await picture();

    await page.goto("/play?debug=1&hour=13&month=7&weather=clear&quality=ultra");
    await page.waitForSelector("canvas");
    await whole(page);
    await page.waitForTimeout(2500);

    const photographed = await picture();

    expect(photographed.mean, "ultra drew black").toBeGreaterThan(0.12);
    expect(photographed.mean, "ultra drew white").toBeLessThan(0.9);
    expect(photographed.spread, "ultra drew one flat tone").toBeGreaterThan(0.06);

    const difference =
      photographed.luma.reduce((sum, value, index) => sum + Math.abs(value - high.luma[index]), 0) /
      photographed.luma.length;

    expect(difference, "ultra drew the same picture High does").toBeGreaterThan(0.015);
  });

  test("the lens is on the bee, and comes in when it lands", async ({ page }) => {
    const lens = () =>
      page.evaluate(() => {
        type Vec = { x: number; y: number; z: number; distanceTo(other: Vec): number };
        type Bee = { userData: { playerBee?: boolean }; position: Vec; children: Bee[] };
        const host = window as unknown as {
          __scoutScene: Bee;
          __scoutCamera: { position: Vec };
          __scoutUltra: {
            lens: { cocMaterial: { focusDistance: number; uniforms: { focusSharp: { value: number } } } };
          };
        };
        let bee: Bee | null = null;
        const walk = (node: Bee) => {
          if (node.userData?.playerBee) bee = node;
          node.children.forEach(walk);
        };

        walk(host.__scoutScene);

        return {
          focused: host.__scoutUltra.lens.cocMaterial.focusDistance,
          sharp: host.__scoutUltra.lens.cocMaterial.uniforms.focusSharp.value,
          toBee: host.__scoutCamera.position.distanceTo((bee as unknown as Bee).position),
        };
      });

    await enterGame(page);
    await page.goto("/play?debug=1&hour=13&month=7&weather=clear&quality=ultra");
    await page.waitForSelector("canvas");
    await whole(page);
    await page.getByRole("button", { name: "Skip", exact: true }).click();
    expect(await findPlant(page), "never got near the flower").toBe(true);
    await page.waitForTimeout(800);

    const flying = await lens();

    expect(Math.abs(flying.focused - flying.toBee), "the lens is focused somewhere else").toBeLessThan(1.5);
    // Flying, a long way either side of the bee is sharp: the flowers the
    // player is looking for are out there.
    expect(flying.sharp).toBeGreaterThan(50);

    await page.keyboard.press("Space");
    await expect(page.getByRole("button", { name: "Take off" })).toBeVisible();
    await page.waitForTimeout(3000);

    const landed = await lens();

    expect(Math.abs(landed.focused - landed.toBee)).toBeLessThan(1.5);
    expect(landed.sharp, "the lens did not come in for the landing").toBeLessThan(15);
  });

  test("?quality=ultra pins it, and the choice is remembered", async ({ page }) => {
    await arrive(page, "ultra-pin", "&quality=ultra");
    await expect(ultra(page)).toHaveAttribute("data-ultra", "on");

    await page.goto("/play?debug=1&hour=13&month=7&weather=clear");
    await page.waitForTimeout(2500);
    await pinPanels(page);
    // A pin is not a choice: without it the park is back on High.
    await expect(ultra(page)).toHaveAttribute("data-ultra", "off");

    await ultra(page).click();
    await expect(ultra(page)).toHaveAttribute("data-ultra", "on");
    await page.reload();
    await page.waitForTimeout(3000);
    await pinPanels(page);
    await expect(ultra(page), "the park forgot it was asked for ultra").toHaveAttribute("data-ultra", "on");
  });
});

test.describe("ultra, as data", () => {
  test.skip(({ browserName }) => browserName !== "chromium", "no browser involved");

  test("is a quality the address bar can name", () => {
    expect(parseQuality("ultra")).toBe("ultra");
    expect(parseQuality("extreme")).toBeUndefined();
  });

  test("builds the flowers and the bee finer than High does", () => {
    const plant = PLANTS[0];

    expect(triangleCount(buildPlantGeometry(plant, "ultra"))).toBeGreaterThan(
      triangleCount(buildPlantGeometry(plant, "high")) * 1.3,
    );

    const colors = { bodyColor: "#f4c542", wingColor: "#cfe8ff", accentColor: "#222222" };
    const bee = (quality: "high" | "ultra") =>
      triangleCount(buildPollinatorGeometry("bee", colors, "round", "none", quality).abdomen);

    expect(bee("ultra")).toBeGreaterThan(bee("high") * 2);
    // One bee, close to the lens: finer is the point, but it is still one bee.
    expect(bee("ultra")).toBeLessThan(60_000);
  });

  test("every model says where its blocks are, for the bevel", () => {
    // The Ultra material leans the surface over at the edge of each block, and
    // it can only do that if the mesh remembers how big a block was.
    for (const quality of ["high", "ultra"] as const) {
      const lattice = latticeOf(buildPlantGeometry(PLANTS[0], quality));

      expect(lattice.size[0], quality).toBeGreaterThan(0);
      expect(lattice.size[0], quality).toBeLessThan(0.2);
      expect(lattice.offset, quality).toEqual([0.5, 0, 0.5]);
    }
  });

  test("gives High the matte material it always had, and Ultra a physical one", () => {
    type Kind = { isMeshLambertMaterial?: boolean; isMeshStandardMaterial?: boolean };

    expect((surface("high", LOOKS.tree) as Kind).isMeshLambertMaterial).toBe(true);
    expect((surface("low", LOOKS.tree) as Kind).isMeshLambertMaterial).toBe(true);
    expect((surface("ultra", LOOKS.tree) as Kind).isMeshStandardMaterial).toBe(true);
    // A swaying program and a still one, never shared with the stock material.
    expect(surface("ultra", { ...LOOKS.tree, sway: [10, 0.1] }).customProgramCacheKey()).toBe("scout-ultra-sway");
    expect(surface("ultra", LOOKS.ground).customProgramCacheKey()).toBe("scout-ultra");
  });
});
