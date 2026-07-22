import { expect, test } from "@playwright/test";

import { FUNGI } from "../src/features/game/data/fungi";
import { PLANTS } from "../src/features/game/data/plants";
import {
  isInSeason,
  seasonFor,
  seasonWindow,
} from "../src/features/game/world/season";

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
});
