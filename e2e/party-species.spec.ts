import { expect, test } from "@playwright/test";

import {
  FUNGI,
  FUNGI_BY_ID,
  PARTY_FUNGI,
  SOLO_FUNGI,
} from "../src/features/game/data/fungi";
import {
  PARTY_PLANTS,
  PLANTS,
  PLANTS_BY_ID,
  SOLO_PLANTS,
} from "../src/features/game/data/plants";
import { photoFor } from "../src/features/game/data/plant-photos";
import { triviaFor } from "../src/features/game/data/trivia";
import { BADGES } from "../src/features/game/data/badges";
import {
  plantsIn,
  requirementFor,
  useGameStore,
} from "../src/features/game/state/game-store";
import {
  scatterSpecies,
} from "../src/features/game/world/species-scatter";
import { setActivePark } from "../src/features/game/world/terrain";
import { allAreas } from "../src/features/game/world/park";
import { PARKS } from "../src/features/game/world/terrain";

/**
 * The twelve species you can only meet with other people in the park.
 *
 * Half of this file is about what they must NOT change. Adding species to a
 * game that counts species is the kind of edit that breaks things quietly and
 * somewhere else, so the numbers that were true before they existed are pinned
 * here as numbers.
 */

const PARKS_LIST = ["frick", "schenley", "highland"] as const;

test.describe("what the party species must not change", () => {
  test("the park unlock threshold is exactly what it was", () => {
    /**
     * The one that would actually hurt somebody.
     *
     * `plantsIn` feeds the unlock ladder. Frick has sixteen plants a player can
     * find alone and Schenley opens at half of them, so `needed` is eight.
     * Counting the two party plants would make it nine: a door somebody was
     * walking towards moving further away, over a feature they may never have
     * opened. Pinned as a NUMBER, because "the badge still exists" would pass
     * against exactly that.
     */
    setActivePark("frick");

    /**
     * The doors, as literal numbers.
     *
     * This used to also assert Frick had exactly sixteen plants and to
     * recompute Highland's threshold as `ceil(schenley.length * 0.5)`, which
     * made it a test about the species COUNT. That was the right test while the
     * threshold was a fraction of that count, and it is the wrong one now: the
     * requirement is pinned precisely so the count can grow without the door
     * moving, so tying the assertion back to the count would reintroduce the
     * coupling this is here to prevent. Three night-blooming species shipped
     * and these two numbers did not move, which is the whole claim.
     */
    expect(requirementFor("schenley", {})?.needed).toBe(8);
    expect(requirementFor("highland", {})?.needed).toBe(7);

    // And the door is genuinely independent of how many plants exist: every
    // park has more than its threshold, and adding more cannot change it.
    expect(plantsIn("frick").length).toBeGreaterThanOrEqual(8);
    expect(plantsIn("schenley").length).toBeGreaterThanOrEqual(7);

    // And no party plant can ever satisfy it.
    const found: Record<string, boolean> = {};

    for (const plant of PARTY_PLANTS) {
      found[plant.id] = true;
    }

    expect(
      requirementFor("schenley", found)?.found,
      "a party plant counted towards unlocking a park",
    ).toBe(0);
  });

  test("finding every solo species still earns the per-park badges", () => {
    /**
     * The assertion that would have caught all four counters at once: a save
     * that has found everything reachable alone, and NO party species, still
     * completes the game.
     */
    /**
     * Built from the REAL initial state, not a hand-rolled object.
     *
     * The first attempt listed the fields by hand and left some out, so the
     * badge conditions threw on undefined rather than answering. A test that
     * has to keep a copy of the store's shape in step with the store is a test
     * that will be wrong eventually.
     */
    const state = {
      ...useGameStore.getState(),
      discoveredPlants: Object.fromEntries(
        SOLO_PLANTS.map((plant) => [plant.id, true]),
      ),
      discoveredFungi: Object.fromEntries(
        SOLO_FUNGI.map((fungus) => [fungus.id, true]),
      ),
      // Every area walked, so the "seen everything" badges are testing the
      // species counters rather than the map.
      unlockedMapAreas: Object.fromEntries(
        PARKS_LIST.flatMap((park) =>
          allAreas(PARKS[park]).map((area) => [area.id, true]),
        ),
      ),
    };

    /**
     * Named badges, and NO escape hatch.
     *
     * The first version of this skipped ids it could not find, and every id in
     * it was wrong, so it passed by checking nothing at all. It caught neither
     * of the counters it was written for. If one of these is renamed the test
     * must fail loudly rather than quietly stop testing.
     *
     * Only badges that count SPECIES. `ecologist` counts journal concepts and
     * would fail here for reasons that have nothing to do with garden parties.
     */
    const mustBeEarnable = [
      "native-plant-friend",
      "mycologist",
      "schenley-botanist",
      "highland-botanist",
      "both-parks",
    ];

    for (const id of mustBeEarnable) {
      const badge = BADGES.find((entry) => entry.id === id);

      expect(badge, `there is no badge called ${id} any more`).toBeTruthy();
      expect(
        badge!.earned(state),
        `${id} cannot be earned without garden parties`,
      ).toBe(true);
    }
  });

  test("the party species are not in the park when you are alone", () => {
    for (const park of PARKS_LIST) {
      setActivePark(park);

      const alone = scatterSpecies();
      const together = scatterSpecies(true);

      const partyIds = new Set([
        ...PARTY_PLANTS.map((plant) => plant.id),
        ...PARTY_FUNGI.map((fungus) => fungus.id),
      ]);

      expect(
        alone.filter((instance) => partyIds.has(instance.id)),
        `${park} grows party species with nobody in it`,
      ).toHaveLength(0);

      expect(
        together.filter((instance) => partyIds.has(instance.id)).length,
        `${park} has no party species even in a party`,
      ).toBeGreaterThan(0);
    }
  });

  test("adding them moves nothing that was already there", () => {
    /**
     * The scatter is deterministic and people learn where things are. Each
     * species is placed from its own area and count rather than its position in
     * the list, so appending must leave every existing stalk exactly where it
     * was. This compares the two scatters position by position.
     */
    for (const park of PARKS_LIST) {
      setActivePark(park);

      const alone = scatterSpecies();
      const together = scatterSpecies(true);
      const byKey = new Map(
        together.map((instance) => [instance.key, instance]),
      );

      for (const instance of alone) {
        const same = byKey.get(instance.key);

        expect(same, `${instance.key} vanished in a party`).toBeTruthy();
        expect(
          same!.position,
          `${instance.key} moved when the party species were added`,
        ).toEqual(instance.position);
      }
    }
  });
});

test.describe("the twelve themselves", () => {
  test("there are twelve, four per park, two plants and two fungi", () => {
    expect(PARTY_PLANTS).toHaveLength(6);
    expect(PARTY_FUNGI).toHaveLength(6);

    for (const park of PARKS_LIST) {
      const plants = PARTY_PLANTS.filter((plant) =>
        plant.homes.some((home) => home.park === park),
      );
      const fungi = PARTY_FUNGI.filter((fungus) =>
        fungus.homes.some((home) => home.park === park),
      );

      expect(plants, `${park} has the wrong party plants`).toHaveLength(2);
      expect(fungi, `${park} has the wrong party fungi`).toHaveLength(2);
    }
  });

  test("every one lives somewhere that exists", () => {
    for (const species of [...PARTY_PLANTS, ...PARTY_FUNGI]) {
      for (const home of species.homes) {
        const areas = allAreas(PARKS[home.park]).map((area) => area.id);

        expect(
          areas,
          `${species.id} lives in ${home.area}, which is not in ${home.park}`,
        ).toContain(home.area);
      }
    }
  });

  test("every one has a licensed photograph with a credit", () => {
    for (const species of [...PARTY_PLANTS, ...PARTY_FUNGI]) {
      const photo = photoFor(species.id);

      expect(photo, `${species.id} has no photograph`).toBeTruthy();
      expect(photo!.author, `${species.id} has no author`).toBeTruthy();
      expect(photo!.sourceUrl).toMatch(/^https:\/\/commons\.wikimedia\.org\//);

      // The licence has to be one we are actually allowed to use.
      expect(
        photo!.license.toLowerCase(),
        `${species.id} has licence ${photo!.license}`,
      ).toMatch(/^(cc0|public domain|cc by)/);
      expect(photo!.licenseUrl, `${species.id} has no licence url`).toBeTruthy();
    }
  });

  test("every one has three hand-written questions", () => {
    for (const species of [...PARTY_PLANTS, ...PARTY_FUNGI]) {
      const questions = triviaFor(species.id);

      expect(questions, `${species.id} has no quiz`).toHaveLength(3);

      for (const question of questions) {
        expect(question.options.length).toBe(4);
        expect(question.answer).toBeGreaterThanOrEqual(0);
        expect(question.answer).toBeLessThan(question.options.length);
        expect(
          question.because.length,
          `${species.id} has a question that explains nothing`,
        ).toBeGreaterThan(30);
        expect(new Set(question.options).size).toBe(4);
      }
    }
  });

  test("every one links somewhere real, and reads as itself", () => {
    for (const species of [...PARTY_PLANTS, ...PARTY_FUNGI]) {
      expect(species.wikipedia).toMatch(
        /^https:\/\/en\.wikipedia\.org\/wiki\/\w/,
      );
      expect(species.hook.length, `${species.id} has no hook`).toBeGreaterThan(
        10,
      );
      expect(species.fact.length, `${species.id} has no fact`).toBeGreaterThan(
        60,
      );
      expect(species.commonName).toBeTruthy();
      expect(species.scientificName).toBeTruthy();
    }
  });

  test("the ids are unique across the whole game", () => {
    const ids = [...PLANTS, ...FUNGI].map((species) => species.id);

    expect(new Set(ids).size, "two species share an id").toBe(ids.length);

    // And the lookups reach the new ones.
    for (const plant of PARTY_PLANTS) {
      expect(PLANTS_BY_ID.get(plant.id)).toBeTruthy();
    }

    for (const fungus of PARTY_FUNGI) {
      expect(FUNGI_BY_ID.get(fungus.id)).toBeTruthy();
    }
  });
});
