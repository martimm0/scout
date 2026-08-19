import { expect, test, type Page } from "@playwright/test";

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
import { SOLO_PLANTS } from "../src/features/game/data/plants";
import {
  addSeedling,
  growth,
  isMature,
  MATURE_DAYS,
  MAX_SEEDLINGS,
  mergeSeedlings,
  seedlingInstances,
  seedSpot,
  SPROUT_SCALE,
  type Seedling,
} from "../src/features/game/world/seedlings";
import { PLANT_SCALE } from "../src/features/game/world/species-scatter";
import { setActivePark, startPosition } from "../src/features/game/world/terrain";

const DAY = 24 * 60 * 60 * 1000;

/**
 * Put the world module back where the rest of the suite expects it.
 *
 * `setActivePark` is module state in the TEST process, not just in the browser,
 * and `nearestPlantToSpawn` reads it. Two tests here move it to Schenley, and
 * without this the next test computed a Schenley plant's coordinates, flew to
 * them inside Frick, landed on nothing and reported "six visits and not one of
 * them took": a failure that looks exactly like bad luck with the dice and is
 * nothing of the sort. It only showed up when the whole file ran, because
 * running one test by name skipped the test that did the moving.
 *
 * `season.spec.ts` already does this for the same reason.
 */
test.afterEach(() => setActivePark("frick"));

/**
 * A flower that takes sets seed, and the park is not the same afterwards.
 *
 * The point of the feature is that your work leaves a mark, so the assertions
 * are about the WORLD changing, not about a counter going up. A test that only
 * checked the save file would pass just as well against a record nothing reads.
 */

/**
 * Land, work the flower, and keep going until one takes.
 *
 * Shared by the two tests that need a real successful pollination, because they
 * had drifted into two copies of the same loop with different bugs in each.
 *
 * Six attempts, and the number matters more than it looks. Neither test PLAYS
 * the minigame, they start one and wait, so they score about zero, and a zero
 * score is the bad end of the skill curve: about one visit in four comes to
 * nothing rather than one in eight. Six is a two-in-a-million chance of never
 * seeing one take; three is one in sixty, which is what this briefly was, cut
 * on the wrong arithmetic while chasing a slow run, and it began failing for
 * exactly that reason.
 *
 * The button is waited for on its own short budget rather than clicked blindly.
 * A bare click waits for the WHOLE test budget, so a card that came up without
 * one (the bee drifted off the flower, the scene was slow to settle) spent four
 * minutes staring at a locator and then reported a timeout, which says nothing
 * about whether the feature works.
 */
async function workUntilItTakes(page: Page): Promise<boolean> {
  for (let attempt = 0; attempt < 6; attempt += 1) {
    await page.keyboard.press("Space");

    const button = page.getByRole("button", { name: /Pollinate/ });

    try {
      await button.waitFor({ timeout: 20_000 });
    } catch {
      await page.keyboard.press("Escape");
      await page.waitForTimeout(600);
      continue;
    }

    await button.click();

    const result = page.getByRole("dialog").getByText(/Pollinated|Not this time/);

    await result.waitFor({ timeout: 40_000 });

    const took = ((await result.textContent()) ?? "").includes("Pollinated");

    await page.keyboard.press("Escape");
    await page.waitForTimeout(900);

    if (took) {
      return true;
    }
  }

  return false;
}

/** How many seeds this player has set, read out of the persisted save. */
function sownCount(page: Page): Promise<number> {
  return page.evaluate(() => {
    const raw = window.localStorage.getItem("scout-game-state");

    return Object.keys(
      (JSON.parse(raw ?? "{}").state?.seedlings ?? {}) as Record<string, unknown>,
    ).length;
  });
}

test.describe("how a seedling grows", () => {
  test("it is visible the moment it is set, and full size after the week", () => {
    /**
     * The sprout matters as much as the maturity. A seed that showed nothing
     * for eight days would be a feature whose entire payoff arrives long after
     * anybody could connect it to the thing they did.
     */
    const at = 1_000_000;

    expect(growth(at, at)).toBe(SPROUT_SCALE);
    expect(growth(at, at + MATURE_DAYS * DAY)).toBe(1);
    expect(isMature(at, at)).toBe(false);
    expect(isMature(at, at + MATURE_DAYS * DAY)).toBe(true);

    // Monotonic in between, which is the whole promise: come back tomorrow and
    // it is further along than it was.
    let previous = 0;

    for (let day = 0; day <= MATURE_DAYS; day += 0.5) {
      const now = growth(at, at + day * DAY);

      expect(now).toBeGreaterThanOrEqual(previous);
      previous = now;
    }
  });

  test("it never shrinks, however strange the clock", () => {
    /**
     * A save travels between machines, and their clocks disagree. A phone an
     * hour behind the laptop would hand this a negative age, and a negative age
     * through the growth curve comes out below the sprout: the plant you sowed
     * yesterday would be smaller than the day you sowed it, or inverted
     * entirely.
     */
    const at = 2_000_000_000_000;

    expect(growth(at, at - DAY * 30)).toBe(SPROUT_SCALE);
    expect(growth(at, 0)).toBe(SPROUT_SCALE);

    // And a clock far in the future does not grow it past its adult size.
    expect(growth(at, at + DAY * 10_000)).toBe(1);
  });

  test("the seed lands near its parent, and in the same place every time", () => {
    // Deterministic for the same reason the scatter is: a player is supposed to
    // be able to learn where things are and come back to them.
    const first = seedSpot("plant-goldenrod-3", 100, -40);
    const second = seedSpot("plant-goldenrod-3", 100, -40);

    expect(second).toEqual(first);

    const away = Math.hypot(first.x - 100, first.z - -40);

    expect(away, "the seed landed on top of its parent").toBeGreaterThan(5);
    expect(away, "the seed blew across the park").toBeLessThan(20);

    // Different flowers put their seed in different places, or a patch of
    // goldenrod would sow one shared spot.
    const other = seedSpot("plant-goldenrod-4", 100, -40);

    expect(other).not.toEqual(first);
  });
});

test.describe("seedlings in the park", () => {
  test("they are real plants of the species that set them", () => {
    setActivePark("frick");

    const plant = SOLO_PLANTS.find((p) =>
      p.homes.some((home) => home.park === "frick"),
    )!;

    const [sx, , sz] = startPosition();
    const seedlings: Record<string, Seedling> = {
      "plant-x-1": { plant: plant.id, park: "frick", x: sx, z: sz, at: Date.now() },
    };

    const [instance] = seedlingInstances(seedlings, "frick", Date.now());

    expect(instance, "no seedling came back").toBeTruthy();
    expect(instance.id).toBe(plant.id);
    expect(instance.species.kind).toBe("plant");
    expect(instance.commonName).toBe(plant.commonName);

    // Same shape as everything else in the world, so the field, the discovery
    // sweep and the landing code need no branch for it.
    expect(instance.position).toHaveLength(3);
    expect(Number.isFinite(instance.scale)).toBe(true);
  });

  test("a fresh one is small and an old one is full size", () => {
    setActivePark("frick");

    const plant = SOLO_PLANTS.find((p) =>
      p.homes.some((home) => home.park === "frick"),
    )!;
    const now = Date.now();

    const [sx, , sz] = startPosition();
    const sizeAt = (at: number) =>
      seedlingInstances(
        { k: { plant: plant.id, park: "frick", x: sx, z: sz, at } },
        "frick",
        now,
      )[0]?.scale ?? 0;

    const fresh = sizeAt(now);
    const grown = sizeAt(now - MATURE_DAYS * DAY);

    expect(fresh).toBeGreaterThan(0);
    expect(grown).toBeGreaterThan(fresh * 2);
    expect(grown).toBeCloseTo(PLANT_SCALE, 5);
  });

  test("another park's seedlings stay in that park", () => {
    /**
     * Otherwise a meadow sown at Frick would come up inside Panther Hollow.
     *
     * Both directions, and the active park is moved between them rather than
     * asked about across a park boundary: heights come from whichever park is
     * BUILT, so asking Frick for Schenley's plants is a question with no honest
     * answer, and the module refuses it rather than returning a guess.
     */
    setActivePark("schenley");

    const [sx, , sz] = startPosition();
    const seedlings: Record<string, Seedling> = {
      a: { plant: "common-milkweed", park: "schenley", x: sx, z: sz, at: Date.now() },
    };

    expect(seedlingInstances(seedlings, "schenley", Date.now())).toHaveLength(1);

    setActivePark("frick");

    expect(seedlingInstances(seedlings, "frick", Date.now())).toHaveLength(0);
  });

  test("a species that no longer exists is skipped, not thrown over", () => {
    // A save is allowed to be older than the code. Dropping one row is right;
    // taking the whole park down because of it is not.
    setActivePark("frick");

    const [sx, , sz] = startPosition();
    const plant = SOLO_PLANTS.find((p) =>
      p.homes.some((home) => home.park === "frick"),
    )!;
    const seedlings: Record<string, Seedling> = {
      gone: { plant: "a-plant-that-was-removed", park: "frick", x: sx, z: sz, at: 1 },
      fine: { plant: plant.id, park: "frick", x: sx + 4, z: sz + 4, at: Date.now() },
    };

    expect(() => seedlingInstances(seedlings, "frick", Date.now())).not.toThrow();
    expect(
      seedlingInstances(seedlings, "frick", Date.now()).map((i) => i.id),
      "the good row was dropped along with the bad one",
    ).toEqual([plant.id]);
  });
});

test.describe("the park you are flying, not the one your save prefers", () => {
  test("a seed set away from your saved park is filed where you actually are", async ({
    page,
  }) => {
    test.setTimeout(240_000);

    /**
     * The two are not the same, and assuming they were was a real bug.
     *
     * The scene flies `partyPark ?? forcedPark ?? storedPark` and points the
     * world module at it, but `currentPark` in the save is only ever written by
     * `enterPark`. So joining a party at Highland with a save that says Frick
     * filed every seed under Frick at Highland's coordinates: it would surface
     * in the wrong park in a nonsense spot, or vanish into the waterline check,
     * and nothing anywhere would say a word.
     *
     * Driven through `?park=`, which reaches the same disagreement without
     * needing a second player, and which the game already documents as granting
     * no progress.
     */
    await signIn(page.context());
    await resetProgress(page);
    await page.addInitScript(() => window.localStorage.clear());
    await page.goto(
      `/play?debug=1&hour=${TEST_HOUR}&month=${TEST_MONTH}&park=schenley&busy=off`,
    );
    await page.waitForTimeout(2500);
    await dismissTutorial(page);
    await page.waitForTimeout(1200);

    // The save still says Frick: `?park=` deliberately does not change it.
    expect(
      await page.evaluate(
        () =>
          JSON.parse(window.localStorage.getItem("scout-game-state") ?? "{}")
            .state?.currentPark,
      ),
      "the test hook wrote the park into the save, so this proves nothing",
    ).toBe("frick");

    setActivePark("schenley");

    await flyToPlant(page, nearestPlantToSpawn());

    expect(
      await workUntilItTakes(page),
      "six visits and not one of them took",
    ).toBe(true);

    const seedling = await page.evaluate(() => {
      const raw = window.localStorage.getItem("scout-game-state");
      const all = JSON.parse(raw ?? "{}").state?.seedlings ?? {};

      return Object.values(all)[0] as { park: string } | undefined;
    });

    expect(
      seedling?.park,
      "the seed was filed under the saved park rather than the one being flown",
    ).toBe("schenley");
  });
});

test.describe("pollinating actually sows something", () => {
  test("a flower that takes leaves a seedling, and one that does not leaves none", async ({
    page,
  }) => {
    test.setTimeout(240_000);

    /**
     * The end to end claim, and the reason the feature exists.
     *
     * `?busy=off` so no attempt is refused for a reason this test is not about.
     */
    await enterGame(page, TEST_HOUR, TEST_MONTH, undefined, "off");

    const target = nearestPlantToSpawn();

    await flyToPlant(page, target);

    expect(
      await sownCount(page),
      "something was sown before anything was worked",
    ).toBe(0);

    expect(
      await workUntilItTakes(page),
      "six visits and not one of them took",
    ).toBe(true);

    /**
     * One seedling, and only one, however many times that stalk was worked.
     *
     * Keyed by the instance, so a player who works the same flower every
     * afternoon gets one plant beside it rather than a thicket on one spot.
     */
    expect(await sownCount(page)).toBe(1);

    const seedling = await page.evaluate(() => {
      const raw = window.localStorage.getItem("scout-game-state");
      const all = JSON.parse(raw ?? "{}").state?.seedlings ?? {};

      return Object.values(all)[0] as {
        plant: string;
        park: string;
        x: number;
        z: number;
        at: number;
      };
    });

    // Of the right species, in the right park, near the flower that set it.
    expect(seedling.plant).toBe(target.id);
    expect(seedling.park).toBe("frick");
    expect(
      Math.hypot(seedling.x - target.position[0], seedling.z - target.position[2]),
      "the seed did not land near its parent",
    ).toBeLessThan(20);

    // And the journal learned why any of that happened.
    const unlocked = await page.evaluate(
      () =>
        JSON.parse(window.localStorage.getItem("scout-game-state") ?? "{}").state
          ?.unlockedJournalEntries ?? {},
    );

    expect(unlocked["concept:seed-set"]).toBe(true);
  });
});

test.describe("the record cannot grow forever", () => {
  test("a seedling can itself be worked, which is why there has to be a cap", () => {
    /**
     * The unbounded case, and it is not obvious.
     *
     * A seedling is an ordinary instance, so it can be landed on and worked
     * like anything else, and working it keys a new record off ITS key:
     * `seed-plant-goldenrod-3` sets `seed-seed-plant-goldenrod-3`, which sets
     * another. Every generation costs eight days of growing, so it is slow, and
     * slow is not the same as bounded. A year of playing would leave thousands
     * of records in a save that is posted to Postgres whenever it changes.
     */
    let seedlings: Record<string, Seedling> = {};
    let key = "plant-goldenrod-3";

    for (let generation = 0; generation < MAX_SEEDLINGS + 40; generation += 1) {
      key = `seed-${key}`;
      seedlings = addSeedling(seedlings, key, {
        plant: "canada-goldenrod",
        park: "frick",
        x: 10,
        z: 10,
        at: generation,
      });
    }

    expect(Object.keys(seedlings)).toHaveLength(MAX_SEEDLINGS);
  });

  test("the cap drops the oldest, and never the one just sown", () => {
    /**
     * Which one falls off matters. Dropping the newest would mean a seed you
     * had this second watched take simply never appeared, which reads as the
     * feature being broken rather than as a limit being reached.
     */
    let seedlings: Record<string, Seedling> = {};

    for (let i = 0; i < MAX_SEEDLINGS; i += 1) {
      seedlings = addSeedling(seedlings, `flower-${i}`, {
        plant: "canada-goldenrod",
        park: "frick",
        x: i,
        z: i,
        at: 1000 + i,
      });
    }

    seedlings = addSeedling(seedlings, "the-newest", {
      plant: "canada-goldenrod",
      park: "frick",
      x: 999,
      z: 999,
      at: 9_999_999,
    });

    expect(Object.keys(seedlings)).toHaveLength(MAX_SEEDLINGS);
    expect(seedlings["the-newest"], "the seed just sown was dropped").toBeTruthy();
    expect(seedlings["flower-0"], "the oldest survived the cap").toBeFalsy();
    expect(seedlings["flower-1"], "more than the oldest was dropped").toBeTruthy();
  });

  test("working the same flower again replaces its seedling, not adds one", () => {
    // Otherwise standing on one stalk all afternoon fills the cap by itself and
    // pushes out every other patch you sowed.
    let seedlings: Record<string, Seedling> = {};

    for (let i = 0; i < 10; i += 1) {
      seedlings = addSeedling(seedlings, "plant-goldenrod-3", {
        plant: "canada-goldenrod",
        park: "frick",
        x: 10,
        z: 10,
        at: i,
      });
    }

    expect(Object.keys(seedlings)).toHaveLength(1);
  });
});

test.describe("two devices, one record", () => {
  const seedling = (at: number): Seedling => ({
    plant: "canada-goldenrod",
    park: "frick",
    x: 10,
    z: 10,
    at,
  });

  test("merging two saves keeps the cap", () => {
    /**
     * The cap has to survive the sync, and the first version of this did not.
     * The merge spread one save over the other and returned it, so two devices
     * each sitting at the limit came back with twice the limit: syncing was
     * itself the way around the bound.
     */
    const side = (offset: number) =>
      Object.fromEntries(
        Array.from({ length: MAX_SEEDLINGS }, (_, i) => [
          `flower-${offset + i}`,
          seedling(1000 + offset + i),
        ]),
      );

    const merged = mergeSeedlings(side(0), side(MAX_SEEDLINGS));

    expect(Object.keys(merged)).toHaveLength(MAX_SEEDLINGS);
  });

  test("a collision keeps the earlier date, so nothing shrinks", () => {
    /**
     * A seedling is measured by how long it has been growing, so the older
     * record is the further-grown one. Taking the fresher copy would shrink a
     * week-old plant back to a sprout because the phone had synced later.
     */
    const older = { a: seedling(1_000) };
    const newer = { a: seedling(9_000) };

    expect(mergeSeedlings(older, newer).a.at).toBe(1_000);
    expect(mergeSeedlings(newer, older).a.at).toBe(1_000);
  });

  test("nothing is lost when there is room for both", () => {
    // The ordinary case: two devices with different work on them.
    const merged = mergeSeedlings(
      { a: seedling(1), b: seedling(2) },
      { c: seedling(3) },
    );

    expect(Object.keys(merged).sort()).toEqual(["a", "b", "c"]);
  });

  test("an absent remote is not a reason to lose anything", () => {
    // A first sync, or a row that has never been written.
    expect(Object.keys(mergeSeedlings({ a: seedling(1) }, undefined))).toEqual([
      "a",
    ]);
  });
});
