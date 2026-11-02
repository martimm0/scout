import { expect, test } from "@playwright/test";

import { registerAccount, signIn } from "./helpers";

/**
 * A suspension bites on a session that is already open.
 *
 * Pages check it, and redirect to /suspended. The routes behind them did not,
 * so a suspended player with a party page already open could still fetch a
 * ticket and walk into a room with other players, and still rename
 * themselves, which are the two things a suspension is most likely to be for.
 */
test("a suspended account gets no party ticket and cannot change its name", async ({
  page,
}) => {
  const ok = await registerAccount("suspended-player", "suspended@example.com");
  test.skip(!ok, "no database configured");

  const { setAccountStatus } = await import("../src/lib/accounts");

  await signIn(page.context(), "suspended-player", "suspended@example.com");
  expect((await page.request.get("/api/party/ticket")).status()).toBe(200);

  await setAccountStatus("suspended-player", "suspended");

  try {
    expect((await page.request.get("/api/party/ticket")).status()).toBe(403);
    expect(
      (
        await page.request.post("/api/username", {
          data: { username: `sus${Date.now().toString(36)}` },
        })
      ).status(),
    ).toBe(403);

    // The pages open to everybody still sync a signed-in save, so they turn a
    // suspended account away too.
    for (const path of ["/pocket", "/customize"]) {
      await page.goto(path);
      await expect(page, `${path} let a suspended account in`).toHaveURL(/\/suspended$/);
    }
  } finally {
    await setAccountStatus("suspended-player", "active");
  }
});
