import type { Page } from "@playwright/test";

import { scatterPlants } from "../src/features/game/world/plant-scatter";
import { START_POSITION } from "../src/features/game/world/terrain";

/**
 * Shared driving for the game tests.
 *
 * State is read by walking the debug overlay's dt/dd pairs, not by regex over
 * innerText — a regex over the whole page is exactly how an earlier version of
 * these scripts reported "no readout" for a bug that lived entirely in the test.
 */

export async function hold(page: Page, key: string, ms: number) {
  await page.keyboard.down(key);
  await page.waitForTimeout(ms);
  await page.keyboard.up(key);
  await page.waitForTimeout(120);
}

export type Readout = Record<string, string>;

export function readout(page: Page): Promise<Readout> {
  return page.evaluate(() => {
    const out: Record<string, string> = {};

    for (const row of document.querySelectorAll("aside dl > div")) {
      const key = row.querySelector("dt")?.textContent?.trim();
      const value = row.querySelector("dd")?.textContent?.trim();

      if (key && value) {
        out[key] = value;
      }
    }

    return out;
  });
}

function position(state: Readout) {
  const match = /x\s*(-?[\d.]+),\s*z\s*(-?[\d.]+)/.exec(state.Position ?? "");

  if (!match) {
    throw new Error(`no position in readout: ${JSON.stringify(state)}`);
  }

  return { x: Number(match[1]), z: Number(match[2]) };
}

/** Heading in radians, normalised to (-π, π]. */
function heading(state: Readout) {
  const degrees = Number.parseFloat(state.Heading ?? "0");
  let radians = (degrees * Math.PI) / 180;

  while (radians > Math.PI) radians -= Math.PI * 2;
  while (radians <= -Math.PI) radians += Math.PI * 2;

  return radians;
}

/** Load /play with a clean slate and get past the first-flight tutorial. */
export async function enterGame(page: Page) {
  await page.addInitScript(() => window.localStorage.clear());
  await page.goto("/play?debug=1");
  await page.waitForTimeout(2500);

  const skip = page.getByRole("button", { name: "Skip", exact: true });

  if (await skip.count()) {
    await skip.first().click();
  }

  await page.waitForTimeout(1200);
}

/**
 * The plant nearest the spawn point.
 *
 * The scatter is deterministic, so the test can simply *ask* where a plant is
 * rather than flying a random spiral and hoping. An earlier version did the
 * hoping, and failed about a third of the time for reasons that had nothing to
 * do with the game.
 */
export function nearestPlantToSpawn() {
  const [sx, , sz] = START_POSITION;

  return scatterPlants()
    .map((instance) => ({
      instance,
      distance: Math.hypot(
        instance.position[0] - sx,
        instance.position[2] - sz,
      ),
    }))
    .sort((a, b) => a.distance - b.distance)[0].instance;
}

/**
 * Fly to a point. Closed loop: look at where we are, turn toward the target,
 * fly a bit, repeat. The turn rate is 2 rad/s, so a turn of Δ radians is Δ/2
 * seconds of holding an arrow.
 */
export async function flyTo(page: Page, target: { x: number; z: number }) {
  // Drop to bloom height first; the flowers are on the ground, not in the sky.
  await hold(page, "KeyQ", 6000);

  for (let step = 0; step < 22; step += 1) {
    const state = await readout(page);
    const here = position(state);

    const dx = target.x - here.x;
    const dz = target.z - here.z;
    const distance = Math.hypot(dx, dz);

    if (distance < 12) {
      return true;
    }

    // Forward is (sin y, 0, -cos y), so the bearing to a point is atan2(dx, -dz).
    const bearing = Math.atan2(dx, -dz);
    let turn = bearing - heading(state);

    while (turn > Math.PI) turn -= Math.PI * 2;
    while (turn <= -Math.PI) turn += Math.PI * 2;

    if (Math.abs(turn) > 0.08) {
      const ms = Math.min(1400, (Math.abs(turn) / 2) * 1000);
      await hold(page, turn > 0 ? "ArrowRight" : "ArrowLeft", ms);
    }

    // Fly at most part of the way, so we don't overshoot and orbit forever.
    const travel = Math.min(distance * 0.7, 90);
    await hold(page, "ArrowUp", Math.max(200, (travel / 26) * 1000));
  }

  return false;
}

/** Fly to the plant nearest spawn and confirm it's in interaction range. */
export async function findPlant(page: Page) {
  const plant = nearestPlantToSpawn();

  await flyTo(page, { x: plant.position[0], z: plant.position[2] });

  // Settle: the tag appears once the bee is inside the discovery radius.
  const tag = page.getByRole("button", { name: /Read more/ });

  for (let i = 0; i < 8 && !(await tag.count()); i += 1) {
    await hold(page, "KeyE", 300);
    await page.waitForTimeout(400);
  }

  return (await tag.count()) > 0;
}
