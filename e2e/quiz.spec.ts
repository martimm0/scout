import { expect, test } from "@playwright/test";

import { shuffledTriviaFor, TRIVIA } from "../src/features/game/data/trivia";
import { BADGES } from "../src/features/game/data/badges";
import { PLANTS } from "../src/features/game/data/plants";
import { useGameStore } from "../src/features/game/state/game-store";
import { signIn } from "./helpers";

/**
 * A quiz you could pass without reading anything.
 *
 * Found by playing, not by any test: the answer was the first option in 90 of the
 * 147 questions, because hand-written options come out in the order the writer
 * thought of them and the true one is what you think of first. Two right of three
 * is a pass, so "always tap the top one" cleared most of the game.
 *
 * The data cannot guarantee the property on its own, and rewriting 147 records
 * would only put it off until the 148th. So the game shuffles, and this asserts
 * the thing the shuffle is for.
 */
test.describe("the quiz cannot be beaten by always picking the first option", () => {
  test("the shuffle spreads the answer across every position", () => {
    // The REAL shuffle, the one the quiz calls, not a copy of it here. A copy
    // would keep passing after the game stopped shuffling.
    const atPosition = [0, 0, 0, 0];
    let total = 0;

    for (const id of Object.keys(TRIVIA)) {
      for (const question of shuffledTriviaFor(id)) {
        atPosition[question.answer] += 1;
        total += 1;
      }
    }

    // No position may be a winning bet. A pass is two of three, so anything much
    // over a third would still let a guesser through.
    for (const [position, count] of atPosition.entries()) {
      expect(
        count / total,
        `answer sits at position ${position} in ${((count / total) * 100).toFixed(0)}% of questions`,
      ).toBeLessThan(0.4);
    }
  });

  test("shuffling keeps every option, and keeps the answer pointing at the right one", () => {
    // The shuffle must not lose, duplicate or mislabel anything. It reorders and
    // re-indexes, and getting the re-index wrong would silently make every
    // question unanswerable rather than throw.
    for (const [id, source] of Object.entries(TRIVIA)) {
      const shuffled = shuffledTriviaFor(id);

      expect(shuffled.length).toBe(source.length);

      source.forEach((question, index) => {
        expect([...shuffled[index].options].sort()).toEqual(
          [...question.options].sort(),
        );
        expect(shuffled[index].options[shuffled[index].answer]).toBe(
          question.options[question.answer],
        );
      });
    }
  });
});

test.describe("a quiz counts once", () => {
  /**
   * Passing the milkweed quiz ten times is one quiz passed, not ten. The badge
   * said "Ten quizzes passed. You have actually been reading", and was earned
   * by reading one entry ten times; the journal's count said the same thing.
   * Both count distinct species passed now.
   */
  const earned = (id: string, passed: string[], passes: number) =>
    BADGES.find((badge) => badge.id === id)!.earned({
      ...useGameStore.getState(),
      quizPassed: Object.fromEntries(passed.map((plant) => [plant, true])),
      stats: { ...useGameStore.getState().stats, quizzesTaken: passes, quizzesPassed: passes },
    });

  test("ten passes of one quiz are not Top of the Class, ten different ones are", () => {
    // What ten retakes of one quiz leave behind: one species passed, ten passes.
    const one = [PLANTS[0].id];
    const ten = PLANTS.slice(0, 10).map((plant) => plant.id);

    expect(earned("quick-study", one, 10)).toBe(true);
    expect(earned("top-of-the-class", one, 10), "one quiz retaken ten times earned it").toBe(false);
    expect(earned("top-of-the-class", ten, 10)).toBe(true);
  });

  test("the journal counts quizzes, not passes", async ({ page }) => {
    await signIn(page.context());
    await page.addInitScript((id) => {
      window.localStorage.setItem(
        "scout-game-state",
        JSON.stringify({
          version: 0,
          state: {
            quizPassed: { [id]: true },
            stats: {
              pollinationAttempts: 0,
              pollinationSuccesses: 0,
              streak: 0,
              bestStreak: 0,
              quizzesTaken: 10,
              quizzesPassed: 10,
              questionsCorrect: 30,
            },
          },
        }),
      );
    }, PLANTS[0].id);

    await page.goto("/journal");

    const passed = page.locator('div:has(> dt:text-is("Quizzes passed")) > dd');

    await expect(passed).toHaveText("1");
  });
});

