import { expect, test, type Page } from "@playwright/test";

import { registerAccount, signIn } from "./helpers";

/**
 * Two people, one browser.
 *
 * The local save is a single localStorage key with no idea whose it is, and
 * signing out only drops the session cookie, so the previous player's progress
 * stays on the device. On sign-in, cloud sync unions the local save into the
 * account and pushes the result. That union exists so the SAME player keeps
 * progress they made on this device that never reached the server. It could not
 * tell that apart from somebody else's progress left behind, so on a shared
 * computer, which for a game about the city's parks means a school lab or a
 * library, the next account to sign in absorbed every plant, quiz and badge the
 * last one had found, permanently, on the server.
 */

const KEY = "scout-game-state";

/** Write a save once, as the device would hold it after somebody played. */
async function leaveOnDevice(page: Page, state: Record<string, unknown>) {
  await page.goto("/about");
  await page.evaluate(
    ([key, value]) => window.localStorage.setItem(key, JSON.stringify({ version: 0, state: value })),
    [KEY, state] as const,
  );
}

async function serverPlants(page: Page) {
  const response = await page.request.get("/api/progress");
  const body = (await response.json()) as {
    progress: { discoveredPlants?: Record<string, boolean> } | null;
  };

  return Object.keys(body.progress?.discoveredPlants ?? {}).filter(
    (id) => body.progress?.discoveredPlants?.[id],
  );
}

/** Long enough for the pull, the union, and the debounced push after it. */
async function letSyncRun(page: Page) {
  await page.goto("/customize");
  await page.waitForTimeout(5000);
}

test.describe("a shared device does not merge one account into another", () => {
  test("the next player to sign in does not inherit the last one's progress", async ({
    page,
  }) => {
    const ok =
      (await registerAccount("device-player-a", "device-a@example.com")) &&
      (await registerAccount("device-player-b", "device-b@example.com"));
    test.skip(!ok, "no database configured, so there is no server copy to protect");

    // B already has a server save from some other device: one plant.
    await signIn(page.context(), "device-player-b", "device-b@example.com");
    const seeded = await page.request.post("/api/progress", {
      data: { discoveredPlants: { "wild-geranium": true } },
    });
    expect(seeded.status()).toBe(200);

    // A plays on THIS browser, signed in as A, so A's progress is on the device.
    await page.context().clearCookies();
    await signIn(page.context(), "device-player-a", "device-a@example.com");
    await leaveOnDevice(page, {
      discoveredPlants: {
        "common-milkweed": true,
        "wild-bergamot": true,
        "canada-goldenrod": true,
      },
    });
    await letSyncRun(page);

    // A signs out, which drops the cookie and nothing else, and B signs in.
    await page.context().clearCookies();
    await signIn(page.context(), "device-player-b", "device-b@example.com");
    await letSyncRun(page);

    const plants = await serverPlants(page);

    expect(plants, "B lost their own plant").toContain("wild-geranium");
    expect(
      plants.filter((id) => id !== "wild-geranium"),
      "B's account absorbed the previous player's discoveries",
    ).toEqual([]);
  });

  test("the route refuses a save that says it is somebody else's", async ({ page }) => {
    /**
     * The check that does not depend on the client. A tab left open on a shared
     * computer still holds the last player's save in memory; if it sends that
     * with the cookie of whoever signed in since, the save declares one owner and
     * the session says another. It used to land, and replace the row.
     */
    const ok = await registerAccount("device-player-d", "device-d@example.com");
    test.skip(!ok, "no database configured");

    await signIn(page.context(), "device-player-d", "device-d@example.com");
    expect(
      (
        await page.request.post("/api/progress", {
          data: { discoveredPlants: { "wild-geranium": true } },
        })
      ).status(),
    ).toBe(200);

    const foreign = await page.request.post("/api/progress", {
      data: {
        owner: "somebody-else-entirely",
        discoveredPlants: { "common-milkweed": true },
      },
    });

    expect(foreign.status()).toBe(409);
    expect(await serverPlants(page), "the foreign save landed anyway").toEqual(["wild-geranium"]);

    // And the account's own declared save still goes through.
    const own = await page.request.post("/api/progress", {
      data: { owner: "device-player-d", discoveredPlants: { "wild-geranium": true, "mayapple": true } },
    });

    expect(own.status()).toBe(200);
  });

  test("a stale device does not push over another device's progress", async ({
    page,
  }) => {
    /**
     * One player, two devices. This one's local save is behind: the server has
     * a plant found elsewhere since. Autosave used to start the moment the page
     * mounted, before the sign-in pull had merged anything, so a change made
     * while that pull was still in flight pushed the stale save, the route
     * replaced the row, and the other device's find was gone by the time the
     * pull came back with nothing to merge.
     *
     * The race needs a slow pull to show itself, so the GET is held for four
     * seconds, well past the 1.5 second autosave debounce.
     */
    const ok = await registerAccount("device-player-e", "device-e@example.com");
    test.skip(!ok, "no database configured");

    await signIn(page.context(), "device-player-e", "device-e@example.com");

    // The server knows two plants, one of them from another device.
    expect(
      (
        await page.request.post("/api/progress", {
          data: { discoveredPlants: { "wild-geranium": true, mayapple: true } },
        })
      ).status(),
    ).toBe(200);

    // This device is the player's own, claimed, but behind: it knows one.
    await leaveOnDevice(page, {
      owner: "device-player-e",
      discoveredPlants: { "wild-geranium": true },
    });

    await page.route("**/api/progress", async (route) => {
      if (route.request().method() === "GET") {
        await new Promise((resolve) => setTimeout(resolve, 4000));
      }

      await route.continue();
    });

    await page.goto("/customize");
    // A change while the pull is still out: exactly what used to trigger the push.
    await page.waitForTimeout(500);
    await page.getByRole("button", { name: /Butterfly/ }).first().click();
    await page.waitForTimeout(7000);

    await page.unroute("**/api/progress");

    expect(
      await serverPlants(page),
      "the stale device pushed over the find made elsewhere",
    ).toContain("mayapple");
  });

  test("the same player keeps progress that never reached the server", async ({
    page,
  }) => {
    /**
     * The other direction, and the reason the union exists at all: a player whose
     * last save never made it up (a closed lid, a dropped connection) must get it
     * back next time they sign in on this device, not have it thrown away as if it
     * belonged to a stranger.
     */
    const ok = await registerAccount("device-player-c", "device-c@example.com");
    test.skip(!ok, "no database configured");

    await signIn(page.context(), "device-player-c", "device-c@example.com");
    const seeded = await page.request.post("/api/progress", {
      data: { discoveredPlants: { "wild-geranium": true } },
    });
    expect(seeded.status()).toBe(200);

    // C's device holds a find the server never heard about.
    await leaveOnDevice(page, {
      discoveredPlants: { "wild-geranium": true, "common-milkweed": true },
    });
    await letSyncRun(page);

    // Signed out and back in as the same player.
    await page.context().clearCookies();
    await signIn(page.context(), "device-player-c", "device-c@example.com");
    await letSyncRun(page);

    const plants = await serverPlants(page);

    expect(plants).toContain("wild-geranium");
    expect(plants, "the unsynced find was thrown away").toContain("common-milkweed");
  });
});
