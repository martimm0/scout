import { expect, test } from "@playwright/test";

import { shuffledTriviaFor, TRIVIA } from "../src/features/game/data/trivia";

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
