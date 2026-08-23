import { expect, test } from "@playwright/test";

import { AMBIENT_COHORTS } from "../src/features/game/data/ambient";
import { POLLINATOR_ENTRIES } from "../src/features/game/data/journal";
import { STARTER_POLLINATORS } from "../src/features/game/data/starter-pollinators";
import {
  buildPollinatorGeometry,
  SPECIES_LIST,
} from "../src/features/game/models/pollinators";
import {
  basePalette,
  disposePollinatorGeometry,
} from "../src/features/game/models/species";
import { FUNGI } from "../src/features/game/data/fungi";
import { photoFor } from "../src/features/game/data/plant-photos";
import { PLANTS } from "../src/features/game/data/plants";
import { triviaFor } from "../src/features/game/data/trivia";
import { isActive } from "../src/features/game/world/daylight";
import { isOut, scatterSpecies } from "../src/features/game/world/species-scatter";
import { PARKS, setActivePark } from "../src/features/game/world/terrain";

/**
 * The night shift.
 *
 * The park has always got darker after dusk and otherwise carried on. Now there
 * is a flora that only opens then, and moths working it. The claim worth
 * testing is that the two halves of the day are genuinely different, not that
 * some data exists.
 */

const NIGHT_BLOOMERS = ["evening-primrose", "jimsonweed", "night-flowering-catchfly"];

test.describe("flowers that open after dark", () => {
  test("they are shut by day and open at night, which is the whole point", () => {
    for (const id of NIGHT_BLOOMERS) {
      const plant = PLANTS.find((p) => p.id === id)!;

      expect(plant, `${id} is not in the data`).toBeTruthy();

      // Midday: shut. Midnight: open. A window that wraps past midnight is the
      // thing being exercised, and it is easy to get inverted.
      expect(isActive(plant.window, 12), `${id} is open at noon`).toBe(false);
      expect(isActive(plant.window, 23), `${id} is shut at 11pm`).toBe(true);
      expect(isActive(plant.window, 2), `${id} is shut at 2am`).toBe(true);
      expect(isActive(plant.window, 9), `${id} is open at 9am`).toBe(false);
    }
  });

  test("the park really is a different place at midnight", () => {
    /**
     * Asked of the WORLD rather than of the data. A night flora that existed in
     * a record but never came out would pass every check above.
     */
    setActivePark("frick");

    const all = scatterSpecies();
    const openAt = (hour: number) =>
      all.filter(
        (instance) => instance.species.kind === "plant" && isOut(instance, hour, 8),
      );

    const byDay = openAt(12).map((i) => i.id);
    const byNight = openAt(23).map((i) => i.id);

    expect(byNight.length, "nothing at all is open at midnight").toBeGreaterThan(0);

    // And the two sets are genuinely different rather than one being a subset
    // of the other with the lights turned down.
    const onlyAtNight = byNight.filter((id) => !byDay.includes(id));

    expect(onlyAtNight.length, "nothing is exclusive to the night").toBeGreaterThan(
      0,
    );
    expect(onlyAtNight).toContain("evening-primrose");
  });

  test("each of them is spread across a different park", () => {
    // Otherwise one park is the night one and the other two are unchanged.
    const parks = NIGHT_BLOOMERS.map(
      (id) => PLANTS.find((p) => p.id === id)!.homes[0].park,
    );

    expect(new Set(parks).size, "the night flora is all in one park").toBe(
      parks.length,
    );
  });

  test("each has its quiz, like everything else in the journal", () => {
    for (const id of NIGHT_BLOOMERS) {
      expect(triviaFor(id).length, `${id} has no questions`).toBeGreaterThanOrEqual(
        3,
      );
    }
  });

  test("adding them did not move any park's door", () => {
    /**
     * The hazard this whole feature had to clear first.
     *
     * The unlock threshold used to be a FRACTION of however many plants a park
     * had, so shipping three new species would have told every player halfway
     * through Frick that they now needed nine flowers instead of eight, having
     * done nothing wrong. The requirement is a pinned count now, and this is the
     * test that says so out loud rather than trusting the comment.
     */
    expect(PARKS.schenley.requires?.needed).toBe(8);
    expect(PARKS.highland.requires?.needed).toBe(7);
  });
});

test.describe("moths", () => {
  test("they are out at night and grounded by wind, like real ones", () => {
    const moths = AMBIENT_COHORTS.find((c) => c.id === "moths")!;

    expect(moths, "there is no moth cohort").toBeTruthy();

    const sky = (over: Partial<Parameters<typeof moths.active>[1]> = {}) =>
      ({
        temperature: 18,
        wind: 4,
        falling: "none",
        condition: "clear",
        intensity: 0,
        ...over,
      }) as Parameters<typeof moths.active>[1];

    expect(moths.active("night", sky()), "no moths on a still warm night").toBe(
      true,
    );
    expect(moths.active("midday", sky()), "moths at noon").toBe(false);

    /**
     * Wind is the one that matters and the one a guess would get wrong. A moth
     * has very low wing loading and simply cannot fly in much of a breeze,
     * which is why a gusty night catches nothing in a light trap.
     */
    expect(moths.active("night", sky({ wind: 30 })), "moths in a gale").toBe(false);
    expect(moths.active("night", sky({ falling: "rain" })), "moths in rain").toBe(
      false,
    );
    expect(moths.active("night", sky({ temperature: 2 })), "moths in frost").toBe(
      false,
    );
  });

  test("the day shift and the night shift are not both out at once", () => {
    // Otherwise the park just accumulates insects rather than changing over.
    const foragers = AMBIENT_COHORTS.find((c) => c.id === "foragers")!;
    const moths = AMBIENT_COHORTS.find((c) => c.id === "moths")!;

    const sky = {
      temperature: 18,
      wind: 4,
      falling: "none",
      condition: "clear",
      intensity: 0,
    } as Parameters<typeof moths.active>[1];

    expect(foragers.active("midday", sky)).toBe(true);
    expect(moths.active("midday", sky)).toBe(false);

    expect(foragers.active("night", sky)).toBe(false);
    expect(moths.active("night", sky)).toBe(true);
  });
});

test.describe("the moth you can fly", () => {
  test("it builds, like the other three, from one spec file", () => {
    /**
     * The claim `pollinators.ts` has been making since there were three: adding
     * a body costs one spec and nothing else. Asserted by actually compiling the
     * geometry, because a spec with a palette entry missing throws inside the
     * voxel builder and takes the whole scene down with it. That has happened
     * before, from a cloud save with a partial bee in it.
     */
    for (const spec of SPECIES_LIST) {
      const geometry = buildPollinatorGeometry(
        spec.id,
        { bodyColor: "#c8b183", wingColor: "#b7ac97", accentColor: "#4a4038" },
        // Wing style is the bee's alone; the others declare
        // `supportsWingStyle: false` and ignore it. Passing a real one anyway
        // checks that the ignoring actually happens.
        "round",
        "cap",
      );

      for (const [part, mesh] of Object.entries(geometry)) {
        if (part === "hindWing" && spec.parts.hindWing === null) {
          continue;
        }

        expect(mesh, `${spec.id} built no ${part}`).toBeTruthy();
      }

      disposePollinatorGeometry(geometry);
    }
  });

  test("every letter its art uses has a colour behind it", () => {
    /**
     * The failure this guards is silent and total: the voxel builder throws
     * "missing an entry for B" and the scene goes black. Checked for every
     * species rather than just the new one, because the palettes are merged
     * over a shared base and a change to that base breaks whichever spec was
     * leaning on it.
     */
    const colors = {
      bodyColor: "#c8b183",
      wingColor: "#b7ac97",
      accentColor: "#4a4038",
    };

    for (const spec of SPECIES_LIST) {
      const palette = { ...basePalette(colors), ...spec.palette(colors) };

      for (const [name, part] of Object.entries(spec.parts)) {
        if (!part) {
          continue;
        }

        for (const layer of part.layers) {
          for (const row of layer) {
            for (const glyph of row) {
              if (glyph === ".") {
                continue;
              }

              expect(
                palette[glyph],
                `${spec.id}'s ${name} uses "${glyph}" and nothing defines it`,
              ).toBeTruthy();
            }
          }
        }
      }
    }
  });

  test("it is the fast one, and it is not the butterfly twice", () => {
    // A fourth body is only worth flying if it handles differently. If these
    // ever converge, the moth has become a reskin.
    const moth = SPECIES_LIST.find((s) => s.id === "moth")!;
    const butterfly = SPECIES_LIST.find((s) => s.id === "butterfly")!;

    expect(moth.flight.speed).toBeGreaterThan(butterfly.flight.speed);
    expect(moth.flight.responsiveness).toBeGreaterThan(
      butterfly.flight.responsiveness,
    );

    // And it holds station where a butterfly floats about, which is the thing
    // that lets it work a deep flower at all.
    expect(moth.animation.bob).toBeLessThan(butterfly.animation.bob);
    expect(moth.animation.wingSpeed).toBeGreaterThan(butterfly.animation.wingSpeed);
  });

  test("it is offered as something you can actually choose", () => {
    const moth = STARTER_POLLINATORS.find((p) => p.type === "moth");

    expect(moth, "the moth cannot be picked").toBeTruthy();
    expect(moth!.description.length).toBeGreaterThan(20);

    // And the journal has something to say about it once you have flown it.
    const entry = POLLINATOR_ENTRIES.find((e) => e.id === "moth");

    expect(entry, "no journal entry for the moth").toBeTruthy();
    expect(entry!.body.length).toBeGreaterThan(200);
  });
});

test.describe("every species is illustrated and credited", () => {
  test("no species ships without a photograph", () => {
    /**
     * The gap this closes was real and invisible.
     *
     * Three night bloomers shipped with no photograph, and nothing anywhere
     * noticed: the entry renders without the figure, so it looks like a design
     * choice rather than a hole. Sixty-one species had one and three did not,
     * which is precisely the kind of quiet inconsistency that never gets found
     * by looking.
     */
    for (const species of [...PLANTS, ...FUNGI]) {
      expect(
        photoFor(species.id),
        `${species.id} has no photograph`,
      ).toBeTruthy();
    }
  });

  test("every photograph carries a licence this project may use", () => {
    /**
     * Rule 2: every photograph's author and licence come from the Commons API
     * rather than from memory. A credit that is present but wrong is worse than
     * a missing one, because it looks discharged.
     *
     * The licence set is the same one `scripts/source-photo.mjs` enforces at
     * the point of download, so this is the second half of a rule the tooling
     * already applies once.
     */
    const allowed = /^(public domain|cc0|cc by)/i;

    for (const species of [...PLANTS, ...FUNGI]) {
      const photo = photoFor(species.id)!;

      expect(photo.author.length, `${species.id} has no author`).toBeGreaterThan(1);
      expect(photo.license, `${species.id} has licence "${photo.license}"`).toMatch(
        allowed,
      );

      // Not a share-alike-forbidding or non-commercial variant sneaking in
      // under a name that starts the same way.
      expect(photo.license, `${species.id} is non-free`).not.toMatch(/nc|nd/i);

      expect(photo.sourceUrl).toMatch(/^https:\/\/commons\.wikimedia\.org\/wiki\/File:/);
      expect(photo.licenseUrl).toMatch(/^https?:\/\//);
    }
  });
});

test.describe("the licence gate on the sourcing script", () => {
  test("it passes what the project may use and refuses the rest", async () => {
    /**
     * The one thing in `source-photo.mjs` that must not be wrong.
     *
     * Everything else there costs a retry. This costs shipping somebody's
     * photograph against their terms, and it is a single regular expression
     * standing between the two, which nothing was checking.
     *
     * Both directions, because a gate that accepts everything passes any test
     * that only feeds it good input.
     */
    const { mayUse } = await import("../scripts/source-photo.mjs");

    for (const licence of [
      "CC BY-SA 4.0",
      "CC BY-SA 3.0",
      "CC BY 2.0",
      "CC0",
      "CC0 1.0",
      "Public domain",
      "public domain",
    ]) {
      expect(mayUse(licence), `${licence} was refused`).toBe(true);
    }

    for (const licence of [
      // The non-commercial and no-derivatives variants, which start with the
      // same four characters as the ones that are fine.
      "CC BY-NC 4.0",
      "CC BY-NC-SA 4.0",
      "CC BY-ND 3.0",
      "CC BY-NC-ND 2.0",
      "All rights reserved",
      "Fair use",
      // And anything it cannot read at all. This fails CLOSED: a template id
      // rather than a short name, or nothing, is refused rather than guessed.
      "cc-by-nc-4.0",
      "",
      null,
      undefined,
    ]) {
      expect(mayUse(licence), `${licence} was accepted`).toBe(false);
    }
  });

  test("importing it does not run the command line", async () => {
    /**
     * It exports a function and it is also a script. Without a guard, importing
     * the one runs the other: the first version of this printed a usage message
     * and called `process.exit(1)` through the middle of the test process.
     */
    const script = await import("../scripts/source-photo.mjs");

    expect(typeof script.mayUse).toBe("function");
  });
});
