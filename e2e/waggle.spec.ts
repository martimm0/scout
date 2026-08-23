import { expect, test } from "@playwright/test";

import {
  addMark,
  bearingFrom,
  markExpired,
  marksIn,
  MARK_DAYS,
  MAX_MARKS,
  type Mark,
} from "../src/features/game/world/marks";
import {
  dismissTutorial,
  enterGame,
  flyToPlant,
  nearestPlantToSpawn,
  resetProgress,
  signIn,
  TEST_HOUR,
  TEST_MONTH,
} from "./helpers";
import { setActivePark } from "../src/features/game/world/terrain";

const DAY = 24 * 60 * 60 * 1000;

/**
 * Put the world module back after every test.
 *
 * `setActivePark` is module state in the TEST process, not just in the browser,
 * and helpers like `nearestPlantToSpawn` read it. A test that moves it and does
 * not move it back hands the wrong park to every test that runs after it in the
 * same worker, which then flies to coordinates from one park inside another,
 * lands on nothing, and fails for a reason that looks like anything but this.
 *
 * `season.spec.ts` has done this from the start; three other files did not.
 */
test.afterEach(() => setActivePark("frick"));

const mark = (over: Partial<Mark> = {}): Mark => ({
  species: "canada-goldenrod",
  commonName: "Canada Goldenrod",
  park: "frick",
  x: 100,
  z: 100,
  at: Date.now(),
  ...over,
});

/**
 * The waggle dance, made to mean something.
 *
 * The animation already existed and did nothing. What is worth testing is the
 * record it leaves: that it expires, that it caps, and that pressing the key
 * four times beside one flower does not fill the whole thing with one patch.
 */

test.describe("what a dance leaves behind", () => {
  test("a mark expires, because the forage does", () => {
    const now = Date.now();

    expect(markExpired(mark({ at: now }), now)).toBe(false);
    expect(markExpired(mark({ at: now - MARK_DAYS * DAY + 1000 }), now)).toBe(
      false,
    );
    expect(markExpired(mark({ at: now - MARK_DAYS * DAY - 1000 }), now)).toBe(
      true,
    );
  });

  test("dancing about the same patch twice does not record it twice", () => {
    /**
     * The thing that would have quietly ruined it. Leaning on the key beside
     * one flower fills the record with pins on top of each other, and the cap
     * then throws away the marks you actually wanted.
     */
    const now = Date.now();
    let marks: Mark[] = [];

    for (let i = 0; i < 5; i += 1) {
      marks = addMark(marks, mark({ x: 100, z: 100 + i }), now);
    }

    expect(marks).toHaveLength(1);

    // A genuinely different patch is a genuinely different mark.
    marks = addMark(marks, mark({ x: 400, z: -300 }), now);

    expect(marks).toHaveLength(2);
  });

  test("the newest are kept and the record never grows without limit", () => {
    const now = Date.now();
    let marks: Mark[] = [];

    // Well spaced, so nothing is merged as the same patch.
    for (let i = 0; i < MAX_MARKS + 8; i += 1) {
      marks = addMark(marks, mark({ x: i * 200, z: i * 200, at: now + i }), now);
    }

    expect(marks).toHaveLength(MAX_MARKS);

    // Newest first, so the one just danced is at the top.
    expect(marks[0].x).toBe((MAX_MARKS + 7) * 200);
  });

  test("an expired mark is dropped when a new one arrives", () => {
    const now = Date.now();
    const stale = mark({ x: 900, z: 900, at: now - MARK_DAYS * DAY - 5000 });

    const marks = addMark([stale], mark({ x: 100, z: 100 }), now);

    expect(marks).toHaveLength(1);
    expect(marks[0].x).toBe(100);
  });

  test("marks are read back per park, and only the live ones", () => {
    const now = Date.now();
    const all = [
      mark({ x: 10, z: 10, park: "frick" }),
      mark({ x: 20, z: 20, park: "schenley" }),
      mark({ x: 30, z: 30, park: "frick", at: now - MARK_DAYS * DAY - 1 }),
    ];

    expect(marksIn(all, "frick", now)).toHaveLength(1);
    expect(marksIn(all, "schenley", now)).toHaveLength(1);
    expect(marksIn(all, "highland", now)).toHaveLength(0);
  });

  test("a bearing points where it says it points", () => {
    // North is negative Z, which is the convention the rest of the world uses.
    // Getting this backwards sends everybody the wrong way with total
    // confidence, and nothing would ever throw.
    expect(bearingFrom(mark({ x: 0, z: -100 }), 0, 0).compass).toBe("north");
    expect(bearingFrom(mark({ x: 0, z: 100 }), 0, 0).compass).toBe("south");
    expect(bearingFrom(mark({ x: 100, z: 0 }), 0, 0).compass).toBe("east");
    expect(bearingFrom(mark({ x: -100, z: 0 }), 0, 0).compass).toBe("west");
    expect(bearingFrom(mark({ x: 100, z: -100 }), 0, 0).compass).toBe(
      "north-east",
    );

    expect(bearingFrom(mark({ x: 30, z: 40 }), 0, 0).distance).toBeCloseTo(50);
  });
});

test.describe("dancing in the park", () => {
  test("G beside a flower records it; G over open grass does not", async ({
    page,
  }) => {
    test.setTimeout(180_000);

    /**
     * Both halves. A test that only checked "dancing records something" would
     * pass against a key that recorded a mark wherever you were standing, which
     * would fill the journal with pins over empty meadow.
     */
    await enterGame(page);

    const saved = () =>
      page.evaluate(() => {
        const raw = window.localStorage.getItem("scout-game-state");

        return (JSON.parse(raw ?? "{}").state?.marks ?? []) as unknown[];
      });

    // Nowhere near anything: the tutorial start point is open air.
    await page.keyboard.press("KeyG");
    await page.waitForTimeout(600);

    expect(await saved(), "danced about nothing and it was recorded").toHaveLength(
      0,
    );

    await flyToPlant(page, nearestPlantToSpawn());
    await page.keyboard.press("KeyG");
    await page.waitForTimeout(800);

    const marks = (await saved()) as { species: string; commonName: string }[];

    expect(marks, "danced beside a flower and nothing was recorded").toHaveLength(
      1,
    );
    expect(marks[0].species).toBe(nearestPlantToSpawn().id);
    expect(marks[0].commonName.length).toBeGreaterThan(2);

    // And the journal has learned what a waggle dance is.
    const unlocked = await page.evaluate(
      () =>
        JSON.parse(window.localStorage.getItem("scout-game-state") ?? "{}").state
          ?.unlockedJournalEntries ?? {},
    );

    expect(unlocked["concept:waggle-dance"]).toBe(true);
  });

  test("a mark dropped away from your saved park is still drawn there", async ({
    page,
  }) => {
    test.setTimeout(180_000);

    /**
     * The renderer half of the park question, and it was wrong.
     *
     * Marks are recorded against the park you are FLYING. The column of light
     * filtered them by `state.currentPark`, which is only written by entering a
     * park deliberately, so the two disagree in exactly the case the feature is
     * for: a garden party. A dance shared with nine other people put a light on
     * nobody's screen, including the dancer's.
     *
     * Driven through `?park=`, which produces the same disagreement without
     * needing a second player.
     */
    await signIn(page.context());
    await resetProgress(page);
    await page.addInitScript(() => window.localStorage.clear());
    await page.goto(`/play?debug=1&hour=${TEST_HOUR}&month=${TEST_MONTH}&park=schenley`);
    await page.waitForTimeout(2500);
    await dismissTutorial(page);
    await page.waitForTimeout(1200);

    setActivePark("schenley");

    const target = nearestPlantToSpawn();
    const danced = () =>
      page.evaluate(() => {
        const raw = window.localStorage.getItem("scout-game-state");

        return (JSON.parse(raw ?? "{}").state?.marks ?? []) as { park: string }[];
      });

    /**
     * Fly, dance, and check you actually got there.
     *
     * Dancing only marks a patch if you are BESIDE one, which is the whole
     * point of the key, so a bee that fell short records nothing and the test
     * reports "nothing was recorded" as though the feature were broken.
     *
     * Schenley is where that bites: Frick is a wood with a creek and this is a
     * hundred-foot ravine, so the approach is longer and the flight helper does
     * not always close it in one go. It failed in Firefox and nowhere else,
     * which is exactly the shape of a timing assumption rather than a bug.
     */
    let marks: { park: string }[] = [];

    for (let attempt = 0; attempt < 4 && marks.length === 0; attempt += 1) {
      await flyToPlant(page, target);

      /**
       * Wait until the game AGREES you are beside it, rather than assuming.
       *
       * The floating tag appears on exactly the condition the dance needs:
       * `ui.nearby` is set. Pressing the key before that records nothing and
       * the test reports "nothing was recorded" as though the feature were
       * broken. Asserting on the game's own signal instead of on a sleep is
       * the difference between a test that measures the feature and one that
       * measures the flight helper.
       */
      try {
        await page.locator("[data-kind='plant']").first().waitFor({
          timeout: 8_000,
        });
      } catch {
        continue;
      }

      await page.keyboard.press("KeyG");
      await page.waitForTimeout(900);

      marks = await danced();
    }

    expect(
      marks,
      "the bee never got beside a flower to dance at",
    ).toHaveLength(1);
    expect(
      marks[0].park,
      "the mark was filed under the saved park rather than the one being flown",
    ).toBe("schenley");
  });

  test("a mark from a park that no longer exists does not take the page down", async ({
    page,
  }) => {
    /**
     * A save is allowed to be older than the code.
     *
     * `PARKS[mark.park].label` throws on an id the game no longer has, and this
     * is a LIST: one stale row would have taken the whole journal page with it
     * rather than rendering one odd line. The seedlings already assumed a save
     * could outlive the data it names; the marks quietly had not.
     *
     * Driven by seeding a save directly, because there is no way to get a park
     * removed from the game from inside a test, and the point is what happens
     * when one has been.
     */
    await signIn(page.context());
    await page.addInitScript(() => {
      window.localStorage.setItem(
        "scout-game-state",
        JSON.stringify({
          version: 0,
          state: {
            marks: [
              {
                species: "canada-goldenrod",
                commonName: "Canada Goldenrod",
                park: "a-park-that-was-removed",
                x: 0,
                z: -300,
                at: Date.now(),
              },
            ],
          },
        }),
      );
    });

    const errors: string[] = [];

    page.on("pageerror", (error) => errors.push(error.message));

    await page.goto("/journal");
    await page.getByRole("button", { name: "Danced about" }).click();

    const list = page.locator("[data-journal-tab='marks']");

    // The page is standing, the row is there, and it says so plainly rather
    // than rendering "undefined" at somebody.
    await expect(list).toContainText("Canada Goldenrod");
    await expect(list).toContainText("no longer here");
    await expect(list).not.toContainText("undefined");

    expect(errors, `the journal threw: ${errors[0]}`).toEqual([]);
  });

  test("a save naming a park that no longer exists still opens the park", async ({
    page,
  }) => {
    test.setTimeout(180_000);

    /**
     * The same class of bug as the mark above, on the page that matters most.
     *
     * `setActivePark` has always fallen back to Frick on an id the game no
     * longer has, so the terrain built perfectly; `PARKS[currentPark].label`
     * had no such fallback, so the loading title threw and took `/play` with
     * it. The world was fine and the page was white.
     *
     * `/api/progress` stores whatever JSON it is handed, which is why this is
     * not only a hand-edited localStorage away.
     */
    await signIn(page.context());
    await page.addInitScript(() => {
      window.localStorage.setItem(
        "scout-game-state",
        JSON.stringify({
          version: 0,
          state: { currentPark: "a-park-that-was-removed", tutorialSeen: true },
        }),
      );
    });

    const errors: string[] = [];

    page.on("pageerror", (error) => errors.push(error.message));

    await page.goto("/play?debug=1&hour=12&month=7");
    await page.waitForTimeout(4000);

    expect(errors, `/play threw: ${errors[0]}`).toEqual([]);
    await expect(page.locator("canvas").first()).toBeVisible();
  });

  test("the journal lists it, with a bearing rather than coordinates", async ({
    page,
  }) => {
    /**
     * Seeded directly rather than danced, and NOT through `enterGame`.
     *
     * `enterGame` installs an init script that clears localStorage, and an init
     * script runs on every navigation, not just the first. Flying out to dance
     * and then walking to /journal wipes the save on the way, so the journal
     * would correctly show an empty list and the test would be measuring the
     * harness rather than the feature.
     */
    await signIn(page.context());
    await page.addInitScript(() => {
      window.localStorage.setItem(
        "scout-game-state",
        JSON.stringify({
          version: 0,
          state: {
            marks: [
              {
                species: "canada-goldenrod",
                commonName: "Canada Goldenrod",
                park: "frick",
                // Due north of the middle, and a long way out.
                x: 0,
                z: -420,
                at: Date.now(),
              },
            ],
          },
        }),
      );
    });

    await page.goto("/journal");
    await page.getByRole("button", { name: "Danced about" }).click();

    const list = page.locator("[data-journal-tab='marks']");

    await expect(list).toContainText("Canada Goldenrod");
    await expect(list).toContainText("north");
    await expect(list).toContainText("420");

    // Raw world coordinates are honest and useless. Nobody can fly to "z -61".
    await expect(list).not.toContainText(/x -?\d+, z -?\d+/);
  });
});
