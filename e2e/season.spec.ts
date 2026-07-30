import { expect, test } from "@playwright/test";

import { FUNGI } from "../src/features/game/data/fungi";
import { PLANTS } from "../src/features/game/data/plants";
import {
  enterGame,
  flyToPlant,
  outOfBloomPlantToSpawn,
  TEST_HOUR,
} from "./helpers";
import {
  briefSeasonWindow,
  isInSeason,
  seasonFor,
  seasonLook,
  seasonWindow,
} from "../src/features/game/world/season";
import {
  isFindable,
  isOut,
  scatterSpecies,
} from "../src/features/game/world/species-scatter";
import { setActivePark } from "../src/features/game/world/terrain";

/**
 * Seasons are read out of the sourced strings, not invented, so the load-bearing
 * test is that every one of them parses. A bloom or fungus season the parser
 * cannot read falls back to all-year, which would quietly show a flower every
 * month of the year; this catches that at the source, the way the anagram and
 * demanding-share tests catch their own.
 */
test.describe("the calendar is read from the sourced strings", () => {
  test("every plant's bloom parses to a real month window", () => {
    for (const plant of PLANTS) {
      const window = seasonWindow(plant.bloom);

      expect(
        window.allYear,
        `${plant.commonName} bloom "${plant.bloom}" fell back to all-year`,
      ).toBeFalsy();

      if (!window.allYear) {
        expect(window.from).toBeGreaterThanOrEqual(1);
        expect(window.from).toBeLessThanOrEqual(12);
        expect(window.to).toBeGreaterThanOrEqual(1);
        expect(window.to).toBeLessThanOrEqual(12);
      }
    }
  });

  test("every fungus season parses without falling through", () => {
    for (const fungus of FUNGI) {
      const window = seasonWindow(fungus.season);

      // Fungi are allowed to be all-year (several genuinely fruit every month),
      // but anything with a "to" in it must resolve to a real window.
      if (/\bto\b/.test(fungus.season.toLowerCase()) && !window.allYear) {
        expect(window.from).toBeGreaterThanOrEqual(1);
        expect(window.to).toBeLessThanOrEqual(12);
      }
    }
  });

  test("the parser reads months, seasons, modifiers and wraps", () => {
    expect(seasonWindow("June to August")).toEqual({ from: 6, to: 8 });
    expect(seasonWindow("March to May")).toEqual({ from: 3, to: 5 });
    expect(seasonWindow("Summer to autumn")).toEqual({ from: 6, to: 11 });
    expect(seasonWindow("Late summer to autumn")).toEqual({ from: 8, to: 11 });
    expect(seasonWindow("Autumn to spring")).toEqual({ from: 9, to: 5 });
    expect(seasonWindow("All year")).toEqual({ allYear: true });
  });

  test("isInSeason handles the wrap across the new year", () => {
    const overwinter = seasonWindow("Autumn to spring"); // Sep -> May

    expect(isInSeason(overwinter, 1)).toBe(true); // January is inside it
    expect(isInSeason(overwinter, 10)).toBe(true); // October is inside it
    expect(isInSeason(overwinter, 7)).toBe(false); // July is not

    const summer = seasonWindow("June to August");

    expect(isInSeason(summer, 7)).toBe(true);
    expect(isInSeason(summer, 1)).toBe(false);
  });

  test("seasonFor sorts the months", () => {
    expect(seasonFor(4)).toBe("spring");
    expect(seasonFor(7)).toBe("summer");
    expect(seasonFor(10)).toBe("autumn");
    expect(seasonFor(1)).toBe("winter");
    expect(seasonFor(12)).toBe("winter");
  });

  /**
   * The snow is a bump across the whole winter, not a spike at New Year.
   *
   * December is month 12 and January is month 1, so the month number goes DOWN in
   * the middle of the season and the winter index has to be stitched across that
   * join. It was stitched a month out, and the index jumped straight over the
   * point where the sine peaks: the deepest snow of the year was never drawn, and
   * February was bare ground for the whole month. Nothing threw, and every
   * screenshot anybody happened to take still looked like winter.
   *
   * So this asserts the SHAPE, which is the thing that was wrong: bare at both
   * ends, deep in the middle, and continuous across the turn of the year.
   */
  test("snow builds through winter and eases off, with no jump at New Year", () => {
    const snowAt = (month: number) => seasonLook(month).snow;

    // Bare at both ends of the season.
    expect(snowAt(12), "snow on the first of December").toBeLessThan(0.05);
    expect(snowAt(2.99), "snow at the very end of February").toBeLessThan(0.2);

    // Deep in the middle, which is mid-January.
    expect(snowAt(1.5), "mid-January is the deep of winter").toBeGreaterThan(0.95);

    // February is one of the snowiest months Pittsburgh has. It was zero.
    expect(snowAt(2), "the first of February").toBeGreaterThan(0.8);
    expect(snowAt(2.5), "mid-February").toBeGreaterThan(0.4);

    // And continuous across the December/January join: sampling either side of
    // midnight on the 31st must not step. This is what the off-by-a-month did.
    expect(
      Math.abs(snowAt(12.99) - snowAt(1)),
      "the snow jumps at the turn of the year",
    ).toBeLessThan(0.1);

    // Rising to the middle, falling away after it, with no second peak.
    const samples = [12, 12.5, 1, 1.5, 2, 2.5, 2.99].map(snowAt);
    const peak = samples.indexOf(Math.max(...samples));

    expect(peak, "the deepest snow is not in the middle of the winter").toBe(3);
  });

  /**
   * The world samples a whole month at its MIDDLE, and every winter month must
   * come out with snow on it.
   *
   * Terrain and foliage are baked geometry rebuilt only when the month turns, so
   * one sample stands for the month (`lookForMonth` in frick-park.tsx). Sampling
   * the first of the month instead reads the very start of each curve, and the
   * snow bump is zero at both its ends: December had no snow on the ground at all,
   * for the whole month, in a game that keeps Pittsburgh's calendar.
   */
  test("every month of winter has snow on the ground, December included", () => {
    // What the world actually asks for: the midpoint of each whole month.
    const winter = { December: 12, January: 1, February: 2 };

    for (const [name, month] of Object.entries(winter)) {
      const look = seasonLook(month + 0.5);

      expect(look.snow, `${name} has no snow`).toBeGreaterThan(0.3);
      expect(look.groundMix, `${name}'s ground is not white`).toBeGreaterThan(0.2);
    }

    // January is still the deepest of the three.
    expect(seasonLook(1.5).snow).toBeGreaterThan(seasonLook(12.5).snow);
    expect(seasonLook(1.5).snow).toBeGreaterThan(seasonLook(2.5).snow);

    // And the shoulder months stay clear: no snow in November or March.
    expect(seasonLook(11.5).snow, "November has snow").toBe(0);
    expect(seasonLook(3.5).snow, "March has snow").toBe(0);
  });

  test("the badge version of the hint stays short enough for the card", () => {
    // The card in the world is a fixed sixteen ems and carries other pills
    // beside this one. The sentence belongs on the landing card; this is the
    // three words that fit in the world, and it says nothing while in season.
    for (const plant of PLANTS) {
      const window = seasonWindow(plant.bloom);

      for (let month = 1; month <= 12; month += 1) {
        const brief = briefSeasonWindow(window, month);

        if (isInSeason(window, month) || window.allYear) {
          expect(brief).toBe("");
          continue;
        }

        expect(brief, `${plant.id} has no hint in month ${month}`).not.toBe("");
        expect(
          brief.length,
          `${plant.id}'s badge would not fit the card: "${brief}"`,
        ).toBeLessThan(22);
      }
    }
  });
});

/**
 * The one that soft-locked the game, and it was found by playing rather than by
 * anything here.
 *
 * Discovery used to need the bloom, so in July only seven of Frick's sixteen
 * plants could be found at all, and Schenley opens on eight. A player who started
 * in the wrong month could fill their journal early and then run out of park with
 * nowhere to go.
 *
 * Plants are findable year round now; only the pollinating waits for the flower.
 * These walk all twelve months, because the bug was invisible in whichever month
 * the suite happened to be run in.
 */
test.describe("a park can always be finished, whatever the month", () => {
  /**
   * `setActivePark` is module-level mutable state shared by every spec in the
   * worker, so a test that walks all three parks and stops must put it back.
   *
   * Leaving it on Highland made the flight test below fly to coordinates from the
   * wrong park and find nothing there, and it would have done the same to any
   * later spec file in the same worker.
   */
  test.afterEach(() => setActivePark("frick"));

  /** Distinct plant ids the discovery loop would actually accept, by the real rule. */
  const findablePlants = (
    park: "frick" | "schenley" | "highland",
    month: number,
  ) => {
    setActivePark(park);

    const ids = new Set<string>();

    for (const instance of scatterSpecies()) {
      // Noon, so the daily window is open and only the calendar is under test.
      if (instance.species.kind === "plant" && isFindable(instance, 12, month)) {
        ids.add(instance.id);
      }
    }

    return ids;
  };

  test("every plant in every park is findable in every month", () => {
    for (const park of ["frick", "schenley", "highland"] as const) {
      const total = PLANTS.filter((plant) =>
        plant.homes.some((home) => home.park === park),
      ).length;

      for (let month = 1; month <= 12; month += 1) {
        expect(
          findablePlants(park, month).size,
          `${park} loses plants to the calendar in month ${month}`,
        ).toBe(total);
      }
    }
  });

  test("half of Frick is reachable in the leanest month, so Schenley can open", () => {
    const total = PLANTS.filter((plant) =>
      plant.homes.some((home) => home.park === "frick"),
    ).length;
    const needed = Math.ceil(total * 0.5);

    for (let month = 1; month <= 12; month += 1) {
      const found = findablePlants("frick", month).size;

      expect(
        found,
        `only ${found} of Frick's plants are findable in month ${month}, and Schenley needs ${needed}`,
      ).toBeGreaterThanOrEqual(needed);
    }
  });

  test("but the bloom still gates the pollinating, or seasons mean nothing", () => {
    setActivePark("frick");

    const workableInJuly = new Set(
      scatterSpecies()
        .filter((i) => i.species.kind === "plant" && isOut(i, 12, 7))
        .map((i) => i.id),
    );
    const workableInJanuary = new Set(
      scatterSpecies()
        .filter((i) => i.species.kind === "plant" && isOut(i, 12, 1))
        .map((i) => i.id),
    );

    // Findable everywhere, workable only in season: that is the whole fix.
    expect(workableInJuly.size).toBeGreaterThan(0);
    expect(workableInJuly.size).toBeLessThan(findablePlants("frick", 7).size);
    expect(workableInJanuary.size).toBe(0);
  });

  test("every fungus is findable somewhere in the year, or a badge is unearnable", () => {
    /**
     * The other side of the fungus rule.
     *
     * A fungus out of season is genuinely gone, which is right, but "Three Parks,
     * One City" wants every plant AND every fungus found. One mushroom with a
     * season and an hour window that never open together would make that badge
     * quietly impossible, and nothing would say so.
     */
    const reachable = new Set<string>();

    for (const park of ["frick", "schenley", "highland"] as const) {
      setActivePark(park);

      for (const instance of scatterSpecies()) {
        if (instance.species.kind !== "fungus") {
          continue;
        }

        for (let month = 1; month <= 12; month += 1) {
          for (let hour = 0; hour < 24; hour += 1) {
            if (isFindable(instance, hour, month)) {
              reachable.add(instance.id);
            }
          }
        }
      }
    }

    const missing = FUNGI.filter((fungus) => !reachable.has(fungus.id));

    expect(
      missing.map((fungus) => `${fungus.id} (${fungus.season})`),
      "these fungi cannot be found at any hour of any month",
    ).toEqual([]);
  });

  test("fungi still keep their seasons, because mushrooms really do rot away", () => {
    // The other half of the rule: a fungus out of season IS gone, and at least
    // one of them has a real season, or the distinction has quietly collapsed.
    const seasonal = FUNGI.filter(
      (fungus) => !seasonWindow(fungus.season).allYear,
    );

    expect(seasonal.length).toBeGreaterThan(0);

    const winterOnly = seasonal.filter(
      (fungus) => !isInSeason(seasonWindow(fungus.season), 7),
    );

    expect(
      winterOnly.length,
      "no fungus is out of season in July, so nothing proves the gate works",
    ).toBeGreaterThan(0);
  });
});

/**
 * The season fix, from the player's side.
 *
 * The describe above proves the rule holds for every plant in every month, and
 * `pages.spec.ts` proves `canPollinate` refuses. This is the part a player would
 * actually notice: fly to a flower that is out of its bloom and you can still land
 * on it, read it and be quizzed by it, and the card says why there is nothing to
 * pollinate rather than simply omitting the button.
 *
 * Before the fix you could not reach the flower at all. It had no tag, no mote and
 * no card, because discovery was gated on the bloom, which is what let a player
 * find seven of Frick's sixteen plants and then run out of park.
 */
test.describe("a flower out of its bloom, in the hand", () => {
  test("can be met and quizzed, and says why it cannot be worked", async ({
    page,
  }) => {
    test.setTimeout(240_000);

    // A month the target is genuinely NOT flowering in, picked from its own
    // sourced bloom string rather than guessed.
    const target = outOfBloomPlantToSpawn();

    await enterGame(page, TEST_HOUR, target.month);

    const arrived = await flyToPlant(page, target.instance);
    expect(arrived, `never reached ${target.instance.id}`).toBe(true);

    // Found from the air, out of season: the whole point of the fix.
    await expect(
      page.getByRole("button", { name: /^Land/ }),
    ).toBeVisible();

    // Space, not a click on the card: the card is anchored in the WORLD and the
    // bee never stops bobbing, so Playwright waits forever for it to be "stable".
    await page.keyboard.press("Space");

    const menu = page.getByRole("dialog", { name: /^Landed on/ });
    await expect(menu).toBeVisible();

    // No way to work it, and the card says why and when to come back.
    await expect(menu.getByText("Not in flower")).toBeVisible();
    await expect(menu.getByRole("button", { name: /Pollinate/ })).toHaveCount(0);

    // And the rest of the plant is still on offer, which is the reason it is
    // findable at all.
    await expect(menu.getByRole("button", { name: /quiz/i })).toBeVisible();
  });
});
