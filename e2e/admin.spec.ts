import { expect, test } from "@playwright/test";

import { signIn } from "./helpers";

/**
 * The admin tool.
 *
 * The whole point of it is that it is one person's, so the test that matters is
 * the door: a stranger and a signed-in non-admin both get a 404 (the tool does
 * not announce itself), and only the admin email is let in. The gate is the
 * session email, minted the same way Auth.js would issue it.
 */

const ADMIN = "miles@relai.us";

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
