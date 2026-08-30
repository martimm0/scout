import { expect, test, type Page } from "@playwright/test";

import { EDIBILITY_LABEL, FUNGI, FUNGI_BY_ID } from "../src/features/game/data/fungi";
import {
  PARTY_PLANTS,
  PLANTS,
  PLANTS_BY_ID,
  SOLO_PLANTS,
} from "../src/features/game/data/plants";
import {
  REFUSAL,
  answerFor,
  factOfTheDay,
  vocabulary,
} from "../src/features/game/world/answers";
import { PARKS } from "../src/features/game/world/terrain";
import { isInSeason, seasonWindow } from "../src/features/game/world/season";
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

  test("the placeholder models a question it can actually answer", async ({
    page,
  }) => {
    /**
     * It used to read "When does milkweed bloom?", which is a refusal for
     * anybody who has not met a milkweed and a request to disambiguate for
     * anybody who has met both. A placeholder is the first thing a new player
     * reads, and one that models a question the box usually cannot answer
     * teaches exactly the wrong thing.
     */
    await openPocket(page);

    const placeholder = await page
      .getByLabel("Your question")
      .getAttribute("placeholder");

    expect(placeholder).toBeTruthy();

    // Asked with NOTHING found, which is the state a new player is in.
    const answer = answerFor({
      question: placeholder!,
      found: { plants: {}, fungi: {} },
      quizPassed: {},
      unlockedParks: {},
      unlockedMapAreas: {},
      pollinator: { type: "bee", name: "Scout" },
      month: 7,
      hour: 12,
    });

    expect(answer.text, `the placeholder asks "${placeholder}"`).not.toBe(REFUSAL);
    expect(answer.id).not.toBe("ambiguous");
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
    /**
     * The whole game in the denominator, party species included, because the
     * journal's own counter reads "Found 0 / 43" and these are the same
     * question asked in two rooms.
     */
    await expect(progress).toHaveText(
      `${KNOWN_PLANTS.length} of ${PLANTS.length} flowers, and ${KNOWN_FUNGI.length} of ${FUNGI.length} fungi.`,
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

  test("it never says a flower is open in a month it does not bloom", () => {
    /**
     * `isActive` reads the clock and nothing else, so this used to answer
     * "Opens with the sun. It is open now" about a spring flower in July, one
     * question after the bloom answer had said it was out of season. The game
     * contradicting itself in two consecutive sentences is the night shift
     * bug in miniature, and it shipped that way once already.
     *
     * Driven over every plant rather than one, at a midday hour when the
     * daylight species genuinely are open, so the only thing that can produce
     * an "open now" is the season being ignored.
     */
    for (const plant of PLANTS) {
      const month = isInSeason(seasonWindow(plant.bloom), 7) ? 1 : 7;
      const answer = answerFor({
        ...empty,
        found: { plants: { [plant.id]: true }, fungi: {} },
        month,
        hour: 12,
        question: `when is ${plant.scientificName} open`,
      });

      expect(
        answer.text,
        `${plant.commonName} blooms ${plant.bloom} and was called open in month ${month}`,
      ).not.toContain("It is open now.");
      expect(answer.text).toContain("out of season");
    }
  });

  test("a deadly mushroom is not hedged at", () => {
    /**
     * The caveat used to be one line for all five edibilities, and it had
     * "though" in it: "Eastern Destroying Angel is deadly. I am a bee in a
     * game, though, so do not eat anything on my say so." "Though" signals
     * contrast, so it read as walking the danger back, on the one surface in
     * this game that says anything at all about eating.
     */
    for (const fungus of FUNGI) {
      const answer = answerFor({
        ...empty,
        found: { plants: {}, fungi: { [fungus.id]: true } },
        question: `can I eat ${fungus.scientificName}`,
      });

      expect(answer.id).toBe(`fungus:${fungus.id}`);
      expect(answer.text).toContain(EDIBILITY_LABEL[fungus.edibility].toLowerCase());

      if (fungus.edibility === "toxic" || fungus.edibility === "deadly") {
        expect(answer.text, `${fungus.commonName} is hedged at`).not.toContain("though");
        expect(answer.text).toContain("not a thing to be wrong about");
      }
    }
  });

  test("it does not answer what visits a fungus, because it does not know", () => {
    // `roleNote` is what the fungus DOES. Answering "what visits turkey tail"
    // with a paragraph about lignin is answering a different question well.
    const answer = answerFor({
      ...empty,
      found: { plants: {}, fungi: { "turkey-tail": true } },
      question: "what visits turkey tail",
    });

    expect(answer.text).toBe(REFUSAL);

    // Asked about generally it still says everything it knows.
    const general = answerFor({
      ...empty,
      found: { plants: {}, fungi: { "turkey-tail": true } },
      question: "tell me about turkey tail",
    });

    expect(general.text).toContain(FUNGI_BY_ID.get("turkey-tail")!.roleNote);
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

  test("a species met at a party counts in the display and not in the ladder", () => {
    /**
     * Both halves of the solo rule at once.
     *
     * A party species gates nothing, so it counts towards what the companion
     * says it knows and it will answer questions about it: refusing to discuss
     * a flower somebody has actually met would be strange, and undercounting it
     * would be a false line in player copy. But the park ladder must not move,
     * because a door that shifts under somebody over a feature they may never
     * have opened is worse than a locked one.
     */
    const party = PARTY_PLANTS.find((plant) =>
      plant.homes.some((home) => home.park === "frick"),
    );
    expect(party, "there is a party plant in Frick").toBeTruthy();

    const soloFrick = SOLO_PLANTS.filter((plant) =>
      plant.homes.some((home) => home.park === "frick"),
    ).slice(0, 3);

    const found = {
      plants: {
        ...Object.fromEntries(soloFrick.map((plant) => [plant.id, true])),
        [party!.id]: true,
      },
      fungi: {},
    };

    // Counted, and answerable.
    expect(vocabulary({ found, unlockedParks: {} }).plants).toBe(4);
    expect(
      answerFor({ ...empty, found, question: `tell me about ${party!.scientificName}` }).id,
    ).toBe(`plant:${party!.id}`);

    // And the ladder has not moved: three, not four.
    expect(
      answerFor({ ...empty, found, question: "how do I unlock schenley" }).text,
    ).toContain("You have 3.");
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

test.describe("two WebGL roots on one page", () => {
  test("the canvases survive going away and coming back", async ({ page }) => {
    /**
     * Pocket mounts a second GL root beside the preview's, and this repository
     * has a history with those: a synchronous unmount disposes the context an
     * immediate remount reuses, and the result is a transparent rectangle with
     * a broken image icon and no error anywhere. Client-side navigation is
     * exactly where it bites, so that is what this drives.
     */
    await page.addInitScript(() => {
      const seen = { created: 0, lost: 0 };
      (window as unknown as { __gl: typeof seen }).__gl = seen;
      const original = HTMLCanvasElement.prototype.getContext;

      HTMLCanvasElement.prototype.getContext = function (
        this: HTMLCanvasElement,
        ...args: Parameters<typeof original>
      ) {
        if (typeof args[0] === "string" && args[0].includes("webgl")) {
          seen.created += 1;
          this.addEventListener("webglcontextlost", () => {
            seen.lost += 1;
          });
        }

        return original.apply(this, args);
      } as typeof original;
    });

    await signIn(page.context());
    await page.goto("/pocket");
    await page.waitForTimeout(2500);

    const measure = () =>
      page.evaluate(() => ({
        count: document.querySelectorAll("canvas").length,
        bytes: [...document.querySelectorAll("canvas")].map(
          (canvas) => canvas.toDataURL("image/png").length,
        ),
        gl: (window as unknown as { __gl: { created: number; lost: number } }).__gl,
      }));

    const first = await measure();

    for (let trip = 0; trip < 4; trip += 1) {
      await page.getByRole("button", { name: "More" }).click();
      await page.getByRole("link", { name: "About" }).click();
      await page.waitForTimeout(400);
      await page.getByRole("button", { name: "More" }).click();
      await page.getByRole("link", { name: "Pocket" }).click();
      await page.waitForTimeout(1800);
    }

    const after = await measure();

    expect(after.count, "a canvas went missing").toBe(first.count);

    /**
     * Contexts must not ACCUMULATE, which is not the same as never being lost.
     * R3F's unmount calls `forceContextLoss`, so one lost per teardown is the
     * cleanup working. A leak looks like `created` climbing while `lost` stays
     * put, until the browser silently drops the oldest at about sixteen.
     */
    expect(
      after.gl.created - after.gl.lost,
      `${after.gl.created} created, ${after.gl.lost} released, ${after.count} on screen`,
    ).toBe(after.count);

    // And they are still DRAWING, which is the failure the old bug produced:
    // a canvas that is present, sized, and empty.
    for (let i = 0; i < first.bytes.length; i += 1) {
      expect(after.bytes[i], `canvas ${i} stopped drawing`).toBeGreaterThan(
        first.bytes[i] * 0.5,
      );
    }
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
