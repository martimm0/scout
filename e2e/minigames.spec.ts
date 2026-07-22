import { expect, test } from "@playwright/test";

import { enterGame, flyToPlant, readout, TEST_MONTH } from "./helpers";
import { ANAGRAM_WORDS } from "../src/features/game/data/anagram-words";
import { PLANTS, PLANTS_BY_ID } from "../src/features/game/data/plants";
import {
  MINIGAME_SPEC,
  minigameFor,
  resolvePollination,
} from "../src/features/game/data/pollination";
import { isOut, scatterSpecies } from "../src/features/game/world/species-scatter";
import { setActivePark, startPosition } from "../src/features/game/world/terrain";

/**
 * The nearest plant that plays `kind`, is open at the test hour, and is not one
 * of the demanding flowers (those want their quiz passed before the Pollinate
 * button appears at all).
 */
/**
 * The month to fly in for a given game. A game's plant has to be in season to be
 * pollinated at all, and in Frick the shrubs and trees that play `seeds`
 * (spicebush, redbud) bloom in spring while the spikes and umbels that play
 * `memory` bloom in summer, so no single month has all three. Each kind gets a
 * month when its plant is genuinely out.
 */
function monthForKind(kind: string) {
  return kind === "seeds" ? 4 : TEST_MONTH;
}

function nearestFor(kind: string) {
  setActivePark("frick");
  const [sx, , sz] = startPosition();
  const distance = (i: { position: number[] }) =>
    Math.hypot(i.position[0] - sx, i.position[2] - sz);

  const found = scatterSpecies()
    .filter((instance) => {
      if (instance.species.kind !== "plant") return false;
      const plant = PLANTS_BY_ID.get(instance.id);
      return (
        plant &&
        !plant.demanding &&
        isOut(instance, 12, monthForKind(kind)) &&
        minigameFor(plant) === kind
      );
    })
    .sort((a, b) => distance(a) - distance(b))[0];

  if (!found) {
    throw new Error(`no open, non-demanding plant plays ${kind}`);
  }

  return found;
}

async function land(page: import("@playwright/test").Page, kind: string) {
  await enterGame(page, 12, monthForKind(kind));
  await flyToPlant(page, nearestFor(kind));
  await page.keyboard.press("Space");
  await page.getByRole("button", { name: /Pollinate/ }).click();
  await page.locator(`[data-minigame="${kind}"]`).waitFor();
}

async function outcomeScore(page: import("@playwright/test").Page) {
  await page
    .getByRole("dialog")
    .getByText(/Pollinated|Not this time/)
    .waitFor({ timeout: 20_000 });

  return Number.parseFloat((await readout(page)).Score);
}

test.describe("the pollination resolver", () => {
  test("skill moves the failure rate, and the ends are reachable", () => {
    // Pure, no browser. This is the cheapest test, and the one that would have
    // caught the games all scoring a flat 1.0: it pins the curve the games have
    // to feed. `roll` is the random draw the real code makes; here we sweep it.
    const failureAt = (performance: number) => {
      let failures = 0;
      const N = 2000;
      for (let i = 0; i < N; i += 1) {
        if (!resolvePollination(performance, i / N)) failures += 1;
      }
      return failures / N;
    };

    // Average play lands on the documented one in five.
    expect(failureAt(0.5)).toBeCloseTo(0.2, 1);
    // Good play is meaningfully better than bad play. This is the whole point of
    // a minigame that has a skill spread.
    expect(failureAt(1)).toBeLessThan(failureAt(0));
    expect(failureAt(0)).toBeGreaterThan(failureAt(1) + 0.1);
  });

  test("every plant resolves to a game that exists", () => {
    for (const plant of PLANTS) {
      const kind = minigameFor(plant);
      expect(MINIGAME_SPEC[kind], `${plant.id} plays ${kind}`).toBeTruthy();

      // A plant routed to the anagram must have a word list, or it is unwinnable.
      if (kind === "anagram") {
        expect(
          (ANAGRAM_WORDS[plant.id] ?? []).length,
          `${plant.id} plays anagram but has no words`,
        ).toBeGreaterThanOrEqual(3);
      }
    }
  });
});

test.describe("the minigames have a skill spread", () => {
  // Doing nothing scores about zero, in every game. Nobody is carried.
  for (const kind of ["memory", "seeds", "anagram"]) {
    test(`${kind}: doing nothing scores near zero`, async ({ page }) => {
      test.setTimeout(180_000);

      await land(page, kind);
      await page.waitForTimeout(MINIGAME_SPEC[kind as "memory"].duration * 1000 + 1500);

      expect(await outcomeScore(page)).toBeLessThan(0.2);
    });
  }

  test("anagram: solving it scores 1.0, and any real word counts", async ({
    page,
  }) => {
    test.setTimeout(180_000);

    const plant = nearestFor("anagram");
    const words = ANAGRAM_WORDS[plant.id]!.slice(0, 3);

    await land(page, "anagram");
    const input = page.getByRole("textbox");

    for (const word of words) {
      await input.fill(word);
      await input.press("Enter");
      await page.waitForTimeout(250);
    }

    // The ceiling is reachable: three words is a full score, which is what keeps
    // the anagram fair against the games whose ceiling is harder to touch.
    expect(await outcomeScore(page)).toBe(1);
  });

  test("Escape asks before it forfeits the flower", async ({ page }) => {
    test.setTimeout(180_000);

    await land(page, "memory");

    // Escape does not leave. It asks, because leaving forfeits.
    await page.keyboard.press("Escape");
    await expect(page.getByText("Give up on this flower?")).toBeVisible();

    // Keep going, and you are back in the game with the board still there.
    await page.getByRole("button", { name: "Keep going" }).click();
    await expect(page.locator('[data-minigame="memory"]')).toBeVisible();

    // Escape again, give up, and it resolves rather than vanishing. Doing nothing
    // first means the forfeit score is low, so it is almost always a failure, and
    // that still counts as the attempt it now is.
    await page.keyboard.press("Escape");
    await page.getByRole("button", { name: "Give up" }).click();
    await expect(
      page.getByRole("dialog").getByText(/Pollinated|Not this time/),
    ).toBeVisible();
  });

  test("anagram: a made-up word is refused", async ({ page }) => {
    test.setTimeout(180_000);

    await land(page, "anagram");
    const input = page.getByRole("textbox");

    await input.fill("ZZZZ");
    await input.press("Enter");

    await expect(page.getByText(/not a word you can make/)).toBeVisible();
    // And it did not count.
    await expect(page.getByText("0 of 3 words")).toBeVisible();
  });
});
