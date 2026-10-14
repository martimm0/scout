import { expect, test, type Page } from "@playwright/test";

import { dismissTutorial, signIn } from "./helpers";

/**
 * The ten-minute run, and the save it must never touch.
 *
 * The page promises "ten minutes, no account, nothing saved". It plays on the
 * same store as the real game, because the park reads that store everywhere, and
 * it used to give itself a clean slate by spreading the initial progress over the
 * state. `persist` wrote that straight to localStorage: pressing Begin erased a
 * returning player's real save. Every plant, quiz, badge, seedling and park
 * unlock. In local mode that save is the only copy there is.
 *
 * For a signed-in player it was worse in a different way. The park mounts cloud
 * sync, which pulled the server copy and unioned it into the run, so the "fresh"
 * run played on their full save, and then pushed the run back over it; if that
 * pull failed, what got pushed was the wiped slate.
 *
 * Asserted through what survives on disk and on the wire, which is the thing a
 * player loses or keeps.
 */

const KEY = "scout-game-state";

/** A returning player's real save, already on disk before the page loads. */
const REAL_SAVE = {
  version: 0,
  state: {
    discoveredPlants: {
      "common-milkweed": true,
      "wild-bergamot": true,
      "canada-goldenrod": true,
    },
    quizPassed: { "common-milkweed": true },
    unlockedParks: { frick: true, schenley: true },
    stats: {
      pollinationAttempts: 40,
      pollinationSuccesses: 31,
      streak: 0,
      bestStreak: 9,
      quizzesTaken: 3,
      quizzesPassed: 2,
      questionsCorrect: 8,
    },
  },
};

/**
 * Seeded once. An init script runs on every document, so a plain setItem would
 * quietly put the save back after anything erased it and the test would pass
 * against the bug. Only writing when nothing is there keeps the disk honest.
 */
async function seedRealSave(page: Page) {
  await page.addInitScript(
    ([key, save]) => {
      if (!window.localStorage.getItem(key)) {
        window.localStorage.setItem(key, JSON.stringify(save));
      }
    },
    [KEY, REAL_SAVE] as const,
  );
}

async function onDisk(page: Page) {
  return page.evaluate((key) => {
    const raw = window.localStorage.getItem(key);
    const state = raw ? JSON.parse(raw).state : {};
    const count = (record: Record<string, boolean> | undefined) =>
      Object.values(record ?? {}).filter(Boolean).length;

    return {
      plants: count(state.discoveredPlants),
      parks: Object.keys(state.unlockedParks ?? {}).sort(),
      bestStreak: state.stats?.bestStreak ?? null,
      species: state.pollinator?.type ?? null,
    };
  }, KEY);
}

async function begin(page: Page) {
  await page.goto("/offline");
  await page.getByRole("button", { name: "Begin" }).click();
  // Long enough for the park to mount and for anything that writes on mount to
  // have written.
  await page.waitForTimeout(3500);
  // The first-flight tutorial opens on Begin, and its scrim covers the site
  // header's dropdown. A player dismisses it before going anywhere; so does this.
  await dismissTutorial(page);
}

test.describe("the ten-minute run leaves the real save alone", () => {
  test("pressing Begin does not erase a returning player's progress", async ({
    page,
  }) => {
    await seedRealSave(page);
    await begin(page);

    const disk = await onDisk(page);

    expect(disk.plants, "Begin erased the plants this player had found").toBe(3);
    expect(disk.parks, "Begin took Schenley back").toEqual(["frick", "schenley"]);
    expect(disk.bestStreak, "Begin reset a best streak of nine").toBe(9);

    // And the page says what is true for these ten minutes.
    await expect(
      page.getByText("Not saved. This is the ten-minute run."),
    ).toBeVisible();
  });

  test("leaving mid-run puts the real save back before anything is written", async ({
    page,
  }) => {
    /**
     * The order on the way out is the original bug in reverse. The run lives in
     * memory with writes refused; if writes were allowed again BEFORE the real
     * save was read back, the very next write would store the run over it.
     *
     * So: leave client side, which is a real thing a player can do, since the
     * site header sits above the park. Then make an ordinary change on another
     * page, which writes the whole save. What lands on disk must be the real
     * save with that change, not the run.
     */
    await seedRealSave(page);
    await begin(page);

    await page.getByRole("button", { name: "More" }).click();
    await page.getByRole("link", { name: "Customize" }).click();
    await expect(page).toHaveURL(/\/customize/);
    await page.waitForTimeout(800);

    await page.getByRole("button", { name: /Butterfly/ }).first().click();
    await page.waitForTimeout(600);

    const disk = await onDisk(page);

    expect(disk.species, "the change on the next page did not write").toBe("butterfly");
    expect(disk.plants, "the run was written over the real save on the way out").toBe(3);
    expect(disk.bestStreak).toBe(9);
  });
});

test.describe("signed in, the run never reaches the server copy", () => {
  test("no save traffic at all for the whole session", async ({ page }) => {
    await signIn(page.context());
    await seedRealSave(page);

    const traffic: string[] = [];
    page.on("request", (request) => {
      if (request.url().includes("/api/progress")) {
        traffic.push(`${request.method()} ${new URL(request.url()).pathname}`);
      }
    });

    await begin(page);
    // Past the autosave debounce more than twice over, so a push that was going
    // to happen has had every chance to.
    await page.waitForTimeout(5000);

    expect(traffic, "the run pulled or pushed the real save").toEqual([]);
    await expect(
      page.getByText("Not saved. This is the ten-minute run."),
    ).toBeVisible();
  });
});
