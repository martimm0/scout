import { expect, test } from "@playwright/test";

import {
  CONNECTIONS,
  connectionOpen,
  needsParty,
  openConnections,
} from "../src/features/game/data/connections";
import { FUNGI_BY_ID } from "../src/features/game/data/fungi";
import { PLANTS_BY_ID } from "../src/features/game/data/plants";
import { enterGame } from "./helpers";

/**
 * The ecology layer: what the species have to do with each other.
 *
 * The riskiest thing here is not the code, it is the data. A connection that
 * names a species which does not exist is a journal entry nobody can ever open,
 * and this project has shipped that exact bug twice with species themselves.
 */

test.describe("the connections are sound", () => {
  test("every species named in one actually exists", () => {
    // The bug that has happened before, asked directly. A typo in an id makes an
    // entry permanently unreachable, and nothing else in the game would notice.
    for (const connection of CONNECTIONS) {
      for (const id of connection.between) {
        expect(
          PLANTS_BY_ID.has(id) || FUNGI_BY_ID.has(id),
          `"${connection.id}" names ${id}, which is not a species in the game`,
        ).toBe(true);
      }
    }
  });

  test("anything needing a party says so, and most do not", () => {
    /**
     * Party-only species are deliberately kept out of every counter in the game,
     * so that a solo player is never shown a door they cannot open. A connection
     * resting on one is allowed, because parties are supposed to be worth
     * joining, but it has to ANNOUNCE itself rather than sit in the journal
     * looking like something the player merely missed.
     *
     * The flag is derived from the species rather than typed in beside the
     * entry, so this checks the derivation agrees with the data instead of
     * checking a constant against itself.
     */
    for (const connection of CONNECTIONS) {
      const partySpecies = connection.between.filter(
        (id) => PLANTS_BY_ID.get(id)?.partyOnly ?? FUNGI_BY_ID.get(id)?.partyOnly,
      );

      expect(
        needsParty(connection),
        `"${connection.id}" needs ${partySpecies.join(", ")} and does not say so`,
      ).toBe(partySpecies.length > 0);
    }

    // And the layer is mostly reachable alone. If this ever inverts, the feature
    // has quietly become party content.
    const solo = CONNECTIONS.filter((c) => !needsParty(c));

    expect(solo.length).toBeGreaterThan(CONNECTIONS.length / 2);
  });

  test("each is sourced, and none of them is thin", () => {
    const ids = new Set<string>();

    for (const connection of CONNECTIONS) {
      expect(ids.has(connection.id), `duplicate id ${connection.id}`).toBe(false);
      ids.add(connection.id);

      // Rule 1: a link without a source does not ship, however good the line.
      expect(connection.source, `${connection.id} has no source`).toMatch(
        /^https:\/\/en\.wikipedia\.org\/wiki\/\w/,
      );

      expect(connection.between.length, `${connection.id} connects nothing`)
        .toBeGreaterThan(0);
      expect(connection.title.length).toBeGreaterThan(3);

      // Long enough to actually say something. A one-line "these are related"
      // is the coincidence this file exists to refuse.
      expect(
        connection.body.length,
        `${connection.id} is too thin to be worth an entry`,
      ).toBeGreaterThan(200);
    }
  });

  test("one opens only when every species in it has been found", () => {
    /**
     * The unlock rule, and both directions of it. Asserting only that a full set
     * opens would pass just as well against a function that always returned
     * true, which is the shape of half the vacuous tests in this suite's
     * history.
     */
    const connection = CONNECTIONS.find((c) => c.between.length > 1)!;
    const [first, ...rest] = connection.between;

    const found = (ids: string[]) => ({
      plants: Object.fromEntries(ids.map((id) => [id, true])),
      fungi: Object.fromEntries(ids.map((id) => [id, true])),
    });

    expect(connectionOpen(connection, found([]))).toBe(false);
    expect(connectionOpen(connection, found([first]))).toBe(false);

    if (rest.length > 0) {
      expect(connectionOpen(connection, found(rest))).toBe(false);
    }

    expect(connectionOpen(connection, found(connection.between))).toBe(true);
  });

  test("a fresh player has none of them, and a finished one has all", () => {
    expect(openConnections({ plants: {}, fungi: {} })).toHaveLength(0);

    const everything = {
      plants: Object.fromEntries([...PLANTS_BY_ID.keys()].map((id) => [id, true])),
      fungi: Object.fromEntries([...FUNGI_BY_ID.keys()].map((id) => [id, true])),
    };

    expect(openConnections(everything)).toHaveLength(CONNECTIONS.length);
  });
});

test.describe("the connections tab", () => {
  test("locked entries name what is still missing rather than hiding it", async ({
    page,
  }) => {
    /**
     * A locked entry that says "???" teaches nothing and tempts nobody, which is
     * the rule the concept entries already follow. Here the missing species ARE
     * the hint, so they are shown by name.
     */
    await enterGame(page);
    await page.goto("/journal");

    await page.getByRole("button", { name: "Connections" }).click();

    // Scoped to this tab's own list. `data-locked` is used by the parks panel
    // higher up the page as well, and an unscoped locator finds Schenley.
    const list = page.locator("[data-journal-tab='connections']");
    const rows = list.locator("[data-locked='true']");

    await expect(rows.first()).toBeVisible();

    // Nothing is open on a fresh save, so every row should be a locked one.
    await expect(rows).toHaveCount(CONNECTIONS.length);
    await expect(rows.first()).toContainText("Still to find:");

    /**
     * Common names, never raw ids. `nameOf` falls back to the id it was given,
     * so a species renamed in the data would quietly start rendering
     * "swamp-milkweed" at somebody, and the fallback is exactly the sort of
     * thing that never gets noticed.
     */
    const text = (await list.textContent()) ?? "";

    for (const connection of CONNECTIONS) {
      for (const id of connection.between) {
        expect(text, `${id} rendered as a raw id`).not.toContain(id);
      }
    }

    // And a locked entry does not give away what it says.
    for (const connection of CONNECTIONS) {
      expect(text).not.toContain(connection.body.slice(0, 40));
    }

    // The two that need company say so, rather than looking like a miss.
    expect(text).toContain("Only in a garden party");
  });
});
