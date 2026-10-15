import { expect, test, type Page } from "@playwright/test";

import { dismissTutorial, registerAccount, signIn } from "./helpers";

/**
 * A photograph the server did not keep.
 *
 * The album has two homes: the player's account, and, on a copy of Scout with no
 * accounts at all, the browser. The client picked the second whenever the first
 * answered anything but success. So a signed-in player whose upload hit a
 * database hiccup, a dropped connection or a lapsed session got the flash and the
 * click, and the photograph went into localStorage, where nothing on a deployment
 * with accounts ever reads it back: the journal asks the account. It was told
 * the picture was kept and it was never seen again.
 *
 * The album had the same habit on the way in. A failed fetch read as "there is
 * no account", so the journal told a signed-in player their photographs were
 * kept on this device only, and showed them whatever a previous player had left
 * in this browser, or an empty album.
 *
 * Only a 501, which is the server saying there is no account system to keep
 * anything in, means "keep it here".
 */

const LOCAL_KEY = "scout-photos";

async function fly(page: Page) {
  await page.goto("/play?hour=13");
  await page.waitForTimeout(4000);
  await dismissTutorial(page);
  await page.waitForTimeout(1500);
}

async function localAlbum(page: Page) {
  return page.evaluate((key) => window.localStorage.getItem(key), LOCAL_KEY);
}

test.describe("a photograph is only reported kept where it was kept", () => {
  test("an upload the server failed is not kept on the device and not called kept", async ({
    page,
  }) => {
    test.setTimeout(120_000);

    const ok = await registerAccount("photo-fail-player", "photo-fail@example.com");
    test.skip(!ok, "no database configured, so there is no account album to fail");

    await signIn(page.context(), "photo-fail-player", "photo-fail@example.com");
    await fly(page);

    await page.route("**/api/photos", async (route) => {
      if (route.request().method() === "POST") {
        await route.fulfill({ status: 500, body: "{}" });

        return;
      }

      await route.continue();
    });

    await page.getByRole("button", { name: /Take a photo/ }).click();
    await page.waitForTimeout(1200);

    expect(
      await localAlbum(page),
      "the photograph was filed on the device, where the journal never looks",
    ).toBeNull();
    await expect(page.getByRole("status").filter({ hasText: /not kept/ })).toBeVisible();
  });

  test("an album that could not be fetched does not claim to live on the device", async ({
    page,
  }) => {
    await signIn(page.context());

    await page.route("**/api/photos", (route) =>
      route.fulfill({ status: 500, body: "{}" }),
    );

    await page.goto("/journal");
    await page.getByRole("button", { name: "Photos" }).click();

    await expect(page.getByText(/could not be fetched/)).toBeVisible();
    await expect(page.getByText(/kept on this device only/)).toHaveCount(0);
    await expect(page.getByText(/No photographs yet/)).toHaveCount(0);
  });

  test("a photograph the server would not delete stays in the album", async ({
    page,
  }) => {
    /**
     * Remove used to take the card off the page whatever the server said, so a
     * delete that failed looked like one that worked, and the photograph came
     * back on the next visit to an album the player thought they had tidied.
     */
    const ok = await registerAccount("photo-keep-player", "photo-keep@example.com");
    test.skip(!ok, "no database configured");

    await signIn(page.context(), "photo-keep-player", "photo-keep@example.com");
    await page.goto("/journal");

    const existing = await (await page.request.get("/api/photos")).json();
    for (const photo of existing.photos as { id: string }[]) {
      await page.request.delete(`/api/photos/${photo.id}`);
    }

    const jpeg = await page.evaluate(() => {
      const canvas = document.createElement("canvas");
      canvas.width = 8;
      canvas.height = 8;
      canvas.getContext("2d")!.fillRect(0, 0, 8, 8);

      return canvas.toDataURL("image/jpeg", 0.5);
    });
    const posted = await page.request.post("/api/photos", {
      data: { src: jpeg, area: "Fern Hollow", clock: "9:00 am", phase: "Morning" },
    });
    expect(posted.status()).toBe(200);
    const { id } = (await posted.json()) as { id: string };

    await page.route("**/api/photos/*", (route) =>
      route.request().method() === "DELETE"
        ? route.fulfill({ status: 500, body: "{}" })
        : route.continue(),
    );

    await page.reload();
    await page.getByRole("button", { name: "Photos" }).click();
    await expect(page.locator("li img")).toHaveCount(1);

    await page.getByRole("button", { name: "Remove" }).click();
    await page.waitForTimeout(800);

    await expect(
      page.locator("li img"),
      "the card vanished although the photograph is still on the server",
    ).toHaveCount(1);

    await page.unroute("**/api/photos/*");
    await page.request.delete(`/api/photos/${id}`);
  });

  test("with no account system at all, the device keeps it", async ({ page }) => {
    /**
     * The case the local album exists for, which the fix must not take away: a
     * copy of Scout with no database answers 501, and the photograph stays in
     * this browser and is shown as such.
     */
    test.setTimeout(120_000);

    await signIn(page.context());
    await page.route("**/api/photos", (route) =>
      route.fulfill({
        status: 501,
        contentType: "application/json",
        body: JSON.stringify({ error: "cloud-save-not-configured" }),
      }),
    );

    await fly(page);
    await page.evaluate((key) => window.localStorage.removeItem(key), LOCAL_KEY);

    await page.getByRole("button", { name: /Take a photo/ }).click();
    await page.waitForTimeout(1200);

    const stored = JSON.parse((await localAlbum(page)) ?? "[]") as unknown[];
    expect(stored).toHaveLength(1);

    await page.goto("/journal");
    await page.getByRole("button", { name: "Photos" }).click();
    await expect(page.getByText(/kept on this device only/)).toBeVisible();

    await page.evaluate((key) => window.localStorage.removeItem(key), LOCAL_KEY);
  });
});
