import { expect, test } from "@playwright/test";

import { FUNGI } from "../src/features/game/data/fungi";
import {
  hasComeUp,
  scatterSpecies,
} from "../src/features/game/world/species-scatter";
import {
  FAIR_WEATHER,
  fungusFlush,
  weatherPreset,
  type Weather,
} from "../src/features/game/world/weather";
import { setActivePark } from "../src/features/game/world/terrain";

/**
 * The flush: mushrooms come up a few days after rain, not during it.
 *
 * Two to ten days is the real lag (Mass Audubon), and it is the whole reason this
 * exists: it makes last week's weather matter, which nothing else in the game
 * does. A clear afternoon can be the best mushroom day of the month.
 *
 * The load-bearing property is that the flush is ADDITIVE. Gating mushrooms that
 * already exist behind the weather would be the season soft-lock again with a
 * worse trigger: a player can wait out April by playing on, but cannot make it
 * rain, and "Three Parks, One City" wants every fungus found.
 */

/** A sky with a given run of daily rainfall behind it, oldest first, today last. */
const withRain = (mm: number[]): Weather => ({ ...FAIR_WEATHER, recentRain: mm });

test.describe("the fungus flush follows the rain, a few days behind", () => {
  test.afterEach(() => setActivePark("frick"));

  test("today's rain does nothing yet, and last week's does", () => {
    // A downpour this minute. The mycelium has not had time to answer it.
    expect(
      fungusFlush(withRain([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 40])),
      "a soaking today already counts",
    ).toBe(0);

    // Yesterday's, likewise: the lag starts at two days.
    expect(
      fungusFlush(withRain([0, 0, 0, 0, 0, 0, 0, 0, 0, 40, 0])),
      "yesterday's rain already counts",
    ).toBe(0);

    // Five days ago, and the wood is up.
    expect(
      fungusFlush(withRain([0, 0, 0, 0, 0, 40, 0, 0, 0, 0, 0])),
      "rain five days ago produced no flush",
    ).toBeGreaterThan(0.5);

    // Ten days ago is the far edge of the window, and still counts. An eleven-day
    // array puts the rain one day past it, where it has passed: index 0 of an
    // eleven-day run is ten days back, not eleven, which is exactly the sort of
    // off-by-one this test is here to keep honest.
    expect(
      fungusFlush(withRain([40, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0])),
      "rain ten days ago fell outside the window",
    ).toBeGreaterThan(0.5);

    expect(
      fungusFlush(withRain([40, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0])),
      "rain eleven days ago still counts",
    ).toBe(0);
  });

  test("a shower is not a soaking", () => {
    // Real numbers from a dry week with one passing shower in it.
    expect(fungusFlush(withRain([0, 0, 0, 2.5, 0, 0, 0, 0, 0, 0, 0]))).toBe(0);

    // And no rainfall history at all reads as dry, never as a flush. The service
    // being unreachable must not conjure mushrooms out of nothing.
    expect(fungusFlush(FAIR_WEATHER)).toBe(0);
    expect(fungusFlush({ ...FAIR_WEATHER, recentRain: [] })).toBe(0);
  });

  test("a sky with no rainfall history at all does not take the park down", () => {
    /**
     * The client CASTS `/api/weather`'s answer to `Weather` rather than checking
     * it, so the type is a promise about what the server meant, not about what the
     * scene is handed. A deployment older than this field, or a truncated
     * response, carries no `recentRain`, and reading `.length` off that throws
     * inside a render and takes the whole park with it.
     *
     * Deliberately lying to the type here, because the network can.
     */
    const truncated = { ...FAIR_WEATHER } as Partial<Weather> as Weather;
    delete (truncated as { recentRain?: number[] }).recentRain;

    expect(() => fungusFlush(truncated)).not.toThrow();
    expect(fungusFlush(truncated)).toBe(0);

    // And any other shape the wire might produce reads as a dry spell.
    for (const nonsense of [null, "wet", 42, {}]) {
      const bad = { ...FAIR_WEATHER, recentRain: nonsense } as unknown as Weather;

      expect(() => fungusFlush(bad), `${JSON.stringify(nonsense)} threw`).not.toThrow();
      expect(fungusFlush(bad)).toBe(0);
    }
  });

  test("every fungus can still be found in a dry spell, in every park", () => {
    /**
     * The one that would make "Three Parks, One City" unearnable.
     *
     * If any fungus existed only in the flush, a player could be locked out of
     * the completion badge by the weather, with no way to play around it.
     */
    const dry = fungusFlush(weatherPreset("dry")!);

    expect(dry, "the dry preset is not dry").toBe(0);

    const standing = new Set<string>();

    for (const park of ["frick", "schenley", "highland"] as const) {
      setActivePark(park);

      for (const instance of scatterSpecies()) {
        if (instance.species.kind === "fungus" && hasComeUp(instance, dry)) {
          standing.add(instance.id);
        }
      }
    }

    const missing = FUNGI.filter((fungus) => !standing.has(fungus.id));

    expect(
      missing.map((fungus) => fungus.id),
      "these fungi are only there after rain, so the weather can lock the badge",
    ).toEqual([]);
  });

  test("a flush adds mushrooms and never takes one away", () => {
    setActivePark("frick");

    const all = scatterSpecies();
    const wet = fungusFlush(weatherPreset("flush")!);

    expect(wet, "the flush preset does not flush").toBeGreaterThan(0.5);

    const dryUp = all.filter((i) => hasComeUp(i, 0));
    const wetUp = all.filter((i) => hasComeUp(i, wet));

    // Strictly a superset: everything standing in the dry is still standing.
    const wetKeys = new Set(wetUp.map((i) => i.key));

    for (const instance of dryUp) {
      expect(
        wetKeys.has(instance.key),
        `${instance.key} disappeared when it rained`,
      ).toBe(true);
    }

    // And there are visibly more of them. A flush nobody notices is not one.
    const dryFungi = dryUp.filter((i) => i.species.kind === "fungus").length;
    const wetFungi = wetUp.filter((i) => i.species.kind === "fungus").length;

    expect(wetFungi).toBeGreaterThan(dryFungi * 1.5);
  });

  test("flowers do not care how wet last week was", () => {
    setActivePark("frick");

    const plants = scatterSpecies().filter((i) => i.species.kind === "plant");

    expect(plants.length).toBeGreaterThan(0);
    expect(
      plants.filter((i) => i.flushAt > 0).map((i) => i.key),
      "a plant is being gated on rainfall",
    ).toEqual([]);
  });

  test("the base scatter is untouched by the flush existing", () => {
    /**
     * The flush extras are placed on their own seed channel precisely so the
     * mushrooms already in the wood do not move. `place` folds the count into its
     * sampling, so asking it for twice as many spots deals a different hand
     * entirely, and a player is supposed to be able to learn where things are.
     */
    setActivePark("frick");

    const base = scatterSpecies().filter(
      (i) => i.species.kind === "fungus" && i.flushAt === 0,
    );
    const extras = scatterSpecies().filter(
      (i) => i.species.kind === "fungus" && i.flushAt > 0,
    );

    expect(base.length).toBeGreaterThan(0);
    expect(extras.length).toBeGreaterThan(0);

    // Disjoint positions: the flush is new mushrooms, not the old ones twice.
    const baseSpots = new Set(base.map((i) => `${i.position[0]},${i.position[2]}`));

    for (const extra of extras) {
      expect(
        baseSpots.has(`${extra.position[0]},${extra.position[2]}`),
        `a flush mushroom is standing exactly where a permanent one is`,
      ).toBe(false);
    }
  });
});
