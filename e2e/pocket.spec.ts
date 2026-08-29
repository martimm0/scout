import { expect, test, type Page } from "@playwright/test";

import { FUNGI_BY_ID, SOLO_FUNGI } from "../src/features/game/data/fungi";
import { PLANTS_BY_ID, SOLO_PLANTS } from "../src/features/game/data/plants";
import {
  REFUSAL,
  answerFor,
  factOfTheDay,
  vocabulary,
} from "../src/features/game/world/answers";
import { PARKS } from "../src/features/game/world/terrain";
import { signIn } from "./helpers";

/**
 * Pocket: the bee you can ask things.
 *
 * The answerer is a pure module, so most of this could be asserted without a
 * browser, and some of it is. But what matters is what a player reads, so the
 * questions are typed into the real box on the real page and the answer is read
 * back off the screen, the same way `field-notes.spec.ts` pins the hour and
 * reads the card.
 *
 * The expected strings come out of the data rather than being typed in here. A
 * hard-coded bloom window that happens to be right tells you nothing about
 * whether the page went and looked.
 */

/** A save that has met a few specific things and nothing else. */
const KNOWN_PLANTS = ["common-milkweed", "swamp-milkweed", "canada-goldenrod"];
const KNOWN_FUNGI = ["turkey-tail"];

const SEED = {
  discoveredPlants: Object.fromEntries(KNOWN_PLANTS.map((id) => [id, true])),
  discoveredFungi: Object.fromEntries(KNOWN_FUNGI.map((id) => [id, true])),
  quizPassed: {},
  unlockedParks: {},
  unlockedMapAreas: {},
};

async function openPocket(page: Page, signedIn = true) {
  if (signedIn) {
    await signIn(page.context());
  }

  await page.addInitScript((seed) => {
    window.localStorage.setItem(
      "scout-game-state",
      JSON.stringify({ version: 0, state: seed }),
    );
  }, SEED);

  await page.goto("/pocket");
  await page.waitForTimeout(600);
}

/** Type a question, press Ask, and hand back the newest answer on screen. */
async function ask(page: Page, question: string) {
  await page.getByLabel("Your question").fill(question);
  await page.getByRole("button", { name: "Ask" }).click();

  return page
    .getByRole("log", { name: "What you asked" })
    .locator("li")
    .first()
    .locator("[data-answer]");
}

test.describe("the pollinator answers questions", () => {
  test("it reads the real bloom window off the plant it was asked about", async ({
    page,
  }) => {
    await openPocket(page);

    const milkweed = PLANTS_BY_ID.get("common-milkweed");
    expect(milkweed, "the seed names a plant that exists").toBeTruthy();

    const answer = await ask(page, "when does common milkweed bloom");

    // From the data. The point is that the page went and looked, not that
    // somebody typed "June to August" in two places.
    await expect(answer).toContainText(milkweed!.bloom);
    await expect(answer).toHaveAttribute("data-answer", "plant:common-milkweed");
  });

  test("it will say where a thing grows, and when it is open", async ({ page }) => {
    await openPocket(page);

    const where = await ask(page, "where does canada goldenrod grow");
    await expect(where).toHaveAttribute("data-answer", "plant:canada-goldenrod");
    await expect(where).toContainText("grows at");

    const turkeyTail = FUNGI_BY_ID.get("turkey-tail");
    const eat = await ask(page, "can I eat turkey tail");
    await expect(eat).toHaveAttribute("data-answer", "fungus:turkey-tail");
    // The edibility is real, and the standing warning goes with it every time.
    await expect(eat).toContainText("do not eat anything on my say so");
    expect(turkeyTail!.edibility).toBe("inedible");
    await expect(eat).toContainText("inedible");
  });

  test("a species you have not found is not a species it will discuss", async ({
    page,
  }) => {
    await openPocket(page);

    const unmet = SOLO_PLANTS.find((plant) => !KNOWN_PLANTS.includes(plant.id));
    expect(unmet, "the game has more plants than the seed").toBeTruthy();

    /**
     * Asked by its scientific name, so the common name is not on the page
     * already.
     *
     * The first draft typed the common name into the box, and of course found
     * it on the page afterwards: the transcript echoes what the player typed.
     * That proved nothing. Asking in Latin means the display name can only
     * appear if the GAME put it there.
     */
    const answer = await ask(page, `tell me about ${unmet!.scientificName}`);

    await expect(answer).toHaveText(REFUSAL);

    /**
     * And it refuses in the SAME words as a question it could not parse.
     *
     * "You have not found that yet" would be friendlier and would confirm the
     * species exists, which is the discovery the whole game is built on.
     */
    await expect(page.getByRole("main")).not.toContainText(unmet!.commonName);

    // The Latin works, though, for something you have met: the refusal above is
    // about the save, not about failing to understand the question.
    const met = await ask(page, `tell me about ${PLANTS_BY_ID.get("common-milkweed")!.scientificName}`);
    await expect(met).toHaveAttribute("data-answer", "plant:common-milkweed");
  });

  test("it will not say how the game was made", async ({ page }) => {
    await openPocket(page);

    for (const question of [
      "how was this made",
      "what engine does this run on",
      "who wrote you",
      // The one the closed vocabulary does not catch on its own: a species it
      // knows, and a made-of question wrapped around it.
      "did you use AI to write the common milkweed fact",
    ]) {
      const answer = await ask(page, question);
      await expect(answer, `"${question}" was answered`).toHaveText(REFUSAL);
    }
  });

  test("a name that means two things gets a question back, not a guess", async ({
    page,
  }) => {
    await openPocket(page);

    const answer = await ask(page, "milkweed");

    await expect(answer).toHaveAttribute("data-answer", "ambiguous");
    await expect(answer).toContainText(PLANTS_BY_ID.get("common-milkweed")!.commonName);
    await expect(answer).toContainText(PLANTS_BY_ID.get("swamp-milkweed")!.commonName);
  });

  test("it says out loud how much it can talk about", async ({ page }) => {
    await openPocket(page);

    /**
     * The counter is what pays for the refusal above.
     *
     * Refusing a species you have not met only works as a design if the
     * boundary is visible, otherwise the box looks broken. Frick is open to
     * everybody, so that is the one park.
     */
    await expect(page.getByRole("main")).toContainText(
      `It knows ${KNOWN_PLANTS.length} flowers, ${KNOWN_FUNGI.length} fungus and 1 park so far.`,
    );
  });

  test("it knows what it is, and how far you have got", async ({ page }) => {
    await openPocket(page);

    const self = await ask(page, "what am I");
    await expect(self).toHaveAttribute("data-answer", "pollinator:bee");

    const progress = await ask(page, "how many have I found");
    await expect(progress).toHaveText(
      `${KNOWN_PLANTS.length} of ${SOLO_PLANTS.length} flowers, and ${KNOWN_FUNGI.length} of ${SOLO_FUNGI.length} fungi.`,
    );
  });
});

test.describe("the fact of the day", () => {
  test("it is the same fact all day, and a different one tomorrow", () => {
    const found = {
      plants: SEED.discoveredPlants,
      fungi: SEED.discoveredFungi,
    };
    const save = { found, quizPassed: {}, unlockedParks: {}, unlockedMapAreas: {} };

    // Same date in, same fact out, every time. This is the whole promise.
    expect(factOfTheDay({ date: "Mon 14 Jul", ...save }).id).toBe(
      factOfTheDay({ date: "Mon 14 Jul", ...save }).id,
    );

    /**
     * And it moves. A "fact of the day" that is the same fact every day is a
     * bug that would never announce itself, because any single day looks right.
     */
    const week = new Set(
      ["Mon 14 Jul", "Tue 15 Jul", "Wed 16 Jul", "Thu 17 Jul", "Fri 18 Jul", "Sat 19 Jul"].map(
        (date) => factOfTheDay({ date, ...save }).id,
      ),
    );

    expect(week.size).toBeGreaterThan(1);
  });

  test("it only ever talks about things you have found", () => {
    const save = {
      found: { plants: SEED.discoveredPlants, fungi: SEED.discoveredFungi },
      quizPassed: {},
      unlockedParks: {},
      unlockedMapAreas: {},
    };

    const allowed = new Set([
      ...KNOWN_PLANTS.map((id) => `plant:${id}`),
      ...KNOWN_FUNGI.map((id) => `fungus:${id}`),
      // Frick needs nothing, so it is always in the pool.
      "park:frick",
    ]);

    for (let day = 0; day < 60; day += 1) {
      const fact = factOfTheDay({ date: `day-${day}`, ...save });

      expect(allowed.has(fact.id), `day ${day} offered ${fact.id}`).toBe(true);
    }
  });

  test("a brand new save still has something true to say", () => {
    /**
     * There is no blank first day.
     *
     * Frick needs nothing to unlock, so it is in the pool from the first load
     * and a player who has found nothing is told about the park they are
     * standing in. The empty-pool branch in `factOfTheDay` is a guard against
     * indexing nothing, not a state any real save reaches, and this is the test
     * that says so.
     */
    const fact = factOfTheDay({
      date: "Mon 14 Jul",
      found: { plants: {}, fungi: {} },
      quizPassed: {},
      unlockedParks: {},
      unlockedMapAreas: {},
    });

    expect(fact.id).toBe("park:frick");
    expect(fact.text.length).toBeGreaterThan(0);
  });

  test("a quiz you have not taken is not spoiled by it", () => {
    /**
     * Trivia answers are the best prose in the repository and this reads them,
     * which means it can hand you the answer to a question you are about to be
     * asked. Only a species whose quiz you have passed may contribute one.
     */
    const found = { plants: { "common-milkweed": true }, fungi: {} };
    const before = factOfTheDay({
      date: "Mon 14 Jul",
      found,
      quizPassed: {},
      unlockedParks: {},
      unlockedMapAreas: {},
    });

    const milkweed = PLANTS_BY_ID.get("common-milkweed")!;

    if (before.id === "plant:common-milkweed") {
      expect(before.text).toBe(`${milkweed.fact} ${milkweed.pollinatorNote}`);
    }

    // With the quiz passed it is allowed to use the richer answer, so the two
    // are not required to agree.
    const after = factOfTheDay({
      date: "Mon 14 Jul",
      found,
      quizPassed: { "common-milkweed": true },
      unlockedParks: {},
      unlockedMapAreas: {},
    });

    expect(after.id).toBe(before.id);
  });
});

test.describe("the answerer refuses honestly", () => {
  const empty = {
    found: { plants: {}, fungi: {} },
    quizPassed: {},
    unlockedParks: {},
    unlockedMapAreas: {},
    pollinator: { type: "bee", name: "Scout" },
    month: 7,
    hour: 12,
  };

  test("nonsense, silence and detail it does not have all get the same line", () => {
    for (const question of [
      "",
      "   ",
      "asdfghjkl",
      // A plant it knows about, asked something the data does not carry.
      "what colour are common milkweed leaves",
    ]) {
      expect(
        answerFor({ ...empty, found: { plants: { "common-milkweed": true }, fungi: {} }, question }).text,
        `"${question}"`,
      ).toBe(REFUSAL);
    }
  });

  test("a park you earned but never had flagged counts as open", () => {
    /**
     * The store's `parkUnlocked` is `flag OR count >= needed`, and its comment
     * says why: the flag records the moment, the count is the truth, and a save
     * written before the flag existed must not be locked out of a park it has
     * already earned. Reading only the flag here told somebody "eight flowers
     * in Frick Park opens Schenley Park, you have eight" about a park the rest
     * of the game had already opened.
     */
    const needed = PARKS.schenley.requires!.needed;
    const earned = SOLO_PLANTS.filter((plant) =>
      plant.homes.some((home) => home.park === "frick"),
    ).slice(0, needed);

    expect(earned.length).toBe(needed);

    const found = {
      plants: Object.fromEntries(earned.map((plant) => [plant.id, true])),
      fungi: {},
    };

    // No flag anywhere in this save.
    const answer = answerFor({ ...empty, found, question: "how do I unlock schenley" });

    expect(answer.id).toBe("park:schenley");
    expect(answer.text).toContain("already open");
    expect(vocabulary({ found, unlockedParks: {} }).parks).toBe(2);
  });

  test("a park is never a secret, because the picker already tells you", () => {
    // Schenley is locked in this save. "How do I unlock it" is the most obvious
    // question anybody will type and refusing it would be keeping a secret that
    // is printed on another page of the same site.
    const answer = answerFor({ ...empty, question: "how do I unlock schenley" });

    expect(answer.id).toBe("park:schenley");
    expect(answer.text).toContain("You have 0");
  });
});

test.describe("signed out, Pocket is the camera and nothing else", () => {
  test("no ask box, no fact, and the bee is the one the game comes with", async ({
    page,
  }) => {
    // Deliberately NOT added to the gated-route loop in pages.spec.ts: this
    // page is meant to work without an account.
    await openPocket(page, false);

    await expect(page.getByRole("heading", { name: "Sign in to fly" })).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "Pocket" })).toBeVisible();

    // The two signed-in surfaces are absent, not disabled.
    await expect(page.getByLabel("Your question")).toHaveCount(0);
    await expect(page.getByRole("log", { name: "What you asked" })).toHaveCount(0);

    // The camera is there for anybody.
    await expect(page.getByRole("button", { name: "Turn the camera on" })).toBeVisible();
  });
});
