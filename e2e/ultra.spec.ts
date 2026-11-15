import { expect, test, type Page } from "@playwright/test";

import { leafFall } from "../src/features/game/components/ultra-dust";
import { PLANTS } from "../src/features/game/data/plants";
import { buildPlantGeometry } from "../src/features/game/models/flora";
import { buildFoliageKind } from "../src/features/game/models/foliage";
import { buildLandmark } from "../src/features/game/models/landmarks";
import { latticeOf } from "../src/features/game/models/lattice";
import { MADE } from "../src/features/game/models/made";
import { buildPollinatorGeometry } from "../src/features/game/models/pollinators";
import { parseQuality } from "../src/features/game/models/quality";
import { triangleCount } from "../src/features/game/models/voxel-grid";
import { cloudShadow, mistiness } from "../src/features/game/world/air";
import { scatterGrass, scatterGrassNear } from "../src/features/game/world/scatter";
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
  layers?: { mask: number };
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
      // Not the stand-ins only the water sees (layer 2): those are matte on
      // purpose, since nobody can tell in a reflection.
      if (node.isInstancedMesh && node.userData?.planted && !node.userData.shadowOnly && node.layers?.mask !== 4) {
        const material = (Array.isArray(node.material) ? node.material[0] : node.material) as Material;

        if (material.isMeshStandardMaterial) physical += 1;
        if (material.isMeshLambertMaterial) matte += 1;
      }

      node.children.forEach(walk);
    };

    walk(scene);

    const gl = (
      window as unknown as { __scoutGl: { autoClear: boolean; info: { memory: { textures: number } } } }
    ).__scoutGl;

    // Things the switch must put back, each of which it once did not.
    let stacked = 0;
    let swayingFlowers = 0;
    let shadowReach = 0;
    const check = (node: Node) => {
      const any = node as unknown as {
        isInstancedMesh?: boolean;
        isMesh?: boolean;
        isDirectionalLight?: boolean;
        castShadow?: boolean;
        count: number;
        instanceMatrix: { array: ArrayLike<number> };
        customDepthMaterial?: unknown;
        shadow?: { camera: { projectionMatrix: { elements: number[] } } };
        parent?: { userData: { plant?: string } };
      };

      // Every instance of something in one place: a mesh rebuilt and never laid out.
      if (any.isInstancedMesh && node.userData?.planted && !node.userData.shadowOnly && any.count > 40) {
        const matrix = any.instanceMatrix.array;
        let least = Infinity;
        let most = -Infinity;

        for (let index = 0; index < any.count; index += 1) {
          least = Math.min(least, matrix[index * 16 + 12]);
          most = Math.max(most, matrix[index * 16 + 12]);
        }

        if (most - least < 60) stacked += 1;
      }

      if (any.isMesh && any.parent?.userData?.plant && any.customDepthMaterial) swayingFlowers += 1;

      // Half the width of the box the sun's shadows are drawn in, as the
      // light is actually using it (not as the props say).
      if (any.isDirectionalLight && any.castShadow && any.shadow) {
        shadowReach = Math.round(1 / any.shadow.camera.projectionMatrix.elements[0]);
      }

      node.children.forEach(check);
    };

    check(scene);

    return {
      clears: gl.autoClear,
      lens: document.documentElement.dataset.scoutUltra ?? "off",
      lit: scene.environment != null,
      matte,
      physical,
      shadowReach,
      stacked,
      swayingFlowers,
      textures: gl.info.memory.textures,
    };
  });

/**
 * The Controls panel, open and pinned, whatever state it was left in.
 *
 * `pinPanels` pins what is on screen when it runs, and on a slow browser the
 * Controls pin is sometimes not there yet. The panel then folds itself away a
 * few seconds later and takes the Ultra switch with it, in the middle of a
 * test that is about to press it.
 */
async function controls(page: Page) {
  const pin = page.getByRole("button", { name: "Keep Controls open" });
  const show = page.getByRole("button", { name: "Show the controls" });

  if (await pin.isVisible().catch(() => false)) {
    await pin.click();
  }

  if (await show.isVisible().catch(() => false)) {
    await show.click();
  }

  await expect(ultra(page)).toBeVisible();
}

/** Past the walkthrough, with Controls pinned open so the switches are on screen. */
async function arrive(page: Page, subject: string, query = "") {
  await openPlay(page, subject);

  if (query) {
    await page.goto(`/play?debug=1&hour=13&month=7&weather=clear${query}`);
    await page.waitForTimeout(2500);
  }

  await page.getByRole("button", { name: "Skip", exact: true }).click();
  await pinPanels(page);
  await controls(page);
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
    expect(on.stacked, "something planted is stacked on one spot").toBe(0);
    expect(on.shadowReach, "the shadows did not get Ultra's wider box").toBe(140);

    await detail(page).click();
    await expect(detail(page)).toHaveAttribute("data-quality", "low");
    await expect(ultra(page)).toHaveAttribute("data-ultra", "off");
  });

  test("off again leaves nothing of itself behind", async ({ page }) => {
    await arrive(page, "ultra-round-trip", "&weather=clear");
    await whole(page);

    const before = await state(page);

    for (let trip = 0; trip < 2; trip += 1) {
      await controls(page);
      await ultra(page).click();
      await expect(ultra(page)).toHaveAttribute("data-ultra", "on");
      await page.waitForTimeout(800);
      await whole(page);
      await page.waitForTimeout(1200);
      await controls(page);
      await ultra(page).click();
      await expect(ultra(page)).toHaveAttribute("data-ultra", "off");
      await page.waitForTimeout(800);
      await whole(page);
    }

    const after = await state(page);

    expect(after.lens).toBe("off");
    expect(after.lit, "the sky is still lighting a park that is back on High").toBe(false);
    expect(after.physical).toBe(0);
    // The lens switches off the renderer's own clearing of the frame. Left
    // off, High draws every frame over the last one for ever after.
    expect(after.clears, "High is no longer clearing the frame").toBe(true);
    // The pebbles and the ground cover never change their model or their
    // places, so nothing laid them out again when the switch rebuilt them.
    expect(after.stacked, "something planted is stacked on one spot").toBe(0);
    expect(after.swayingFlowers, "flowers kept Ultra's shadow material").toBe(0);
    expect(after.shadowReach, "the shadows kept Ultra's wider box").toBe(before.shadowReach);
    expect(before.shadowReach).toBe(70);
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
    await controls(page);
    // A pin is not a choice: without it the park is back on High.
    await expect(ultra(page)).toHaveAttribute("data-ultra", "off");

    await ultra(page).click();
    await expect(ultra(page)).toHaveAttribute("data-ultra", "on");
    await page.reload();
    await page.waitForTimeout(3000);
    await pinPanels(page);
    await controls(page);
    await expect(ultra(page), "the park forgot it was asked for ultra").toHaveAttribute("data-ultra", "on");
  });

  test("the water is a mirror, and leaves the small stuff out of it", async ({ page }) => {
    /**
     * The creek reflects the park by drawing it a second time from under the
     * surface. That is a whole second drawing, so the grass and the flowers
     * are moved to a layer the camera down there does not look at. If the
     * main camera did not look at that layer either, Ultra would have no grass.
     */
    const read = () =>
      page.evaluate(() => {
        type Node = {
          isReflector?: boolean;
          isInstancedMesh?: boolean;
          count?: number;
          layers: { mask: number };
          customDepthMaterial?: unknown;
          castShadow?: boolean;
          userData: { water?: boolean; planted?: boolean; shadowOnly?: boolean };
          children: Node[];
        };
        const host = window as unknown as {
          __scoutScene: Node;
          __scoutCamera: { layers: { mask: number }; view: { enabled: boolean } | null };
        };
        let mirror = false;
        let grassLayer = 0;
        let grass = 0;
        let swayingShadows = 0;
        const walk = (node: Node) => {
          if (node.userData?.water) mirror = Boolean(node.isReflector);

          // The lawn is the biggest planted mesh there is.
          if (node.isInstancedMesh && node.userData?.planted && !node.userData.shadowOnly && (node.count ?? 0) > grass) {
            grass = node.count ?? 0;
            grassLayer = node.layers.mask;
          }

          if (node.userData?.shadowOnly && node.customDepthMaterial) swayingShadows += 1;

          node.children.forEach(walk);
        };

        walk(host.__scoutScene);

        // Each flower's bevel must be cut along the blocks of the model it is
        // drawing now, not the coarse one it was drawing while this one built.
        type Plant = {
          userData: { plant?: string };
          children: (Plant & {
            isMesh?: boolean;
            material?: object;
            geometry?: { userData: { lattice?: { size: number[] } } };
          })[];
        };
        const gl = (
          window as unknown as {
            __scoutGl: { properties: { get(key: object): { uniforms?: { uBlockSize?: { value: { x: number } } } } } };
          }
        ).__scoutGl;
        const ultra = (
          window as unknown as { __scoutUltra?: { occlusion: { configuration: { transparencyAware: boolean } } } }
        ).__scoutUltra;
        let flowers = 0;
        let wrongBlocks = 0;
        const blocks = (node: Plant) => {
          if (node.userData?.plant) {
            const mesh = node.children.find((child) => child.isMesh);
            const block = mesh?.material ? gl.properties.get(mesh.material).uniforms?.uBlockSize?.value.x : undefined;
            const size = mesh?.geometry?.userData.lattice?.size[0];

            if (block !== undefined && size !== undefined) {
              flowers += 1;
              if (Math.abs(block - size) > 1e-6) wrongBlocks += 1;
            }
          }

          node.children.forEach(blocks);
        };

        blocks(host.__scoutScene as unknown as Plant);

        return {
          camera: host.__scoutCamera.layers.mask,
          flowers,
          grassLayer,
          jittered: Boolean(host.__scoutCamera.view?.enabled),
          mirror,
          redrawing: ultra?.occlusion.configuration.transparencyAware ?? false,
          swayingShadows,
          wrongBlocks,
        };
      });

    await enterGame(page);
    await page.goto("/play?debug=1&hour=13&month=7&weather=clear&quality=ultra");
    await page.waitForSelector("canvas");
    await whole(page);
    await page.waitForTimeout(1500);

    const on = await read();

    expect(on.mirror, "the creek is not reflecting the park").toBe(true);
    expect(on.grassLayer, "the grass is still in the reflection").toBe(2);
    expect(on.camera & 2, "the camera cannot see the grass").toBe(2);
    expect(on.swayingShadows, "no tree's shadow sways with it").toBeGreaterThan(0);
    // The steadying pass draws each frame a fraction of a pixel off from the last.
    expect(on.jittered, "frames are not being offset for the steadying pass").toBe(true);
    expect(on.flowers, "no flower's material could be read").toBeGreaterThan(10);
    expect(on.wrongBlocks, "flowers are bevelled along the wrong model's blocks").toBe(0);
    // Left to itself the shading pass sees the water and the wings and draws
    // the whole scene twice more a frame to work round them.
    expect(on.redrawing, "the shading pass is redrawing the scene").toBe(false);

    await page.goto("/play?debug=1&hour=13&month=7&weather=clear&quality=high");
    await page.waitForSelector("canvas");
    await whole(page);
    await page.waitForTimeout(1500);

    const off = await read();

    expect(off.mirror, "High is paying for a reflection").toBe(false);
    expect(off.grassLayer).toBe(1);
    expect(off.swayingShadows).toBe(0);
    expect(off.jittered, "High's frames are being offset").toBe(false);
  });

  test("what glows at night lights what is round it", async ({ page }) => {
    const lamps = () =>
      page.evaluate(() => {
        type Node = { isPointLight?: boolean; intensity?: number; userData: { nightLamp?: string }; children: Node[] };
        const found: { kind: string; intensity: number }[] = [];
        const walk = (node: Node) => {
          if (node.isPointLight && node.userData?.nightLamp) {
            found.push({ kind: node.userData.nightLamp, intensity: node.intensity ?? 0 });
          }

          node.children.forEach(walk);
        };

        walk((window as unknown as { __scoutScene: Node }).__scoutScene);

        return found;
      });

    await enterGame(page);
    await page.goto("/play?debug=1&hour=13&month=7&weather=clear&quality=ultra");
    await page.waitForSelector("canvas");
    await whole(page);
    await page.waitForTimeout(1500);

    const day = await lamps();

    // None at all by day. A lamp that is switched off costs what a lit one
    // does, in every pixel of every surface, so they are not there to switch.
    expect(day, "the night lamps are in the scene at midday").toHaveLength(0);

    await page.goto("/play?debug=1&hour=22&month=7&weather=clear&quality=ultra");
    await page.waitForSelector("canvas");
    await whole(page);
    await page.waitForTimeout(3500);

    const night = await lamps();

    // And all four together after dark, never one at a time: the number of
    // lights is compiled into every material.
    expect(night).toHaveLength(4);
    expect(
      Math.max(...night.filter((lamp) => lamp.kind === "firefly").map((lamp) => lamp.intensity)),
      "no firefly is lighting anything",
    ).toBeGreaterThan(1);
  });

  test("a photograph is a better frame than the one on screen, and the screen comes back", async ({ page }) => {
    const size = () =>
      page.evaluate(() => {
        const canvas = document.querySelector("canvas") as HTMLCanvasElement;

        return [canvas.width, canvas.height];
      });

    await arrive(page, "ultra-photo", "&quality=ultra");
    await whole(page);
    await page.waitForTimeout(1500);

    const before = await size();

    const errors: string[] = [];

    page.on("pageerror", (error) => errors.push(error.message));

    const kept = page.waitForResponse(
      (response) => response.url().includes("/api/photos") && response.request().method() === "POST",
    );

    await page.getByRole("button", { name: /Take a photo/ }).click();
    expect((await kept).ok(), "the album did not take the photograph").toBe(true);
    expect(errors, "taking the photograph threw").toEqual([]);

    // The still is drawn larger than the screen's frame, then the canvas is
    // put back exactly as it was.
    await page.waitForTimeout(600);
    expect(await size(), "the canvas was left at the photograph's size").toEqual(before);
    await expect(ultra(page)).toHaveAttribute("data-ultra", "on");
  });
});

test.describe("ultra, on a retina screen", () => {
  test.use({ deviceScaleFactor: 2 });
  test.describe.configure({ timeout: 240_000 });

  test("draws a little under full resolution, and a resize does not undo that", async ({ page }) => {
    const ratio = () =>
      page.evaluate(() => (window as unknown as { __scoutGl: { getPixelRatio(): number } }).__scoutGl.getPixelRatio());

    await arrive(page, "ultra-retina", "&weather=clear");
    await whole(page);
    expect(await ratio()).toBe(2);

    await ultra(page).click();
    await expect(ultra(page)).toHaveAttribute("data-ultra", "on");
    await page.waitForTimeout(800);
    await whole(page);
    expect(await ratio(), "ultra is drawing at full resolution").toBe(1.75);

    // The scene's own resize handling sets the ratio back to the screen's.
    await page.setViewportSize({ width: 1180, height: 760 });
    await page.waitForTimeout(1500);
    expect(await ratio(), "a resize put ultra back to full resolution").toBe(1.75);

    await controls(page);
    await ultra(page).click();
    await expect(ultra(page)).toHaveAttribute("data-ultra", "off");
    await page.waitForTimeout(800);
    expect(await ratio(), "High did not get its resolution back").toBe(2);
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

  test("lets a block say what it is made of, on the fine models only", () => {
    const made = (geometry: { getAttribute(name: string): { count: number; getX(index: number): number } | undefined }) => {
      const attribute = geometry.getAttribute("made");
      const seen = new Set<number>();

      for (let index = 0; index < (attribute?.count ?? 0); index += 1) {
        seen.add(attribute!.getX(index));
      }

      return seen;
    };

    // A tree is bark under leaves in one mesh.
    expect(made(buildFoliageKind("oak", "high", 0)).has(MADE.wood), "an oak's trunk is not wood").toBe(true);
    // A glasshouse is glass, in metal frames.
    const phipps = made(buildLandmark("phipps", "high"));

    expect(phipps.has(MADE.glass), "the glasshouse has no glass").toBe(true);
    expect(phipps.has(MADE.metal), "the glasshouse has no frames").toBe(true);
    // Low has nothing to say and does not pay to say it.
    expect(made(buildFoliageKind("oak", "low", 0)).size).toBe(0);
    // And a rock is one thing.
    expect(made(buildFoliageKind("rock", "high", 0)).size).toBe(0);
  });

  test("knows the weather it is drawing", () => {
    // A cloud's shadow needs a broken sky: none when clear, none under a lid.
    expect(cloudShadow(0)).toBe(0);
    expect(cloudShadow(1)).toBe(0);
    expect(cloudShadow(0.5)).toBeGreaterThan(0.2);
    // Mist at first light, gone by midday, back in fog.
    expect(mistiness(6, 0, 0)).toBeGreaterThan(0.4);
    expect(mistiness(13, 0, 0)).toBe(0);
    expect(mistiness(13, 1, 0)).toBeGreaterThan(0.8);
    // Leaves come down in October and not in February.
    expect(leafFall(10.6)).toBe(1);
    expect(leafFall(2)).toBe(0);
    expect(leafFall(7)).toBeGreaterThan(0);
    expect(leafFall(7)).toBeLessThan(0.3);
  });

  test("thickens the grass round the bee, the same way every time", () => {
    const here = scatterGrassNear(-170, 215, 30, 1.9);

    expect(here.length, "no grass was added near the spawn").toBeGreaterThan(60);
    // Fixed to the world: the bee comes back to the grass it left.
    expect(scatterGrassNear(-170, 215, 30, 1.9)).toEqual(here);

    for (const blade of here) {
      expect(Math.hypot(blade.position[0] + 170, blade.position[2] - 215)).toBeLessThanOrEqual(30 + 1.9);
    }

    // And not standing on the lawn that was already there.
    const lawn = new Set(scatterGrass(5.4).map((blade) => `${blade.position[0].toFixed(2)}:${blade.position[2].toFixed(2)}`));

    expect(here.filter((blade) => lawn.has(`${blade.position[0].toFixed(2)}:${blade.position[2].toFixed(2)}`))).toHaveLength(0);
  });
});
