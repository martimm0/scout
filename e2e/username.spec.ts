import { expect, test } from "@playwright/test";

import { readFileSync } from "node:fs";

import { decode } from "next-auth/jwt";

import { resetProgress, signIn } from "./helpers";
import {
  USERNAME_MAX,
  USERNAME_MIN,
  usernameKey,
  usernameProblem,
} from "../src/lib/username";

/**
 * Register an account the way a real Google sign-in does.
 *
 * The suite mints session cookies directly, which is the right way to test the
 * signed-in paths, but it means no `accounts` row is ever created: in
 * production that happens in the Auth.js sign-in callback. Tests that need a
 * real account have to do the same thing that callback does, and calling the
 * same function is how they stay in step with it.
 *
 * This became necessary the moment claiming a username stopped creating rows of
 * its own, which it should never have done.
 */
async function registerAccount(userId: string, email: string) {
  const url = /^POSTGRES_URL=(.*)$/m
    .exec(readFileSync(".env.local", "utf8"))?.[1]
    ?.trim()
    .replace(/^["']|["']$/g, "");

  if (!url) {
    return false;
  }

  process.env.POSTGRES_URL = url;

  const { registerSignIn } = await import("../src/lib/accounts");

  await registerSignIn({ userId, email, name: email });

  return true;
}

/** The secret the running dev server is using, read the way the helpers do. */
function authSecret() {
  try {
    const match = /^AUTH_SECRET=(.*)$/m.exec(readFileSync(".env.local", "utf8"));

    if (match) {
      return match[1].trim().replace(/^["']|["']$/g, "");
    }
  } catch {
    // Local mode.
  }

  return "scout-local-mode-no-signin-possible";
}

/**
 * What the park calls you.
 *
 * The rules are checked as arithmetic first, because they are arithmetic, and
 * then through the route, because the route is the thing that actually decides.
 * A form is a courtesy to somebody typing; a disabled button is a suggestion.
 */

test.describe("what a username may be", () => {
  test("no spaces, and it says so rather than just refusing", () => {
    /**
     * Spaces get their own answer, checked BEFORE length. "a b" is a space
     * problem, not a length problem, and a form that reports the wrong rule
     * sends somebody off fixing the wrong thing. A trailing space is invisible
     * at the end of a word, which is exactly when this matters.
     */
    expect(usernameProblem("bee quiet")).toBe("has-spaces");
    expect(usernameProblem("a b")).toBe("has-spaces");
    expect(usernameProblem("bee\tquiet")).toBe("has-spaces");
    expect(usernameProblem("bee\nquiet")).toBe("has-spaces");
  });

  test("the length bounds are the ones the brief asked for", () => {
    expect(USERNAME_MAX).toBe(24);

    expect(usernameProblem("x".repeat(USERNAME_MAX))).toBeNull();
    expect(usernameProblem("x".repeat(USERNAME_MAX + 1))).toBe("too-long");
    expect(usernameProblem("x".repeat(USERNAME_MIN))).toBeNull();
    expect(usernameProblem("x")).toBe("too-short");
    expect(usernameProblem("")).toBe("empty");
  });

  test("letters from any language, but nothing that reads as markup", () => {
    // A name is a name. Refusing anything outside A-Z refuses people.
    expect(usernameProblem("bláithín")).toBeNull();
    expect(usernameProblem("пчела")).toBeNull();
    expect(usernameProblem("蜜蜂")).toBeNull();
    expect(usernameProblem("bee_quiet-99.2")).toBeNull();

    // And these would read as something else in a chat line.
    for (const bad of ["@bee", "#bee", "bee/quiet", "<b>bee</b>", "bee!"]) {
      expect(usernameProblem(bad), `${bad} was allowed`).toBe("bad-characters");
    }
  });

  test("uniqueness is case-insensitive, but the case you chose is kept", () => {
    /**
     * "Bee" and "bee" are the same person as far as telling two players apart
     * goes, so allowing both would make the distinction a trap. What is stored
     * and shown is what you typed, because how you write your own name is
     * yours.
     */
    expect(usernameKey("Bee")).toBe(usernameKey("bee"));
    expect(usernameKey("  BeeQuiet  ")).toBe("beequiet");
  });
});

test.describe("claiming a name", () => {
  test("the route refuses what the form would refuse, and then some", async ({
    page,
  }) => {
    /**
     * Asked of the ROUTE, with the form nowhere in it. The form can be skipped
     * by anybody with a terminal, so the rules have to hold here or they do not
     * hold at all.
     */
    await signIn(page.context(), "username-player", "u@example.com");
    await page.goto("/");
    await resetProgress(page);

    const post = (username: unknown) =>
      page.request.post("/api/username", { data: { username } });

    for (const bad of [
      "bee quiet",
      "x",
      "x".repeat(USERNAME_MAX + 1),
      "@bee",
      "",
    ]) {
      const response = await post(bad);

      expect(
        response.status(),
        `the route accepted ${JSON.stringify(bad)}`,
      ).toBe(400);
    }

    // Not a string at all.
    expect((await post(42)).status()).toBe(400);
    expect((await post(null)).status()).toBe(400);
  });

  test("a signed-out stranger cannot claim anything", async ({ page }) => {
    await page.goto("/");

    const response = await page.request.post("/api/username", {
      data: { username: "stranger" },
    });

    expect(
      response.status(),
      "a name was claimed with no account behind it",
    ).toBe(401);
  });

  test("two people cannot have the same name, whatever the case", async ({
    browser,
  }) => {
    /**
     * The uniqueness rule, asked of the DATABASE.
     *
     * Not by looking first and then writing: two people typing the same name at
     * the same moment both pass a SELECT and both proceed. Only a constraint can
     * actually decide between them, so `setUsername` writes and catches the
     * violation, and this is the test that the catch is real.
     *
     * Skipped rather than faked without a database, and SAID rather than
     * silently passing, because a green tick that checked nothing is worse than
     * an honest skip.
     */
    const wanted = `bee${Date.now().toString(36)}`;

    const claim = async (who: string, name: string) => {
      // The account has to exist before a name can be attached to it.
      await registerAccount(who, `${who}@example.com`);

      const context = await browser.newContext();

      await signIn(context, who, `${who}@example.com`);

      const page = await context.newPage();

      await page.goto("/");

      const response = await page.request.post("/api/username", {
        data: { username: name },
      });
      const status = response.status();

      await context.close();

      return status;
    };

    const first = await claim("uniq-one", wanted);

    test.skip(
      first === 501,
      "no database configured, so uniqueness cannot be tested",
    );

    expect(first, "the first claim was refused").toBe(200);

    // The same name, different case, different person.
    expect(
      await claim("uniq-two", wanted.toUpperCase()),
      "two accounts were allowed the same name in different cases",
    ).toBe(409);

    // And the same person can re-claim their own without colliding with
    // themselves, which an ON CONFLICT on the wrong column would break.
    expect(
      await claim("uniq-one", wanted),
      "somebody could not keep their own name",
    ).toBe(200);
  });

  test("the party ticket carries the chosen name, never the Google one", async ({
    page,
  }) => {
    /**
     * The whole reason usernames exist.
     *
     * The ticket is what the room puts on your chat lines and over your bee, and
     * it used to carry `session.user.name`, which is whatever Google has on
     * file. Signing in put a person's legal name in a chat window next to
     * strangers. This decodes the real ticket and checks what is actually in it.
     */
    const googleName = "Ada Countess Lovelace";

    await registerAccount("ticket-player", "tp@example.com");
    await signIn(page.context(), "ticket-player", "tp@example.com", googleName);
    await page.goto("/");

    const chosen = `ada${Date.now().toString(36)}`;
    const claimed = await page.request.post("/api/username", {
      data: { username: chosen },
    });

    test.skip(
      claimed.status() === 501,
      "no database configured, so a username cannot be stored",
    );
    expect(claimed.status()).toBe(200);

    const response = await page.request.get("/api/party/ticket");

    expect(response.ok()).toBe(true);

    const { ticket } = (await response.json()) as { ticket: string };
    const inside = await decode({
      token: ticket,
      secret: authSecret(),
      salt: "scout-party-ticket",
    });

    expect(inside?.name, "the ticket does not carry the chosen name").toBe(
      chosen,
    );
    expect(
      inside?.name,
      "the ticket leaks the name from the Google account",
    ).not.toBe(googleName);
  });

  test("a deleted account cannot put itself back with a username", async ({
    page,
  }) => {
    /**
     * Claiming a name must never CREATE an account row.
     *
     * `registerSignIn` owns account creation, because that is where the ceiling,
     * the waitlist and the suspension check live. This used to upsert, so a
     * player whose account an admin had just deleted — still holding a valid JWT
     * for its lifetime — could post a username and put a row back, walking round
     * the ceiling and partly undoing the deletion.
     */
    /**
     * A user id that has never existed, fresh every run.
     *
     * A fixed id made this test depend on the absence of a row, which is a
     * thing any earlier run can quietly create. It did: proving this bug by
     * reverting the fix left exactly the row the test needs to be missing, and
     * the test then failed for the right reason at the wrong time.
     */
    const ghost = `ghost-${Date.now().toString(36)}`;

    await signIn(page.context(), ghost, `${ghost}@example.com`);
    await page.goto("/");

    const response = await page.request.post("/api/username", {
      data: { username: `g${Date.now().toString(36)}` },
    });

    test.skip(
      response.status() === 501,
      "no database configured, so there are no account rows",
    );

    expect(
      response.status(),
      "a session with no account row created one by claiming a name",
    ).toBe(403);
  });

  test("the prompt appears for somebody who has not chosen", async ({
    page,
  }) => {
    /**
     * One null, one prompt. There is no separate "has been asked" flag: an
     * account made before usernames existed and an account made a moment ago
     * both have no username, which is the same question and gets the same
     * dialog. A flag would be a second thing that can disagree with the first.
     */
    await signIn(page.context(), "no-name-yet", "nn@example.com");
    await page.goto("/about");

    const dialog = page.getByRole("dialog", {
      name: /What should the park call you/,
    });

    await expect(dialog).toBeVisible({ timeout: 20_000 });

    // It must NOT be a wall. Somebody who came to look at flowers should be
    // able to go and look at flowers.
    await dialog.getByRole("button", { name: "Later" }).click();
    await expect(dialog).toHaveCount(0);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });

  test("the prompt blocks nothing on the page behind it", async ({ page }) => {
    /**
     * The assertion that would have saved ten tests and four pages.
     *
     * This began as a full-screen scrim, which eats every click beneath it. A
     * signed-in player who had not picked a name could not press Join on the
     * party lobby, could not take a photograph, and could not change their bee.
     * Nothing about it LOOKED wrong; the button simply did nothing.
     *
     * So the test is not "the prompt appears", which was always true. It is
     * that something behind it still works while it is up.
     */
    await signIn(page.context(), "not-blocked", "nb@example.com");
    await page.goto("/parties");

    const prompt = page.getByRole("dialog", {
      name: /What should the park call you/,
    });

    await expect(prompt).toBeVisible({ timeout: 20_000 });

    // The nav is behind it, and has to still take a click.
    await page.getByRole("button", { name: "More" }).click();
    await expect(
      page.getByRole("button", { name: "More" }),
      "the prompt swallowed a click meant for the page",
    ).toHaveAttribute("aria-expanded", "true");

    /**
     * And it must not COVER anything either, which is a different failure.
     *
     * A card pinned bottom-right blocked nothing in the pointer-events sense
     * and still sat physically on top of Highland's Join button, because
     * Highland is the rightmost of three cards. The tests that clicked Frick,
     * on the left, passed happily. So this checks every join button against the
     * prompt's own rectangle rather than trusting one of them.
     */
    const promptBox = (await prompt.boundingBox())!;
    const joins = page.getByRole("button", { name: /Join the/ });

    for (let i = 0; i < (await joins.count()); i += 1) {
      const box = (await joins.nth(i).boundingBox())!;
      const overlaps =
        box.x < promptBox.x + promptBox.width &&
        box.x + box.width > promptBox.x &&
        box.y < promptBox.y + promptBox.height &&
        box.y + box.height > promptBox.y;

      expect(
        overlaps,
        `the prompt is sitting on top of join button ${i + 1}`,
      ).toBe(false);
    }

    // Every one of them still takes a real click.
    for (let i = 0; i < (await joins.count()); i += 1) {
      await joins.nth(i).click({ trial: true, timeout: 5_000 });
    }

    // And the prompt is still there, because dismissing is a choice rather
    // than something that happens by accident.
    await expect(prompt).toBeVisible();
  });

  test("the form says which rule was broken, not merely no", async ({
    page,
  }) => {
    await signIn(page.context(), "rule-reader", "rr@example.com");
    await page.goto("/about");

    const dialog = page.getByRole("dialog", {
      name: /What should the park call you/,
    });

    await expect(dialog).toBeVisible({ timeout: 20_000 });

    const input = dialog.getByLabel("Username");

    await input.fill("bee quiet");
    await expect(dialog.getByText(/No spaces/)).toBeVisible();

    await input.fill("x".repeat(USERNAME_MAX + 5));
    // maxLength stops it growing past the limit, so the box holds 24 and the
    // hint goes back to being a hint rather than a complaint.
    await expect(input).toHaveValue("x".repeat(USERNAME_MAX));

    await input.fill("@bee");
    await expect(dialog.getByText(/Letters, numbers/)).toBeVisible();

    await input.fill("beequiet");
    await expect(
      dialog.getByRole("button", { name: "That is me" }),
    ).toBeEnabled();
  });
});
