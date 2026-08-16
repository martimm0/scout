import { expect, test } from "@playwright/test";

import { env } from "../src/lib/env";
import { mondayOf } from "../src/lib/insights";

import { registerAccount, signIn } from "./helpers";

/**
 * The admin tool.
 *
 * The whole point of it is that it is one person's, so the test that matters is
 * the door: a stranger and a signed-in non-admin both get a 404 (the tool does
 * not announce itself), and only the admin email is let in. The gate is the
 * session email, minted the same way Auth.js would issue it.
 */

/**
 * Read from the same place the app reads it, rather than written out twice.
 * A test that hard-codes the admin address goes on passing after somebody
 * changes who the admin is, which is the one thing this file exists to check.
 */
const ADMIN = env.adminEmail;

test.describe("the admin tool is the admin's alone", () => {
  test("a signed-out stranger sees no dashboard, and the API is 404", async ({
    page,
  }) => {
    await page.goto("/admin");
    // The dashboard does not render for a stranger; the page shows not-found.
    await expect(
      page.getByRole("heading", { name: "Account ceiling" }),
    ).toHaveCount(0);

    // The data behind it is properly refused.
    const api = await page.request.get("/api/admin");
    expect(api.status()).toBe(404);
  });

  test("a signed-in non-admin also gets nothing", async ({ page }) => {
    await signIn(page.context(), "not-the-admin", "someone-else@example.com");

    await page.goto("/admin");
    await expect(
      page.getByRole("heading", { name: "Account ceiling" }),
    ).toHaveCount(0);

    const api = await page.request.get("/api/admin");
    expect(api.status()).toBe(404);
  });

  test("the admin sees the dashboard and the analytics", async ({ page }) => {
    await signIn(page.context(), "the-admin", ADMIN);

    await page.goto("/admin");
    await expect(
      page.getByRole("heading", { level: 1, name: "Admin" }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Account ceiling" }),
    ).toBeVisible();

    const api = await page.request.get("/api/admin");
    expect(api.status()).toBe(200);
    const body = (await api.json()) as {
      analytics: { ceiling: number };
      accounts: unknown[];
      waitlist: unknown[];
    };
    expect(typeof body.analytics.ceiling).toBe("number");
    expect(Array.isArray(body.accounts)).toBe(true);
    expect(Array.isArray(body.waitlist)).toBe(true);
  });

  test("the admin can set the account ceiling", async ({ page }) => {
    await signIn(page.context(), "the-admin", ADMIN);

    const set = await page.request.post("/api/admin", {
      data: { action: "setCeiling", ceiling: 250 },
    });
    expect(set.status()).toBe(200);
    expect(((await set.json()) as { analytics: { ceiling: number } }).analytics.ceiling).toBe(250);

    // Put it back to the shipped default so the shared database is left as found.
    const reset = await page.request.post("/api/admin", {
      data: { action: "setCeiling", ceiling: 100 },
    });
    expect(((await reset.json()) as { analytics: { ceiling: number } }).analytics.ceiling).toBe(100);
  });

  /**
   * A ceiling that will not parse has to be refused, not stored.
   *
   * `Math.floor(NaN)` is NaN and `String(NaN)` is "NaN", so a bad value went into
   * the settings row without complaint. The read side cannot parse "NaN" either,
   * falls back to the shipped default, and the door policy silently becomes a
   * hundred again: seats an admin had deliberately closed, quietly reopened. The
   * failure mode was a success response and a wrong number.
   */
  test("a ceiling that is not a number is refused, and the old one stands", async ({
    page,
  }) => {
    await signIn(page.context(), "the-admin", ADMIN);

    const ceilingNow = async () => {
      const api = await page.request.get("/api/admin");

      return ((await api.json()) as { analytics: { ceiling: number } }).analytics
        .ceiling;
    };

    const set = await page.request.post("/api/admin", {
      data: { action: "setCeiling", ceiling: 250 },
    });
    expect(set.status()).toBe(200);
    expect(await ceilingNow()).toBe(250);

    // `Number` would have made a fine zero out of most of these, and a ceiling of
    // zero shuts the door on every new account.
    for (const nonsense of ["abc", "", null, {}, [], false]) {
      const bad = await page.request.post("/api/admin", {
        data: { action: "setCeiling", ceiling: nonsense },
      });

      expect(bad.status(), `ceiling ${JSON.stringify(nonsense)} was accepted`).toBe(
        400,
      );
      expect(
        await ceilingNow(),
        `ceiling ${JSON.stringify(nonsense)} changed the ceiling`,
      ).toBe(250);
    }

    // Leave the shared database as found.
    await page.request.post("/api/admin", {
      data: { action: "setCeiling", ceiling: 100 },
    });
  });
});

test.describe("the admin can act on players", () => {
  /**
   * Every one of these is asked of the API, not the page.
   *
   * The dashboard hides controls from a non-admin, and hiding is not a gate: a
   * stranger with a terminal never sees the page at all. What has to hold is
   * that the ROUTE refuses them.
   */
  test("a non-admin cannot use any of the player actions", async ({ page }) => {
    await signIn(page.context(), "not-admin", "someone@example.com");
    await page.goto("/");

    for (const body of [
      { action: "setUsername", userId: "anyone", username: "taken" },
      { action: "resetProgress", userId: "anyone" },
      { action: "delete", userId: "anyone" },
      { action: "suspend", userId: "anyone" },
      { action: "setCeiling", ceiling: 9999 },
    ]) {
      const response = await page.request.post("/api/admin", { data: body });

      expect(
        response.status(),
        `${body.action} was allowed for a non-admin`,
      ).toBe(404);
    }
  });

  test("the admin can set and clear a player's username", async ({
    browser,
  }) => {
    // A real player to act on, with a name of their own choosing first.
    const player = await browser.newContext();

    // The account first. Claiming a name is UPDATE-only, so without a row this
    // answers 403 and the test never reaches what it came to check.
    await registerAccount("target-player", "target@example.com");
    await signIn(player, "target-player", "target@example.com");

    const playerPage = await player.newPage();

    await playerPage.goto("/");

    const wanted = `tgt${Date.now().toString(36)}`;
    const claimed = await playerPage.request.post("/api/username", {
      data: { username: wanted },
    });

    test.skip(
      claimed.status() === 501,
      "no database configured, so usernames cannot be tested",
    );
    expect(claimed.status()).toBe(200);

    const admin = await browser.newContext();

    await signIn(admin, "the-admin", ADMIN);

    const adminPage = await admin.newPage();

    await adminPage.goto("/");

    const find = async () => {
      const data = (await (
        await adminPage.request.get("/api/admin")
      ).json()) as { accounts: { userId: string; username: string | null }[] };

      return data.accounts.find((a) => a.userId === "target-player");
    };

    expect((await find())?.username).toBe(wanted);

    // The admin renames them, and the rules still apply: an admin who could set
    // a name the rules forbid could break the chat for everybody else.
    const bad = await adminPage.request.post("/api/admin", {
      data: {
        action: "setUsername",
        userId: "target-player",
        username: "has spaces",
      },
    });

    expect(bad.status(), "the admin bypassed the username rules").toBe(400);
    expect((await find())?.username, "the bad name was stored").toBe(wanted);

    // And clearing it hands the name back, which is the only way to free one.
    const cleared = await adminPage.request.post("/api/admin", {
      data: { action: "setUsername", userId: "target-player", username: "" },
    });

    expect(cleared.ok()).toBe(true);
    expect(
      (await find())?.username,
      "clearing a username did not clear it",
    ).toBeNull();

    await player.close();
    await admin.close();
  });

  test("the admin still cannot suspend or delete themselves", async ({
    page,
  }) => {
    /**
     * The existing guard, re-checked because the actions around it changed. A
     * locked-out owner has no way back in, so this refuses rather than allows.
     */
    await signIn(page.context(), "the-admin", ADMIN);
    await page.goto("/admin");

    const data = (await (await page.request.get("/api/admin")).json()) as {
      accounts: { userId: string; email: string | null }[];
    };
    const self = data.accounts.find(
      (a) => (a.email ?? "").toLowerCase() === ADMIN,
    );

    test.skip(!self, "no database configured, so there is no admin row");

    for (const action of ["suspend", "delete"]) {
      const response = await page.request.post("/api/admin", {
        data: { action, userId: self!.userId },
      });

      expect(
        response.status(),
        `the admin could ${action} themselves out of the tool`,
      ).toBe(400);
    }
  });
});

test.describe("the numbers the admin reads", () => {
  /**
   * Arithmetic, asked as arithmetic.
   *
   * The chart itself is a row of bars, and a bar being present says nothing
   * about whether it is over the right week. This is the part that decides
   * that, so this is the part that gets asked.
   */

  test("a week starts on Monday, and the same week is one bar", () => {
    /**
     * The bug this exists for: the Monday was worked out in LOCAL time and then
     * formatted with `toISOString`, which formats in UTC. In any timezone west
     * of Greenwich the label came out a day late, so the "weekly" buckets were
     * Tuesdays, and two accounts created in the same week either side of
     * midnight were counted as two separate weeks.
     *
     * Run under a deliberately awkward timezone, because under UTC the broken
     * version passed perfectly and that is exactly how it survived review.
     */
    const monday = "2026-08-03";

    // Every hour of every day of one week, and it is one answer.
    for (const day of [3, 4, 5, 6, 7, 8, 9]) {
      for (const hour of [0, 4, 12, 20, 23]) {
        const at = `2026-08-${String(day).padStart(2, "0")}T${String(hour).padStart(2, "0")}:30:00Z`;

        expect(mondayOf(at), `${at} was filed under the wrong week`).toBe(
          monday,
        );
      }
    }

    // And the days either side belong to the weeks either side.
    expect(mondayOf("2026-08-02T23:59:59Z"), "Sunday joined the week ahead").toBe(
      "2026-07-27",
    );
    expect(mondayOf("2026-08-10T00:00:00Z"), "Monday joined the week behind").toBe(
      "2026-08-10",
    );
  });

  test("every bucket it produces is genuinely a Monday", () => {
    // The label is a promise about what the bar means. Checked across a year so
    // a month boundary or a leap day cannot quietly break it.
    for (let day = 0; day < 370; day += 1) {
      const at = new Date(Date.UTC(2026, 0, 1) + day * 86_400_000);
      const bucket = new Date(`${mondayOf(at)}T00:00:00Z`);

      expect(
        bucket.getUTCDay(),
        `${at.toISOString()} bucketed to ${mondayOf(at)}, which is not a Monday`,
      ).toBe(1);

      // And never in the future relative to the day it came from.
      expect(bucket.getTime()).toBeLessThanOrEqual(at.getTime());
      expect(at.getTime() - bucket.getTime()).toBeLessThan(7 * 86_400_000);
    }
  });
});

test.describe("the admin table tells the truth about itself", () => {
  test("a refused username snaps back to what is actually stored", async ({
    browser,
  }) => {
    /**
     * Asked of the PAGE, unlike everything else here, because the bug was only
     * ever on the page.
     *
     * The username cells are uncontrolled inputs, so `defaultValue` is read
     * once and every render after that leaves the box alone. When the server
     * accepted the change that was invisible; when it refused one, the cell sat
     * there holding a name that had not been saved, next to an error message
     * about a different row, looking exactly like a name that had been. An
     * admin tool that shows something other than the database is worse than no
     * admin tool, because the wrong answer is the one you act on.
     */
    const player = await browser.newContext();

    await registerAccount("snapback-player", "snapback@example.com");
    await signIn(player, "snapback-player", "snapback@example.com");

    const playerPage = await player.newPage();

    await playerPage.goto("/");

    const wanted = `snap${Date.now().toString(36)}`;
    const claimed = await playerPage.request.post("/api/username", {
      data: { username: wanted },
    });

    test.skip(
      claimed.status() === 501,
      "no database configured, so usernames cannot be tested",
    );
    expect(claimed.status()).toBe(200);

    const admin = await browser.newContext();

    await signIn(admin, "the-admin", ADMIN);

    const adminPage = await admin.newPage();

    await adminPage.goto("/admin");

    const cell = adminPage.getByLabel("Username for account snapback-player");

    await expect(cell).toHaveValue(wanted);

    // A name the rules forbid, committed the way the admin commits one: by
    // typing it and clicking away.
    await cell.fill("not a name");
    await cell.blur();

    /**
     * Scoped by its text, not just by its role.
     *
     * Next renders its own route announcer as `<div role="alert">`, so a bare
     * `getByRole("alert")` matches two elements and trips strict mode. It
     * happened to resolve in Chromium and failed in Firefox, which is the worst
     * kind of test bug: browser-dependent, and nothing to do with the thing
     * under test.
     */
    await expect(
      adminPage.getByRole("alert").filter({ hasText: /\w/ }),
      "the refusal was never reported",
    ).toBeVisible();

    await expect(
      adminPage.getByLabel("Username for account snapback-player"),
      "the cell kept a name the database refused",
    ).toHaveValue(wanted);

    // And the database agrees, which is the point of the snap-back.
    const data = (await (await adminPage.request.get("/api/admin")).json()) as {
      accounts: { userId: string; username: string | null }[];
    };

    expect(
      data.accounts.find((a) => a.userId === "snapback-player")?.username,
    ).toBe(wanted);

    await player.close();
    await admin.close();
  });
});
