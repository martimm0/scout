import { expect, test } from "@playwright/test";

import { PLANTS } from "../src/features/game/data/plants";
import { plantsIn } from "../src/features/game/state/game-store";
import { momentsBetween, type MomentState } from "../src/features/game/state/moments";
import { enterGame, findPlant, nearestPlantToSpawn } from "./helpers";

/**
 * The game notices.
 *
 * A first find, a new park, a streak and a finished park each used to pass with
 * at most a chime. They are now a line at the top of the screen. The rules for
 * what counts live in one pure function, so most of this needs no browser: it
 * hands that function a before and an after and reads what it says. The first
 * test is the one in the real park, to prove the function is actually wired to
 * something.
 */

const stats = {
  pollinationAttempts: 0,
  pollinationSuccesses: 0,
  streak: 0,
  bestStreak: 0,
  quizzesTaken: 0,
  quizzesPassed: 0,
  questionsCorrect: 0,
};

function state(overrides: Partial<MomentState> = {}): MomentState {
  return {
    discoveredPlants: {},
    discoveredFungi: {},
    unlockedParks: { frick: true },
    currentPark: "frick",
    stats: stats as MomentState["stats"],
    ui: { nearby: null },
    ...overrides,
  };
}

const near = (id: string) => ({ nearby: { kind: "plant" as const, id, key: `${id}-0` } });

test.describe("moments", () => {
  test("meeting a plant for the first time says so, by name", async ({ page }) => {
    test.setTimeout(180_000);

    await enterGame(page);
    expect(await findPlant(page), "never got near the flower").toBe(true);

    const plant = nearestPlantToSpawn();
    const name = plant.species.kind === "plant" ? plant.species.plant.commonName : "";
    const moment = page.locator('[data-moment="New find"]');

    await expect(moment).toBeVisible();
    await expect(moment).toContainText(name);
    // And then it gets out of the way by itself.
    await expect(moment).toHaveCount(0, { timeout: 8_000 });
  });
});

test.describe("what counts as a moment", () => {
  test.skip(({ browserName }) => browserName !== "chromium", "no browser involved");

  const [first, second] = plantsIn("frick");

  test("one new plant, with the bee beside it, is a find", () => {
    const moments = momentsBetween(
      state(),
      state({ discoveredPlants: { [first.id]: true }, ui: near(first.id) }),
    );

    expect(moments.map((moment) => moment.label)).toEqual(["New find"]);
    expect(moments[0].title).toBe(first.commonName);
  });

  test("a save loading is not forty finds", () => {
    const everything = Object.fromEntries(PLANTS.map((plant) => [plant.id, true]));

    expect(momentsBetween(state(), state({ discoveredPlants: everything, ui: near(first.id) }))).toEqual([]);
    // Nor is one plant arriving from the cloud while the bee is somewhere else.
    expect(momentsBetween(state(), state({ discoveredPlants: { [first.id]: true } }))).toEqual([]);
  });

  test("a park that opens with a find is announced, once", () => {
    const before = state({ discoveredPlants: { [first.id]: true } });
    const after = state({
      discoveredPlants: { [first.id]: true, [second.id]: true },
      unlockedParks: { frick: true, schenley: true },
      ui: near(second.id),
    });
    const labels = momentsBetween(before, after).map((moment) => moment.label);

    expect(labels).toContain("A new park is open");
    // Already open: saying it again on the next find would be nagging.
    expect(
      momentsBetween(after, { ...after, discoveredFungi: { "turkey-tail": true }, ui: near("turkey-tail") }).map(
        (moment) => moment.label,
      ),
    ).not.toContain("A new park is open");
  });

  test("a park arriving with a loaded save is not announced", () => {
    expect(
      momentsBetween(state(), state({ unlockedParks: { frick: true, schenley: true } })),
    ).toEqual([]);
  });

  test("the last plant in the park says so", () => {
    const all = plantsIn("frick");
    const last = all[all.length - 1];
    const others = Object.fromEntries(all.slice(0, -1).map((plant) => [plant.id, true]));
    const labels = momentsBetween(
      state({ discoveredPlants: others }),
      state({ discoveredPlants: { ...others, [last.id]: true }, ui: near(last.id) }),
    ).map((moment) => moment.label);

    expect(labels).toContain("Every plant found");
  });

  test("three in a row is a streak; loading a streak of three is not", () => {
    const at = (streak: number) => state({ stats: { ...stats, streak } as MomentState["stats"] });

    expect(momentsBetween(at(2), at(3)).map((moment) => moment.title)).toEqual(["3 in a row"]);
    expect(momentsBetween(at(3), at(4))).toEqual([]);
    expect(momentsBetween(at(4), at(5)).map((moment) => moment.title)).toEqual(["5 in a row"]);
    expect(momentsBetween(at(0), at(3)), "a loaded save counted as a streak").toEqual([]);
  });
});
