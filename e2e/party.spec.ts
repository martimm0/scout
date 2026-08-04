import { readFileSync } from "node:fs";

import { expect, test, type Browser, type Page } from "@playwright/test";
import { encode } from "next-auth/jwt";

import { resetProgress, signIn } from "./helpers";
import { GARDEN_PARTIES, PARTY_CAP } from "../party/protocol";

/**
 * Garden parties.
 *
 * These drive two real browser contexts into one room, because the whole
 * feature is about two people being in the same place and there is no way to
 * prove that with one. A single-context test would pass against a server that
 * broadcast to nobody.
 *
 * The party server runs alongside the app; see `playwright.config.ts`.
 */

const PARTY_HOST = `127.0.0.1:${Number(process.env.PLAYWRIGHT_PORT ?? 3000) + 1}`;

/** A signed-in page with its own account, in its own context. */
async function playerPage(browser: Browser, who: string): Promise<Page> {
  const context = await browser.newContext();

  await signIn(context, `party-${who}`, `${who}@example.com`);

  const page = await context.newPage();

  await page.goto("/");
  await resetProgress(page);

  return page;
}

/**
 * A party ticket for an arbitrary account, minted the way the game mints one.
 *
 * The route only ever issues a pass for whoever is signed in, which is the
 * point of it, so a test that needs eleven different players has to sign the
 * passes itself. Same secret, same salt: if either drifts from the app's, the
 * room refuses these and the tests fail loudly rather than testing a hole.
 */
async function partyTicket(who: string) {
  let secret = "scout-local-mode-no-signin-possible";

  try {
    const match = /^AUTH_SECRET=(.*)$/m.exec(readFileSync(".env.local", "utf8"));

    if (match) {
      secret = match[1].trim().replace(/^["']|["']$/g, "");
    }
  } catch {
    // Local mode, where the placeholder above is what the app uses too.
  }

  return encode({
    token: { sub: who, name: who },
    secret,
    salt: "scout-party-ticket",
    maxAge: 300,
  });
}

/** The room's own head-count, read from node rather than from a page. */
async function roomCount(room: string) {
  const response = await fetch(`http://${PARTY_HOST}/parties/main/${room}`);

  if (!response.ok) {
    return -1;
  }

  return ((await response.json()) as { count: number }).count;
}

function headCount(page: Page, party: string) {
  return page.evaluate(
    async ([host, room]) => {
      const response = await fetch(`http://${host}/parties/main/${room}`);

      return response.ok
        ? ((await response.json()) as { count: number }).count
        : -1;
    },
    [PARTY_HOST, party] as const,
  );
}

test.describe("garden parties", () => {
  test("a party needs an account", async ({ page }) => {
    // No sign-in on this context at all, so the page must be a wall rather than
    // a lobby. The socket has its own gate; this is the one a player meets.
    await page.goto("/parties");

    await expect(page.getByText(/Sign in/i).first()).toBeVisible();
    await expect(page.getByRole("button", { name: /Join the/ })).toHaveCount(0);
  });

  test("the room refuses a socket with no ticket", async ({ page }) => {
    /**
     * The page gate above is not the enforcement, it is the courtesy. This is
     * the enforcement: the room itself, asked directly, with no session behind
     * the request.
     */
    await page.goto("/");

    const status = await page.evaluate(async (host) => {
      return new Promise<string>((resolve) => {
        const socket = new WebSocket(
          `ws://${host}/parties/main/garden-frick`,
        );

        socket.addEventListener("open", () => resolve("opened"));
        socket.addEventListener("error", () => resolve("refused"));
        setTimeout(() => resolve("timeout"), 5000);
      });
    }, PARTY_HOST);

    expect(status, "an unauthenticated socket got into the party").toBe(
      "refused",
    );
  });

  test("a room that is not one of the three is never created", async ({
    page,
  }) => {
    /**
     * `GET /parties/main/<anything>` used to answer 200 and bring a Durable
     * Object into existence for whatever name was asked for, so a stranger with
     * a for-loop could mint unbounded rooms on the account. There are exactly
     * three parties and the names are a closed set.
     */
    await page.goto("/");

    const codes = await page.evaluate(async (host) => {
      const ask = async (room: string) =>
        (await fetch(`http://${host}/parties/main/${room}`)).status;

      return {
        real: await ask("garden-frick"),
        invented: await ask("garden-nope"),
        absurd: await ask("x".repeat(60)),
      };
    }, PARTY_HOST);

    expect(codes.real).toBe(200);
    expect(codes.invented, "an invented room answered").toBe(404);
    expect(codes.absurd, "an absurd room answered").toBe(404);
  });

  test("three parties, one per park, with a live count", async ({ browser }) => {
    const page = await playerPage(browser, "ada");

    await page.goto("/parties");

    for (const label of ["Frick Park", "Schenley Park", "Highland Park"]) {
      await expect(page.getByText(label, { exact: false }).first()).toBeVisible();
    }

    await expect(page.getByRole("button", { name: /Join the/ })).toHaveCount(
      GARDEN_PARTIES.length,
    );

    await page.close();
  });

  test("two players join the same party and each sees the other", async ({
    browser,
  }) => {
    test.setTimeout(180_000);

    const ada = await playerPage(browser, "ada");
    const bo = await playerPage(browser, "bo");

    // Nobody in yet. If this is not zero the previous test leaked a player and
    // every count below is measuring the wrong thing.
    expect(await headCount(ada, "garden-highland")).toBe(0);

    await ada.goto("/parties");
    await ada.getByRole("button", { name: /Join the Highland/ }).click();
    await ada.waitForURL(/\/play/);

    await expect
      .poll(() => headCount(bo, "garden-highland"), { timeout: 20_000 })
      .toBe(1);

    await bo.goto("/parties");
    await bo.getByRole("button", { name: /Join the Highland/ }).click();
    await bo.waitForURL(/\/play/);

    await expect
      .poll(() => headCount(ada, "garden-highland"), { timeout: 20_000 })
      .toBe(2);

    /**
     * Highland is normally EARNED, and neither of these accounts has earned it:
     * both were reset to a fresh save a moment ago. Being invited is not the
     * same as unlocking, so the party lets them in anyway. If the unlock gate
     * ever grows over the party entrance, this is the assertion that says so.
     */
    await expect(ada).toHaveURL(/party=1/);

    // And leaving gives the seat back rather than holding it until a timeout.
    await ada.close();

    await expect
      .poll(() => headCount(bo, "garden-highland"), { timeout: 20_000 })
      .toBe(1);

    await bo.close();
  });

  test("the cap is ten, and the eleventh is told why", async () => {
    test.setTimeout(180_000);

    /**
     * Driven at the socket rather than through eleven browsers, which would
     * take minutes and prove the same thing more slowly. The cap lives on the
     * server, so this asks the server, using the same ticket the game mints.
     *
     * The eleventh must be TOLD `full` and then closed, not dropped in silence.
     * A silent refusal is indistinguishable from a flaky network, and the
     * client would sit there reconnecting into a wall forever.
     */
    const room = "garden-schenley";
    const sockets: WebSocket[] = [];

    const open = async (who: string) => {
      const socket = new WebSocket(
        `ws://${PARTY_HOST}/parties/main/${room}?ticket=${encodeURIComponent(
          await partyTicket(who),
        )}`,
      );

      await new Promise<void>((resolve, reject) => {
        socket.addEventListener("open", () => resolve());
        socket.addEventListener("error", () => reject(new Error("refused")));
      });

      sockets.push(socket);

      return socket;
    };

    try {
      for (let i = 0; i < PARTY_CAP; i += 1) {
        await open(`cap-${i}`);
      }

      expect(await roomCount(room), "the room did not fill").toBe(PARTY_CAP);

      // The eleventh.
      const refused = new WebSocket(
        `ws://${PARTY_HOST}/parties/main/${room}?ticket=${encodeURIComponent(
          await partyTicket("cap-eleventh"),
        )}`,
      );

      const told = await new Promise<string>((resolve) => {
        refused.addEventListener("message", (event) => {
          const message = JSON.parse(String(event.data)) as {
            t: string;
            reason?: string;
          };

          if (message.t === "refused") {
            resolve(message.reason ?? "no reason");
          }
        });
        refused.addEventListener("close", () => resolve("closed in silence"));
        setTimeout(() => resolve("ignored"), 8000);
      });

      expect(told, "the eleventh was not told why").toBe("full");
      expect(
        await roomCount(room),
        "the eleventh got a seat anyway",
      ).toBe(PARTY_CAP);

      refused.close();
    } finally {
      for (const socket of sockets) {
        socket.close();
      }
    }
  });

  test("a second tab does not take a second seat", async () => {
    /**
     * One seat per ACCOUNT, not per socket. Otherwise a player with the game
     * open twice is two bees in the park and two of the ten chairs, and the one
     * they are not looking at never moves.
     */
    const room = "garden-frick";
    const first = new WebSocket(
      `ws://${PARTY_HOST}/parties/main/${room}?ticket=${encodeURIComponent(
        await partyTicket("twice"),
      )}`,
    );

    await new Promise<void>((resolve) =>
      first.addEventListener("open", () => resolve()),
    );

    await expect.poll(() => roomCount(room)).toBe(1);

    // The old tab is expected to be hung up on, so watch for that before the
    // second one opens and the race is decided.
    const firstClosed = new Promise<boolean>((resolve) => {
      first.addEventListener("close", () => resolve(true));
      setTimeout(() => resolve(false), 10_000);
    });

    const second = new WebSocket(
      `ws://${PARTY_HOST}/parties/main/${room}?ticket=${encodeURIComponent(
        await partyTicket("twice"),
      )}`,
    );

    await new Promise<void>((resolve) =>
      second.addEventListener("open", () => resolve()),
    );

    await expect
      .poll(() => roomCount(room), { timeout: 15_000 })
      .toBe(1);

    /**
     * And the older socket is hung up on rather than left hanging. A tab that
     * keeps its connection after being replaced is a bee that never moves
     * again, standing in the park sending nothing, and the seat it appears to
     * hold is one nobody can use.
     */
    expect(
      await firstClosed,
      "the replaced tab was left connected",
    ).toBe(true);

    first.close();
    second.close();

    await expect.poll(() => roomCount(room), { timeout: 15_000 }).toBe(0);
  });
});
