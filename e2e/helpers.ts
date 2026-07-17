import { readFileSync } from "node:fs";

import type { BrowserContext, Page } from "@playwright/test";
import { encode } from "next-auth/jwt";

import { isActive } from "../src/features/game/world/daylight";
import { scatterSpecies } from "../src/features/game/world/species-scatter";
import { startPosition } from "../src/features/game/world/terrain";

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
/**
 * The hour the suite flies at.
 *
 * Midday, pinned with `?hour=`. The park runs on Pittsburgh time and half of it
 * is shut after dark, so a suite that used the real clock would pass in the
 * afternoon and fail at midnight. Noon is inside every plant's window, including
 * the spring ephemerals that close by two.
 */
export const TEST_HOUR = 12;

/**
 * The secret the running dev server is using.
 *
 * `.env.local` is loaded by Next, not by Playwright, so the test process has to
 * read it itself. The fallback matches the placeholder Auth.js uses in local
 * mode, where there is no gate to get past anyway.
 */
function authSecret() {
  try {
    const file = readFileSync(".env.local", "utf8");
    const match = /^AUTH_SECRET=(.*)$/m.exec(file);

    if (match) {
      return match[1].trim().replace(/^["']|["']$/g, "");
    }
  } catch {
    // No .env.local. Local mode, then.
  }

  return "scout-local-mode-no-signin-possible";
}

/**
 * Sign the test in.
 *
 * The saved game is behind a sign-in now, so a suite that does not authenticate
 * tests the sign-in wall and nothing else. Rather than punching a hole in the
 * app for tests to crawl through (a dev-only bypass is a dev-only bypass right
 * up until it ships), the test mints the same JWT session cookie Auth.js would
 * have issued after a real Google round-trip. The app cannot tell the difference,
 * which is the point: this exercises the actual signed-in path.
 */
export async function signIn(context: BrowserContext, subject = "e2e-player") {
  const token = await encode({
    token: { sub: subject, name: "E2E Player", email: "e2e@example.com" },
    secret: authSecret(),
    salt: "authjs.session-token",
    maxAge: 60 * 60,
  });

  await context.addCookies([
    {
      name: "authjs.session-token",
      value: token,
      domain: "localhost",
      path: "/",
      httpOnly: true,
      sameSite: "Lax",
    },
  ]);
}

/**
 * Wipe the signed-in player's save, on the SERVER as well as in the browser.
 *
 * Clearing localStorage is not enough and never was. The account is signed in, so
 * cloud sync pulls the server's copy back down and unions it with whatever is
 * local: a suite that has been flying all afternoon leaves areas and plants
 * behind in Postgres, and the next run starts in a park it has already explored.
 * That is how "you begin in one area" started seeing two.
 */
export async function resetProgress(page: Page) {
  await page.request.post("/api/progress", {
    data: {
      // NOT an empty object. The pollinator is merged, and an empty one used to
      // strip the bee of its colours and crash the renderer.
      pollinator: {
        name: "Scout",
        type: "bee",
        bodyColor: "#f2bb42",
        wingColor: "#dcefff",
        wingStyle: "round",
        accessory: "none",
        accentColor: "#c0413b",
      },
      discoveredPlants: {},
      discoveredFungi: {},
      quizPassed: {},
      seenPhases: {},
      pollinatedPlants: {},
      unlockedMapAreas: {},
      unlockedParks: {},
      unlockedBadges: {},
      unlockedJournalEntries: {},
      stats: {
        pollinationAttempts: 0,
        pollinationSuccesses: 0,
        streak: 0,
        bestStreak: 0,
        quizzesTaken: 0,
        quizzesPassed: 0,
        questionsCorrect: 0,
      },
      tutorialSeen: false,
      savedAt: Date.now(),
    },
  });
}

/**
 * Get the first-flight tutorial out of the way.
 *
 * `if (await count()) await click()` is a race, and a lost race is expensive:
 * this config sets no actionTimeout, so Playwright's default is NO timeout and
 * the click sits there until the whole test dies at 120s. It has already done
 * that once, on WebKit, blaming a test about the letter R.
 *
 * Bounded, and forgiving: if the tutorial is not up, there is nothing to skip.
 */
export async function dismissTutorial(page: Page) {
  await page
    .getByRole("button", { name: "Skip", exact: true })
    .first()
    .click({ timeout: 8_000 })
    .catch(() => {
      // Already dismissed, or never shown. Either is fine.
    });
}

export async function enterGame(page: Page, hour: number = TEST_HOUR) {
  await signIn(page.context());
  await resetProgress(page);
  await page.addInitScript(() => window.localStorage.clear());
  await page.goto(`/play?debug=1&hour=${hour}`);
  await page.waitForTimeout(2500);

  await dismissTutorial(page);

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
  const [sx, , sz] = startPosition();

  // A PLANT specifically, and one that is actually open at the hour the suite
  // flies at. Reaching a shut flower would find a card that says "come back at
  // dawn" and no way in.
  return scatterSpecies()
    .filter(
      (instance) =>
        instance.species.kind === "plant" &&
        isActive(instance.window, TEST_HOUR),
    )
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
  /**
   * Climb OVER the park, then navigate. Do not walk through it.
   *
   * This used to drop to bloom height first and then fly across at ground level,
   * which was fine while every target was sixty units away across a lawn. The
   * park is solid now, so it flew into the first tree it met and ground against
   * it for the rest of the test: a target 250 units away came out 250 units away,
   * and the helper reported "the flower is not there" for a flower that was
   * simply behind a pavilion.
   *
   * A player would fly over the wood. So does this. Trees top out near 135 and
   * the ceiling is 260.
   */
  await hold(page, "KeyE", 7000);

  for (let step = 0; step < 40; step += 1) {
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

    // Stay above the canopy on the way. Losing height mid-crossing is how you
    // end up inside an oak.
    if (Number.parseFloat(state.Altitude ?? "0") < 150) {
      await hold(page, "KeyE", 900);
    }

    // Fly at most part of the way, so we don't overshoot and orbit forever.
    const travel = Math.min(distance * 0.7, 90);
    await hold(page, "ArrowUp", Math.max(200, (travel / 26) * 1000));
  }

  return false;
}

/** Fly to the plant nearest spawn and confirm it is in interaction range. */
/**
 * The nearest DEMANDING plant: one of the handful that will not let you pollinate
 * them until you have passed their quiz.
 */
export function demandingPlantToSpawn() {
  const [sx, , sz] = startPosition();

  return scatterSpecies()
    .filter(
      (instance) =>
        instance.species.kind === "plant" &&
        Boolean(instance.species.plant.demanding) &&
        isActive(instance.window, TEST_HOUR),
    )
    .map((instance) => ({
      instance,
      distance: Math.hypot(
        instance.position[0] - sx,
        instance.position[2] - sz,
      ),
    }))
    .sort((a, b) => a.distance - b.distance)[0].instance;
}

/** Fly to a specific plant and get close enough that its tag appears. */
export async function flyToPlant(
  page: Page,
  plant: { position: [number, number, number] },
) {
  await flyTo(page, { x: plant.position[0], z: plant.position[2] });

  /**
   * Now go DOWN to it.
   *
   * `flyTo` navigates in X and Z only, which was fine while every target was a
   * meadow flower on level ground. A cardinal flower stands in the creek at the
   * bottom of the ravine, eighty units below the rim: the bee arrives directly
   * overhead, well outside the discovery radius, and the old loop then pressed
   * KeyE and climbed AWAY from it. It reported "the flower is not there" for a
   * flower it was hovering above.
   */
  const tag = page.getByRole("button", { name: /^Land/ });

  // Enough budget to come all the way down from cruising height. `flyTo` now
  // crosses the park above the canopy, so the descent is 150 units rather than
  // the 40 it used to be, and altitude is 17 units a second.
  for (let i = 0; i < 22 && !(await tag.count()); i += 1) {
    const state = await readout(page);
    const altitude = Number.parseFloat(state.Altitude ?? "0");
    const target = plant.position[1];

    await hold(page, altitude > target + 2 ? "KeyQ" : "KeyE", 700);
    await page.waitForTimeout(200);
  }

  return (await tag.count()) > 0;
}

export async function findPlant(page: Page) {
  return flyToPlant(page, nearestPlantToSpawn());
}

/**
 * Play whatever minigame came up, badly but earnestly.
 *
 * Game-agnostic on purpose. It reads `data-minigame` for the kind and drives the
 * inputs that kind actually uses, rather than mashing every key in the hope that
 * one of them lands. The old version found the ring with `[class*="ring"]`, which
 * is a CSS-module hash match: it also caught `.ringCore`, and would have caught
 * any future class with "ring" in the middle of it.
 *
 * Every lookup here is explicitly bounded. This config sets no `actionTimeout`,
 * so Playwright's default is NO timeout: a `getAttribute` on an element that has
 * gone away (because the game resolved while we were playing it) waits forever,
 * and the test dies at its own 240s limit with nothing useful to say.
 */
export async function playMinigame(page: Page, seconds = 4) {
  const kind = await page
    .locator("[data-minigame]")
    .getAttribute("data-minigame", { timeout: 5_000 })
    .catch(() => null);

  const until = Date.now() + seconds * 1000;

  while (Date.now() < until) {
    // The game may resolve mid-loop, which takes the stage with it.
    if ((await page.locator("[data-minigame]").count()) === 0) {
      break;
    }

    if (kind === "hover") {
      const ring = await page
        .locator('[data-target="hover"]')
        .boundingBox({ timeout: 1_000 })
        .catch(() => null);

      if (ring) {
        await page.mouse.move(ring.x + ring.width / 2, ring.y + ring.height / 2);
      }
    }

    if (kind === "taps") {
      await page.keyboard.press("Space");
    }

    if (kind === "cue") {
      // Whatever it is asking for, one of these is it.
      for (const arrow of ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"]) {
        await page.keyboard.press(arrow);
      }
    }

    await page.waitForTimeout(80);
  }

  return kind;
}
