import { expect, test, type Page } from "@playwright/test";

import { env } from "../src/lib/env";
import { registerAccount, signIn } from "./helpers";

/**
 * One account, its server copy, and every device that holds a copy of it.
 *
 * Asserted through the server's row and the device's localStorage, which are
 * the two places a player's progress actually lives.
 */

const KEY = "scout-game-state";

async function leaveOnDevice(page: Page, state: Record<string, unknown>) {
  await page.goto("/about");
  await page.evaluate(
    ([key, value]) =>
      window.localStorage.setItem(key, JSON.stringify({ version: 0, state: value })),
    [KEY, state] as const,
  );
}

async function serverPlants(page: Page) {
  const response = await page.request.get("/api/progress");
  const body = (await response.json()) as {
    progress: { discoveredPlants?: Record<string, boolean> } | null;
  };

  return Object.entries(body.progress?.discoveredPlants ?? {})
    .filter(([, on]) => on)
    .map(([id]) => id)
    .sort();
}

async function devicePlants(page: Page) {
  return page.evaluate((key) => {
    const raw = window.localStorage.getItem(key);
    const plants = raw ? JSON.parse(raw).state.discoveredPlants ?? {} : {};

    return Object.keys(plants).filter((id) => plants[id]).sort();
  }, KEY);
}

test.describe("the server copy is the sum of every device", () => {
  test("a pull that failed once is tried again, so the session still saves", async ({
    page,
  }) => {
    /**
     * Pushes wait for the sign-in pull to merge, so a stale device cannot push
     * over the account. But the pull was made exactly once: if it failed, the
     * page sat unreconciled for the rest of the session, saving nothing to the
     * account however long the player flew.
     */
    const ok = await registerAccount("sync-retry-player", "sync-retry@example.com");
    test.skip(!ok, "no database configured");

    await signIn(page.context(), "sync-retry-player", "sync-retry@example.com");
    expect(
      (
        await page.request.post("/api/progress", {
          data: { discoveredPlants: { "wild-geranium": true } },
        })
      ).status(),
    ).toBe(200);

    // This device found something the server has not heard about.
    await leaveOnDevice(page, {
      owner: "sync-retry-player",
      discoveredPlants: { "wild-geranium": true, "common-milkweed": true },
    });

    let failed = false;
    await page.route("**/api/progress", async (route) => {
      if (route.request().method() === "GET" && !failed) {
        failed = true;
        await route.fulfill({ status: 500, body: "{}" });

        return;
      }

      await route.continue();
    });

    await page.goto("/customize");

    /**
     * Polled, not slept. A fixed twelve seconds covers the failed pull, the
     * two-second wait, the second pull, the merge and the debounced push with
     * room to spare on its own, and not always under a full parallel run in
     * WebKit. Without the retry nothing is ever pushed, so a generous ceiling
     * costs a failing run time and cannot let one pass.
     */
    await expect
      .poll(() => serverPlants(page), {
        message: "one failed pull switched saving off for the whole session",
        timeout: 40_000,
        intervals: [1000],
      })
      .toEqual(["common-milkweed", "wild-geranium"]);

    expect(failed, "the pull was never made, so nothing was tested").toBe(true);
    await page.unroute("**/api/progress");
  });

  test("two devices open at once do not erase each other's finds", async ({
    page,
  }) => {
    /**
     * A save replaced the whole row. So a device that had been open since
     * before another one found something would, on its next save (any change,
     * or simply being put in a pocket, which fires the hide beacon), write its
     * older copy over the account, and the find made elsewhere was gone from
     * every device that had not seen it yet.
     */
    const ok = await registerAccount("sync-two-player", "sync-two@example.com");
    test.skip(!ok, "no database configured");

    await signIn(page.context(), "sync-two-player", "sync-two@example.com");
    expect(
      (
        await page.request.post("/api/progress", {
          data: { discoveredPlants: { "wild-geranium": true } },
        })
      ).status(),
    ).toBe(200);

    // The phone: open, reconciled, and from here on behind.
    await leaveOnDevice(page, {
      owner: "sync-two-player",
      discoveredPlants: { "wild-geranium": true },
    });
    await page.goto("/customize");
    await page.waitForTimeout(5000);

    // The laptop finds a plant and saves it.
    expect(
      (
        await page.request.post("/api/progress", {
          data: {
            owner: "sync-two-player",
            discoveredPlants: { "wild-geranium": true, mayapple: true },
          },
        })
      ).status(),
    ).toBe(200);

    // The phone changes its bee, and saves what it has.
    await page.getByRole("button", { name: /Butterfly/ }).first().click();
    await page.waitForTimeout(4000);

    expect(
      await serverPlants(page),
      "the phone's older copy replaced the laptop's find",
    ).toEqual(["mayapple", "wild-geranium"]);
  });

  test("merging cannot grow a row past the ceiling", async ({ page }) => {
    /**
     * The ceiling was checked on the request, which was enough while a save
     * replaced the row: no row could be bigger than one request. A merged row
     * is the union of every request, so two saves each under the ceiling,
     * with different junk in them, made a row twice its size, and a third made
     * it three times. The ceiling is on what is stored now.
     */
    const ok = await registerAccount("sync-ceiling-player", "sync-ceiling@example.com");
    test.skip(!ok, "no database configured");

    await signIn(page.context(), "sync-ceiling-player", "sync-ceiling@example.com");

    const padded = (prefix: string) => ({
      discoveredPlants: Object.fromEntries(
        Array.from({ length: 7000 }, (_, i) => [`${prefix}-padding-${i}`, true]),
      ),
    });

    expect((await page.request.post("/api/progress", { data: padded("a") })).status()).toBe(200);

    const second = await page.request.post("/api/progress", { data: padded("b") });

    expect(second.status(), "the merged row went over the ceiling").toBe(413);

    const plants = await serverPlants(page);

    expect(plants).toContain("a-padding-0");
    expect(plants).not.toContain("b-padding-0");
  });

  test("a reset the admin made sticks on a device that still holds the save", async ({
    page,
    browser,
  }) => {
    /**
     * The admin's reset is for a player who asks to start again. It deleted the
     * server row and nothing else, so the player's own device, which still held
     * the whole save, found an empty account on its next sign-in, adopted its
     * local copy, and pushed every plant straight back. The admin was told it
     * was done and the player saw nothing change.
     */
    const ok = await registerAccount("sync-reset-player", "sync-reset@example.com");
    test.skip(!ok, "no database configured");

    await signIn(page.context(), "sync-reset-player", "sync-reset@example.com");
    await leaveOnDevice(page, {
      owner: "sync-reset-player",
      discoveredPlants: { "wild-geranium": true, "common-milkweed": true },
    });
    await page.goto("/customize");
    await page.waitForTimeout(5000);
    expect(await serverPlants(page)).toEqual(["common-milkweed", "wild-geranium"]);

    const admin = await browser.newContext();
    await signIn(admin, "the-admin", env.adminEmail);
    const reset = await admin.request.post("/api/admin", {
      data: { action: "resetProgress", userId: "sync-reset-player" },
    });
    expect(reset.status()).toBe(200);
    await admin.close();

    // A tab left open since before the reset still holds the old save, and
    // saves it, as its own. Merged in, it would undo the reset on the server
    // before the device ever reloaded.
    const stale = await page.request.post("/api/progress", {
      data: {
        owner: "sync-reset-player",
        discoveredPlants: { "wild-geranium": true, "common-milkweed": true },
      },
    });
    expect(stale.status(), "a save from before the reset was accepted").toBe(409);
    expect(await serverPlants(page)).toEqual([]);

    // The player comes back on the same device.
    await page.goto("/customize");
    await page.waitForTimeout(5000);

    expect(await serverPlants(page), "the device pushed the reset save back").toEqual([]);
    expect(await devicePlants(page), "the device still shows the old save").toEqual([]);
  });
});
