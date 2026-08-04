import { expect, test } from "@playwright/test";

import { enterGame, flyToPlant, TEST_HOUR } from "./helpers";
import { PLANTS } from "../src/features/game/data/plants";
import {
  isFindable,
  scatterSpecies,
} from "../src/features/game/world/species-scatter";
import { setActivePark, startPosition } from "../src/features/game/world/terrain";
import {
  askingWinterName,
  isWinterMonth,
  standsInWinter,
  winterEvidence,
  winterOptions,
  winterStanding,
} from "../src/features/game/world/winter";

/** January. The park is bare, and naming things is the whole game. */
const WINTER = 1;

test.describe("what still stands in winter", () => {
  test("the spring ephemerals are not asked about, because they are gone", () => {
    /**
     * The rule that keeps this honest. Trout lily and bloodroot are not dormant
     * in January, they are ABSENT: everything above ground died back by
     * midsummer. Asking somebody to name one from its winter silhouette would be
     * asking about a plant that is not there.
     */
    const ephemerals = [
      "trout-lily",
      "bloodroot",
      "white-trillium",
      "dutchmans-breeches",
      "mayapple",
      "cutleaf-toothwort",
      "virginia-bluebell",
    ];

    for (const id of ephemerals) {
      const plant = PLANTS.find((entry) => entry.id === id);

      expect(plant, `${id} is not in the data`).toBeTruthy();
      expect(
        standsInWinter(plant!),
        `${id} is being asked about in winter, and it is not there`,
      ).toBe(false);
    }
  });

  test("woody plants always stand, because that is what woody means", () => {
    for (const plant of PLANTS.filter(
      (entry) => entry.archetype === "tree" || entry.archetype === "shrub",
    )) {
      expect(standsInWinter(plant), `${plant.id} is woody but does not stand`).toBe(
        true,
      );
    }
  });

  test("every park has enough standing to make a question", () => {
    // Four options, so a park needs at least four or the board repeats itself.
    for (const park of ["frick", "schenley", "highland"] as const) {
      expect(
        winterStanding(park).length,
        `${park} has too little standing in winter to ask about`,
      ).toBeGreaterThanOrEqual(4);
    }
  });

  test("a question's wrong answers are all plausible", () => {
    /**
     * Every option has to be a plant that is IN this park and that also stands
     * through winter. An option you could rule out by knowing it does not grow
     * here, or has no winter form at all, is padding rather than a wrong answer.
     */
    for (const park of ["frick", "schenley", "highland"] as const) {
      const standing = winterStanding(park);

      for (const plant of standing) {
        const options = winterOptions(plant, park);

        expect(options, `${plant.id} has no board`).toContainEqual(plant);
        expect(new Set(options.map((o) => o.id)).size).toBe(options.length);

        for (const option of options) {
          expect(
            standing.some((entry) => entry.id === option.id),
            `${option.id} is on ${plant.id}'s board but does not stand in ${park}`,
          ).toBe(true);
        }
      }
    }
  });

  test("the same plant asks the same question twice", () => {
    // Seeded, not random: a species that rerolled its board until it was easy
    // would be a species you could farm.
    const plant = winterStanding("frick")[0];

    expect(winterOptions(plant, "frick").map((o) => o.id)).toEqual(
      winterOptions(plant, "frick").map((o) => o.id),
    );
  });

  test("the evidence says something for every standing plant", () => {
    for (const park of ["frick", "schenley", "highland"] as const) {
      for (const plant of winterStanding(park)) {
        const lines = winterEvidence(plant, park);

        expect(lines.length, `${plant.id} has no winter evidence`).toBeGreaterThan(
          2,
        );

        for (const line of lines) {
          expect(line.trim().length).toBeGreaterThan(0);
        }
      }
    }
  });

  test("the tag and the landing card ask the same question", () => {
    /**
     * They used to decide this separately, four conditions written out twice in
     * two files, and the failure mode is quiet: a card that hides the name with
     * no way to answer, or a question offered about a plant the tag has already
     * named. The frame loop kept its own copy of "is a popover open" for the same
     * reason and it drifted within weeks.
     *
     * One function decides it now. This walks the whole truth table to say so.
     */
    const plant = winterStanding("frick")[0];
    const ephemeral = PLANTS.find((entry) => entry.id === "trout-lily")!;

    for (const met of [true, false]) {
      for (const named of [true, false]) {
        for (const month of [1, 7]) {
          const expected =
            month === 1 && met && !named && standsInWinter(plant);

          expect(
            askingWinterName(plant, month, { met, named }),
            `month ${month}, met ${met}, named ${named}`,
          ).toBe(expected);
        }
      }
    }

    // And a plant that is not there in January is never asked about, however
    // well you know it.
    expect(
      askingWinterName(ephemeral, 1, { met: true, named: false }),
      "an ephemeral is being asked about in January",
    ).toBe(false);
  });

  test("winter is December, January and February", () => {
    expect([12, 1, 2].every(isWinterMonth)).toBe(true);
    expect([3, 6, 9, 11].some(isWinterMonth)).toBe(false);
  });
});

test.describe("naming a plant from its winter form", () => {
  test("the card withholds the name, and getting it right records it", async ({
    page,
  }) => {
    test.setTimeout(300_000);

    setActivePark("frick");

    const [sx, , sz] = startPosition();
    const target = scatterSpecies()
      .filter(
        (instance) =>
          instance.species.kind === "plant" &&
          standsInWinter(instance.species.plant) &&
          isFindable(instance, TEST_HOUR, WINTER),
      )
      .map((instance) => ({
        instance,
        distance: Math.hypot(
          instance.position[0] - sx,
          instance.position[2] - sz,
        ),
      }))
      .sort((a, b) => a.distance - b.distance)[0].instance;

    /**
     * Meet it in SUMMER first. The winter question is a second pass over a plant
     * you already know, never a wall for somebody who started playing in January,
     * so an unmet plant in winter behaves exactly as it always has.
     */
    await enterGame(page, TEST_HOUR, 7);
    const metInSummer = await flyToPlant(page, target);

    expect(metInSummer, `never reached ${target.id} in summer`).toBe(true);
    await expect(
      page.getByText(target.commonName, { exact: false }).first(),
    ).toBeVisible();

    // Now January, same plant, same place. The card stops telling you.
    await page.goto(`/play?debug=1&hour=${TEST_HOUR}&month=${WINTER}`);
    await page.waitForTimeout(2500);
    await flyToPlant(page, target);

    await expect(page.getByText("Winter form").first()).toBeVisible();
    await expect(
      page.getByText(target.commonName, { exact: false }),
      "the card is still naming it in winter",
    ).toHaveCount(0);

    // Land, and the card must keep the same secret.
    //
    // This is the assertion that was missing when the feature shipped: the tag
    // withheld the name and the landing card then announced it in its title and
    // again in the not-in-flower note, so pressing Space handed over the answer
    // before the question had been asked. Checking the tag alone passed happily.
    await page.keyboard.press("Space");

    const landed = page.getByRole("dialog", { name: /^Landed on/ });
    await expect(landed).toBeVisible();
    await expect(
      landed.getByText(target.commonName, { exact: false }),
      "the landing card gives the winter answer away",
    ).toHaveCount(0);

    await page
      .getByRole("button", { name: /Name it from its winter form/ })
      .click();

    const dialog = page.getByRole("dialog", {
      name: /Name it from its winter form/,
    });
    await expect(dialog).toBeVisible();

    /**
     * Escape leaves, without answering.
     *
     * The panel has no close button until it has been answered and the flight
     * loop counts it as a pause, so with no key handler the only way out of the
     * question was to guess: a player who opened it meaning to go and read the
     * entry first was held in a frozen park. Every other popover here leaves on
     * Escape and this one did not.
     */
    await page.keyboard.press("Escape");
    await expect(dialog, "Escape does not leave the winter question").toHaveCount(
      0,
    );

    // Leaving records nothing, so it is still asking.
    expect(
      await page.evaluate(
        (id) =>
          Boolean(
            JSON.parse(localStorage.getItem("scout-game-state") ?? "{}")?.state
              ?.winterKnown?.[id as string],
          ),
        target.id,
      ),
      "walking away from the question counted as naming it",
    ).toBe(false);

    // Back in, and answer it properly this time.
    await page.keyboard.press("Space");
    await page
      .getByRole("button", { name: /Name it from its winter form/ })
      .click();
    await expect(dialog).toBeVisible();

    // The evidence is on the card: shape, height, place.
    await expect(dialog.getByText(/standing/i).first()).toBeVisible();

    // Answer it correctly.
    await dialog.getByRole("button", { name: target.commonName }).click();
    await expect(dialog.getByText("That is the one.")).toBeVisible();

    await expect
      .poll(async () =>
        page.evaluate(
          (id) =>
            Boolean(
              JSON.parse(localStorage.getItem("scout-game-state") ?? "{}")?.state
                ?.winterKnown?.[id as string],
            ),
          target.id,
        ),
      )
      .toBe(true);
  });
});
