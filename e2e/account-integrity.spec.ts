import { expect, test, type Page } from "@playwright/test";

import { env } from "../src/lib/env";
import { registerAccount, resetProgress, signIn } from "./helpers";

/**
 * What one account can do to the rows the server keeps for it, and to the
 * admin's view of everybody's.
 */

async function tinyJpeg(page: Page) {
  await page.goto("/about");

  return page.evaluate(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 8;
    canvas.height = 8;
    canvas.getContext("2d")!.fillRect(0, 0, 8, 8);

    return canvas.toDataURL("image/jpeg", 0.5);
  });
}

test.describe("one account cannot reach past its own rows", () => {
  test("a save with odd numbers in it does not take the admin dashboard down", async ({
    page,
    browser,
  }) => {
    /**
     * The dashboard sums every save's pollinations with an `::int` cast, and a
     * save accepted any finite number. One player posting 1.5 made the cast
     * throw, so `/admin` and `/api/admin` answered 500 for everybody, and kept
     * doing it, because merging keeps the larger number and never takes it out.
     */
    const ok = await registerAccount("odd-stats-player", "odd-stats@example.com");
    test.skip(!ok, "no database configured");

    await signIn(page.context(), "odd-stats-player", "odd-stats@example.com");

    try {
      expect(
        (
          await page.request.post("/api/progress", {
            data: { stats: { pollinationSuccesses: 1.5 } },
          })
        ).status(),
      ).toBe(200);

      const admin = await browser.newContext();
      await signIn(admin, "the-admin", env.adminEmail);
      const api = await admin.request.get("/api/admin");
      await admin.close();

      expect(api.status(), "one player's save broke the dashboard").toBe(200);
    } finally {
      await resetProgress("odd-stats-player");
    }
  });

  test("a deleted account's open tab cannot put its save or photographs back", async ({
    page,
    browser,
  }) => {
    /**
     * Deleting takes the save and the album with it. The routes behind them
     * only asked whether somebody was signed in, and a session outlives the
     * account, so the player's open tab saved its whole local copy into a
     * fresh row on its next autosave, and new photographs went in too.
     */
    const ok = await registerAccount("deleted-player", "deleted@example.com");
    test.skip(!ok, "no database configured");

    await signIn(page.context(), "deleted-player", "deleted@example.com");
    const jpeg = await tinyJpeg(page);

    const admin = await browser.newContext();
    await signIn(admin, "the-admin", env.adminEmail);
    expect(
      (
        await admin.request.post("/api/admin", {
          data: { action: "delete", userId: "deleted-player" },
        })
      ).status(),
    ).toBe(200);
    await admin.close();

    const save = await page.request.post("/api/progress", {
      data: {
        owner: "deleted-player",
        discoveredPlants: { "wild-geranium": true },
      },
    });
    const photo = await page.request.post("/api/photos", {
      data: { src: jpeg, area: "Fern Hollow", clock: "9:00 am", phase: "Morning" },
    });

    expect(save.status(), "the deleted account's save was written back").toBe(410);
    expect(photo.status(), "the deleted account's photograph was kept").toBe(410);

    const after = (await (await page.request.get("/api/progress")).json()) as {
      progress: unknown;
    };
    expect(after.progress).toBeNull();
    expect((await (await page.request.get("/api/photos")).json()).photos).toEqual([]);

    // Signing in again is a new account, and saves as one.
    await registerAccount("deleted-player", "deleted@example.com");
    expect(
      (
        await page.request.post("/api/progress", {
          data: { owner: "deleted-player", discoveredPlants: { mayapple: true } },
        })
      ).status(),
    ).toBe(200);
    await resetProgress("deleted-player");
  });

  test("uploads that arrive together cannot overfill the album", async ({ page }) => {
    /**
     * The cap was a count inside the insert. Two inserts running at once each
     * count the rows the other has not committed yet, so both see room for
     * one and both go in: a nearly full album took every photograph sent at
     * the same moment.
     */
    test.setTimeout(120_000);

    const ok = await registerAccount("album-race-player", "album-race@example.com");
    test.skip(!ok, "no database configured");

    await signIn(page.context(), "album-race-player", "album-race@example.com");
    const jpeg = await tinyJpeg(page);
    const post = () =>
      page.request.post("/api/photos", {
        data: { src: jpeg, area: "Fern Hollow", clock: "9:00 am", phase: "Morning" },
      });
    const album = async () =>
      ((await (await page.request.get("/api/photos")).json()).photos as { id: string }[]);
    const empty = async () => {
      for (const { id } of await album()) {
        await page.request.delete(`/api/photos/${id}`);
      }
    };

    await empty();

    try {
      while ((await album()).length < 49) {
        await post();
      }

      // Thirty at once: eight was not always enough to land two together.
      const results = await Promise.all(Array.from({ length: 30 }, post));
      const kept = results.filter((r) => r.status() === 200).length;
      const size = (await album()).length;

      expect(size, "the album went over fifty").toBeLessThanOrEqual(50);
      expect(size, "a photograph was called kept and is not there").toBe(49 + kept);
    } finally {
      await empty();
    }
  });

  test("somebody who plays every day counts as active, signed in or not", async ({
    page,
  }) => {
    /**
     * Last seen was written at sign-in and nowhere else. A session lasts thirty
     * days and renews itself while it is used, so a player on every day of the
     * week dropped out of "active this week" and sank down the admin's list.
     */
    const ok = await registerAccount("daily-player", "daily@example.com");
    test.skip(!ok, "no database configured");

    const { sql } = await import("@vercel/postgres");
    await sql`
      UPDATE accounts SET last_seen = now() - interval '10 days'
      WHERE user_id = 'daily-player'
    `;

    await signIn(page.context(), "daily-player", "daily@example.com");

    try {
      expect(
        (
          await page.request.post("/api/progress", {
            data: { owner: "daily-player", discoveredPlants: { mayapple: true } },
          })
        ).status(),
      ).toBe(200);

      const { rows } = await sql<{ days: number }>`
        SELECT EXTRACT(EPOCH FROM now() - last_seen) / 86400 AS days
        FROM accounts WHERE user_id = 'daily-player'
      `;

      expect(Number(rows[0].days), "playing today did not count as seen today").toBeLessThan(1);
    } finally {
      await resetProgress("daily-player");
    }
  });

  test("an admin input that cannot be honoured is refused, not reported done", async ({
    browser,
  }) => {
    /**
     * A ceiling of 1e21 is finite, so it passed, and was stored as "1e+21",
     * which reads back as 1: the door shut on everybody and the admin was told
     * it had worked. A waitlist removal with no address deleted nothing and
     * said ok as well.
     */
    const ok = await registerAccount("admin-input-player", "admin-input@example.com");
    test.skip(!ok, "no database configured");

    const admin = await browser.newContext();
    await signIn(admin, "the-admin", env.adminEmail);

    const ceiling = async () =>
      ((await (await admin.request.get("/api/admin")).json()) as {
        analytics: { ceiling: number };
      }).analytics.ceiling;
    const before = await ceiling();

    try {
      const huge = await admin.request.post("/api/admin", {
        data: { action: "setCeiling", ceiling: 1e21 },
      });
      const after = await ceiling();

      expect(after, "the ceiling moved").toBe(before);
      expect(huge.status(), "a ceiling that could not be kept was accepted").toBe(400);

      const removal = await admin.request.post("/api/admin", {
        data: { action: "removeWaitlist" },
      });
      expect(removal.status(), "a removal with no address was reported done").toBe(400);
    } finally {
      await admin.request.post("/api/admin", {
        data: { action: "setCeiling", ceiling: before },
      });
      await admin.close();
    }
  });
});
