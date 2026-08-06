import { readFileSync } from "node:fs";

import { expect, test, type Browser, type Page } from "@playwright/test";
import { encode } from "next-auth/jwt";

import { dismissTutorial, resetProgress, signIn } from "./helpers";
import {
  setActivePark,
  startPosition,
} from "../src/features/game/world/terrain";
import {
  GARDEN_PARTIES,
  PARTY_CAP,
  type CoopView,
  type TableView,
} from "../party/protocol";
import { voiceGainFor } from "../src/features/game/state/party-voice";

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

/**
 * Close a player down completely.
 *
 * The CONTEXT, not just the page. Closing the page alone leaves the context
 * open, and each of these tests opens two of them with a full WebGL park inside;
 * left behind, they load the machine enough that flight tests in later specs
 * blow their timeouts. That showed up as WebKit failures in `minigames` and
 * `pages` that passed perfectly well on their own, which is the most misleading
 * shape a test failure can have.
 */
async function closePlayer(page: Page) {
  await page.context().close();
}

/** A signed-in page with its own account, in its own context. */
async function playerPage(browser: Browser, who: string): Promise<Page> {
  const context = await browser.newContext();

  // A distinct display name, so a board that says who won is saying something.
  await signIn(
    context,
    `party-${who}`,
    `${who}@example.com`,
    who[0].toUpperCase() + who.slice(1),
  );

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
  const response = await fetch(`http://${PARTY_HOST}/parties/garden/${room}`);

  if (!response.ok) {
    return -1;
  }

  return ((await response.json()) as { count: number }).count;
}

function headCount(page: Page, party: string) {
  return page.evaluate(
    async ([host, room]) => {
      const response = await fetch(`http://${host}/parties/garden/${room}`);

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
          `ws://${host}/parties/garden/garden-frick`,
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
     * `GET /parties/garden/<anything>` used to answer 200 and bring a Durable
     * Object into existence for whatever name was asked for, so a stranger with
     * a for-loop could mint unbounded rooms on the account. There are exactly
     * three parties and the names are a closed set.
     */
    await page.goto("/");

    const codes = await page.evaluate(async (host) => {
      const ask = async (room: string) =>
        (await fetch(`http://${host}/parties/garden/${room}`)).status;

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

    await closePlayer(page);
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
    await closePlayer(ada);

    await expect
      .poll(() => headCount(bo, "garden-highland"), { timeout: 20_000 })
      .toBe(1);

    await closePlayer(bo);
  });

  test("the other player is a bee you can actually see", async ({
    browser,
  }) => {
    test.setTimeout(240_000);

    /**
     * The assertion that matters, and the one it is easy to fake.
     *
     * "A pos message arrived" would pass against a scene that draws nothing,
     * which is the whole failure mode: the socket is the easy half and the
     * rendering is the half that breaks. So this counts the bee MESHES in the
     * live three.js scene, from inside the page, and requires the count to go
     * up by one when somebody else walks in and back down when they leave.
     *
     * Counted by walking the scene graph for the group the remote bee is drawn
     * into, rather than by reading React state, which would be the same
     * proxy-not-the-thing mistake one level down.
     */
    const ada = await playerPage(browser, "ada");
    const bo = await playerPage(browser, "bo");

    // Ada goes in first and flies alone for a moment.
    await ada.goto("/parties");
    await ada.getByRole("button", { name: /Join the Frick/ }).click();
    await ada.waitForURL(/\/play/);
    await ada.waitForTimeout(4000);

    /**
     * Every remote bee currently DRAWN, with where it is drawn.
     *
     * Visible ones only. A bee that has joined but has not yet said where it is
     * is deliberately not rendered, so counting hidden groups would report a
     * bee the player cannot see.
     */
    const beesOnScreen = (page: Page) =>
      page.evaluate(() => {
        const scene = (
          window as unknown as { __scoutScene?: { children: unknown[] } }
        ).__scoutScene;

        if (!scene) {
          return null;
        }

        const found: { who: string; x: number; y: number; z: number }[] = [];

        const walk = (node: {
          userData?: Record<string, unknown>;
          visible?: boolean;
          position?: { x: number; y: number; z: number };
          children?: unknown[];
        }) => {
          if (node.userData?.remoteBee && node.visible && node.position) {
            found.push({
              who: String(node.userData.remoteBee),
              x: node.position.x,
              y: node.position.y,
              z: node.position.z,
            });
          }

          for (const child of node.children ?? []) {
            walk(child as typeof node);
          }
        };

        walk(scene as unknown as Parameters<typeof walk>[0]);

        return found;
      });

    expect(
      (await beesOnScreen(ada))?.length,
      "alone, and already seeing bees",
    ).toBe(0);

    // Bo joins the same party.
    await bo.goto("/parties");
    await bo.getByRole("button", { name: /Join the Frick/ }).click();
    await bo.waitForURL(/\/play/);

    await expect
      .poll(async () => (await beesOnScreen(ada))?.length, { timeout: 30_000 })
      .toBe(1);

    /**
     * And the very first frame it is drawn on, it is already WHERE BO IS.
     *
     * This is the assertion that found the bug worth finding. The bee used to
     * be created at the group's default position and then eased toward its real
     * one, so a joining player appeared at the world origin and flew 240 units
     * across Frick to where they actually were, every time anybody joined. The
     * first pose is a placement now, and the bee is not drawn at all until it
     * arrives.
     *
     * Checked against the park's own spawn point rather than "not the origin",
     * because "not the origin" also passes halfway through the swoop.
     */
    setActivePark("frick");

    const [startX, , startZ] = startPosition();
    const [bee] = (await beesOnScreen(ada))!;

    expect(
      Math.hypot(bee.x - startX, bee.z - startZ),
      `drawn at ${bee.x.toFixed(0)},${bee.z.toFixed(0)} but Bo is at ${startX},${startZ}`,
    ).toBeLessThan(5);

    // Bo leaves, and the bee goes with them.
    await closePlayer(bo);

    await expect
      .poll(async () => (await beesOnScreen(ada))?.length, { timeout: 30_000 })
      .toBe(0);

    await closePlayer(ada);
  });

  test("chat reaches the room, and forgets on its own", async ({ browser }) => {
    test.setTimeout(300_000);

    const ada = await playerPage(browser, "ada");
    const bo = await playerPage(browser, "bo");

    for (const page of [ada, bo]) {
      await page.goto("/parties");
      await page.getByRole("button", { name: /Join the Schenley/ }).click();
      await page.waitForURL(/\/play/);
      await page.waitForTimeout(2500);
      // The first-flight tutorial is up over a fresh save, and its scrim eats
      // clicks aimed at the chat behind it.
      await dismissTutorial(page);
      await page.waitForTimeout(800);
    }

    const chat = ada.getByRole("textbox", {
      name: /Say something to the party/,
    });

    await expect(chat, "no chat box in a party").toBeVisible();

    /**
     * Typing must not fly the bee.
     *
     * Every letter of "wasd" steers, and the scene listens on window, so
     * writing a sentence used to be a way to fly across the park by accident.
     * Position before and after, and the difference has to be nothing at all.
     */
    /**
     * Read from the SCENE, not the save file.
     *
     * The first version of this read `state.player.position` out of
     * localStorage, which is not persisted: it returned null before and null
     * after, so the check passed against a bee flying across the park. Caught by
     * deleting the guard and watching the test pass anyway.
     */
    const where = () =>
      ada.evaluate((): [number, number, number] | null => {
        const scene = (
          window as unknown as { __scoutScene?: { children: unknown[] } }
        ).__scoutScene;

        let spot: [number, number, number] | null = null;

        const walk = (node: {
          userData?: Record<string, unknown>;
          position?: { x: number; y: number; z: number };
          children?: unknown[];
        }) => {
          if (node.userData?.playerBee && node.position) {
            spot = [node.position.x, node.position.y, node.position.z];
          }

          for (const child of node.children ?? []) {
            walk(child as typeof node);
          }
        };

        if (scene) {
          walk(scene as unknown as Parameters<typeof walk>[0]);
        }

        return spot;
      });

    await chat.click();

    const before = await where();

    expect(before, "no player bee in the scene to measure").not.toBeNull();

    // Typed key by key, not `fill`. `fill` sets the value without ever
    // dispatching a keydown, so it cannot possibly steer the bee and the check
    // would be theatre.
    await chat.pressSequentially("wasdwasd sedge and spikerush", { delay: 25 });
    await ada.waitForTimeout(1200);

    /**
     * Nearly still, not bit-identical.
     *
     * A hovering bee bobs, so an exact comparison is a test that fails on the
     * hundredth of a unit the idle animation moves it: this was `toBe` on a
     * rounded string, and it passed on Chromium and failed on Firefox at
     * 89.08 against 89.07. Steering it is not a subtle effect. With the guards
     * removed the bee travels about two and a half units in this window, so half
     * a unit still catches it and the hover never comes close.
     */
    const after = (await where())!;
    const drift = Math.hypot(
      after[0] - before![0],
      after[1] - before![1],
      after[2] - before![2],
    );

    expect(drift, "typing in the chat flew the bee").toBeLessThan(0.5);

    // And the message actually crosses the room.
    await chat.press("Enter");

    await expect(
      bo.getByText("sedge and spikerush", { exact: false }),
      "the message never reached the other player",
    ).toBeVisible({ timeout: 20_000 });

    // The sender sees their own line too, which is how you know it went.
    await expect(
      ada.getByText("sedge and spikerush", { exact: false }),
    ).toBeVisible();

    /**
     * And then it goes, on its own, without anybody leaving.
     *
     * Sixty seconds is the promise. Rather than wait a real minute, the clock
     * the expiry reads is wound forward: `seenAt` is stamped from `Date.now()`,
     * so moving it is enough and no timer has to be faked.
     */
    await bo.evaluate(() => {
      const realNow = Date.now.bind(Date);
      const skew = 61_000;

      Date.now = () => realNow() + skew;
    });

    await expect(
      bo.getByText("sedge and spikerush", { exact: false }),
      "a message outlived its minute",
    ).toHaveCount(0, { timeout: 20_000 });

    // Ada, whose clock did not move, still has it. Proves the line above
    // measured the expiry rather than the socket dropping the message.
    await expect(
      ada.getByText("sedge and spikerush", { exact: false }),
    ).toBeVisible();

    await closePlayer(ada);
    await closePlayer(bo);
  });

  test("nothing said in a party is ever written down", async () => {
    /**
     * The server relays chat and forgets it. Not a storage saving: a chat that
     * promises to vanish must not be sitting in a room's storage afterwards, and
     * this is the assertion that the promise is kept by the code rather than by
     * the client politely not asking.
     *
     * Asked of a FRESH connection, which is the only way to tell. A client that
     * has been in the room all along cannot distinguish "the server kept no
     * history" from "the server kept it and did not send it".
     */
    const room = "garden-highland";

    const talker = new WebSocket(
      `ws://${PARTY_HOST}/parties/garden/${room}?ticket=${encodeURIComponent(
        await partyTicket("talker"),
      )}`,
    );

    await new Promise<void>((resolve) =>
      talker.addEventListener("open", () => resolve()),
    );

    talker.send(
      JSON.stringify({ t: "chat", text: "this should not be remembered" }),
    );

    await new Promise((resolve) => setTimeout(resolve, 1500));

    // Somebody new walks in afterwards.
    const latecomer = new WebSocket(
      `ws://${PARTY_HOST}/parties/garden/${room}?ticket=${encodeURIComponent(
        await partyTicket("latecomer"),
      )}`,
    );

    const heard: string[] = [];

    latecomer.addEventListener("message", (event) => {
      const message = JSON.parse(String(event.data)) as {
        t: string;
        text?: string;
      };

      if (message.t === "chat" && message.text) {
        heard.push(message.text);
      }
    });

    await new Promise<void>((resolve) =>
      latecomer.addEventListener("open", () => resolve()),
    );

    await new Promise((resolve) => setTimeout(resolve, 2500));

    expect(
      heard,
      "the room replayed a message from before the latecomer arrived",
    ).toEqual([]);

    talker.close();
    latecomer.close();
  });

  test("the falloff is silent far away and full up close", async () => {
    /**
     * The curve, on its own, as arithmetic.
     *
     * Cheap to check and worth checking separately from the plumbing: a mesh
     * that connects perfectly and leaves every gain at 1 is a party where
     * everybody hears everybody from across the park, and the WebRTC test below
     * would not notice.
     */
    expect(voiceGainFor(0)).toBe(1);
    expect(voiceGainFor(12)).toBe(1);
    expect(voiceGainFor(70)).toBe(0);
    expect(voiceGainFor(500)).toBe(0);

    // Monotonic between the two, and never outside 0..1.
    let previous = 1;

    for (let distance = 12; distance <= 70; distance += 2) {
      const gain = voiceGainFor(distance);

      expect(gain).toBeLessThanOrEqual(previous);
      expect(gain).toBeGreaterThanOrEqual(0);
      previous = gain;
    }

    // Halfway out is quiet but audible, not half volume: the curve is squared
    // because loudness is not linear in distance.
    expect(voiceGainFor(41)).toBeCloseTo(0.25, 2);

    // A garbage distance must not produce a garbage gain.
    expect(voiceGainFor(Number.NaN)).toBe(1);
  });

  /**
   * A real handshake between two real browsers, with Chromium's fake microphone
   * standing in for a person.
   *
   * The assertion is that a remote audio TRACK arrives and is live, not that an
   * offer was sent. Signalling that completes and delivers no audio is the
   * failure worth catching, and it is the one you cannot hear in a test.
   *
   * Run in BOTH unmute orders, because they take different paths and only one of
   * them was broken. Whoever unmutes first announces to a room that is not
   * listening yet, so it is the second announcement that connects them: if the
   * lower id unmutes second the offer follows from their own announcement, and
   * if the higher id unmutes second it follows from the acknowledgement coming
   * back. Testing one order passed while the other deadlocked in silence.
   */
  async function bothHearEachOther(
    browser: Browser,
    party: RegExp,
    unmuteLowerFirst: boolean,
  ) {
    const ada = await playerPage(browser, "ada");
    const bo = await playerPage(browser, "bo");

    for (const page of [ada, bo]) {
      await page.goto("/parties");
      await page.getByRole("button", { name: party }).click();
      await page.waitForURL(/\/play/);
      await page.waitForTimeout(2500);
      await dismissTutorial(page);
      await page.waitForTimeout(600);

      // Watch for an inbound audio track. Installed before either side unmutes,
      // so nothing is missed.
      await page.evaluate(() => {
        const holder = window as unknown as { __scoutHeard?: boolean };

        holder.__scoutHeard = false;

        const Original = window.RTCPeerConnection;

        window.RTCPeerConnection = function (
          this: unknown,
          ...args: ConstructorParameters<typeof RTCPeerConnection>
        ) {
          const connection = new Original(...args);

          connection.addEventListener("track", (event) => {
            if (
              event.track.kind === "audio" &&
              event.track.readyState === "live"
            ) {
              holder.__scoutHeard = true;
            }
          });

          return connection;
        } as unknown as typeof RTCPeerConnection;

        window.RTCPeerConnection.prototype = Original.prototype;
      });
    }

    const heard = (page: Page) =>
      page.evaluate(
        () => (window as unknown as { __scoutHeard?: boolean }).__scoutHeard,
      );

    // "party-ada" sorts before "party-bo", which is what the tie-break uses.
    const order = unmuteLowerFirst ? [ada, bo] : [bo, ada];

    for (const page of order) {
      await page.getByRole("button", { name: /Talk to the park/ }).click();
      await expect(
        page.getByRole("button", { name: /Microphone on/ }),
      ).toBeVisible({ timeout: 20_000 });

      // A real gap, so the first announcement genuinely lands on a room with
      // nobody listening. Unmuting together would hide the bug.
      await page.waitForTimeout(2000);
    }

    await expect.poll(() => heard(ada), { timeout: 60_000 }).toBe(true);
    await expect.poll(() => heard(bo), { timeout: 60_000 }).toBe(true);

    await closePlayer(ada);
    await closePlayer(bo);
  }

  /**
   * Chromium only, and that is a real limit worth stating rather than hiding.
   *
   * The fake microphone is a Chromium launch flag. Firefox needs a pref that
   * Playwright does not set for a device, and WebKit has no equivalent at all,
   * so on those two the permission prompt never resolves and the test hangs
   * rather than failing honestly. What is proven here is the SIGNALLING and the
   * plumbing: announcement, tie-break, offer, answer, ICE, live inbound track.
   * Whether WebKit's own WebRTC stack carries the audio is not proven by this
   * suite, the same way the touch tests prove the controls rather than iOS.
   */
  test.describe("hearing each other", () => {
    test.skip(
      ({ browserName }) => browserName !== "chromium",
      "the fake microphone is a Chromium flag",
    );

    test("two players hear each other, lower id unmuting first", async ({
      browser,
    }) => {
      test.setTimeout(300_000);
      await bothHearEachOther(browser, /Join the Frick/, true);
    });

    test("two players hear each other, higher id unmuting first", async ({
      browser,
    }) => {
      test.setTimeout(300_000);
      await bothHearEachOther(browser, /Join the Schenley/, false);
    });
  });

  test("two players play a game through to a win", async ({ browser }) => {
    test.setTimeout(300_000);

    /**
     * The board games, driven the way two people would.
     *
     * The rules are proven as arithmetic in `party-games.spec.ts`. What this
     * adds is everything between: the table appears in the other player's
     * lobby, sitting down seats them, the turn alternates, and the result the
     * server reaches is the result both screens show. None of that is exercised
     * by testing the rules, and all of it is where a multiplayer game breaks.
     */
    const ada = await playerPage(browser, "ada");
    const bo = await playerPage(browser, "bo");

    for (const page of [ada, bo]) {
      await page.goto("/parties");
      await page.getByRole("button", { name: /Join the Highland/ }).click();
      await page.waitForURL(/\/play/);
      await page.waitForTimeout(2500);
      await dismissTutorial(page);
      await page.waitForTimeout(600);
      await page.getByRole("button", { name: /^Games/ }).click();
    }

    await ada.getByRole("button", { name: /Trellis Four/ }).click();

    const adaBoard = ada.getByRole("region", { name: "Trellis Four" });
    const boBoard = bo.getByRole("region", { name: "Trellis Four" });

    await expect(adaBoard).toBeVisible();
    await expect(adaBoard.getByText(/Waiting for somebody/)).toBeVisible();

    // The table shows up in the other player's lobby without a reload.
    const sit = bo.getByRole("button", { name: "Sit down" });

    await expect(sit, "the table never reached the other player").toBeVisible({
      timeout: 20_000,
    });
    await sit.click();

    await expect(boBoard).toBeVisible({ timeout: 20_000 });
    await expect(adaBoard.getByText("Your turn.")).toBeVisible({
      timeout: 20_000,
    });
    await expect(boBoard.getByText(/Ada|turn/)).toBeVisible();

    /**
     * Ada takes column one four times, Bo answers in column two. The board
     * cannot be won by clicking alone: each move has to reach the server, be
     * refereed, and come back to both screens before the next one is legal.
     */
    for (const [page, column] of [
      [ada, 1],
      [bo, 2],
      [ada, 1],
      [bo, 2],
      [ada, 1],
      [bo, 2],
      [ada, 1],
    ] as const) {
      const board = page === ada ? adaBoard : boBoard;

      await expect(board.getByText("Your turn.")).toBeVisible({
        timeout: 20_000,
      });
      await board.getByRole("button", { name: `Column ${column}` }).click();
      await page.waitForTimeout(300);
    }

    // The same outcome on both screens, said from each player's side.
    await expect(
      adaBoard.getByText("You won that one."),
      "the winner was not told they won",
    ).toBeVisible({ timeout: 20_000 });

    await expect(
      boBoard.getByText("Ada took it."),
      "the loser was not told who won",
    ).toBeVisible({ timeout: 20_000 });

    await ada.close();
    await bo.close();
  });

  test("the room refuses a move out of turn, however it is asked", async () => {
    test.setTimeout(180_000);

    /**
     * The board greys out what you cannot play, but a disabled button is a
     * suggestion: the enforcement has to be the room. So this asks the room
     * directly, over the socket, exactly as a modified client would.
     *
     * Driven from node rather than a browser for the same reason the cap test
     * is: what is being tested is the server, and going through a UI to reach it
     * would only add ways for the test to be wrong.
     */
    const room = "garden-highland";
    const sockets: WebSocket[] = [];

    const open = async (who: string) => {
      const socket = new WebSocket(
        `ws://${PARTY_HOST}/parties/garden/${room}?ticket=${encodeURIComponent(
          await partyTicket(who),
        )}`,
      );

      const tables: TableView[] = [];

      socket.addEventListener("message", (event) => {
        const message = JSON.parse(String(event.data)) as {
          t: string;
          tables?: TableView[];
        };

        if (message.t === "tables" && message.tables) {
          tables.length = 0;
          tables.push(...message.tables);
        }
      });

      await new Promise<void>((resolve) =>
        socket.addEventListener("open", () => resolve()),
      );

      sockets.push(socket);

      return { socket, tables };
    };

    const settle = () => new Promise((resolve) => setTimeout(resolve, 700));

    try {
      const first = await open("turn-a");
      const second = await open("turn-b");

      await settle();

      first.socket.send(JSON.stringify({ t: "open", kind: "tictactoe" }));
      await settle();

      const id = second.tables[0]?.id;

      expect(id, "the table never reached the second player").toBeTruthy();

      second.socket.send(JSON.stringify({ t: "sit", table: id }));
      await settle();

      expect(second.tables[0].seats).toHaveLength(2);
      expect(second.tables[0].turn, "seat 0 does not move first").toBe(0);

      // Seat 1, moving first. Refused.
      second.socket.send(JSON.stringify({ t: "move", table: id, move: 4 }));
      await settle();

      expect(
        (first.tables[0].state as (number | null)[]).every(
          (cell) => cell === null,
        ),
        "a player moved out of turn",
      ).toBe(true);

      // Seat 0 plays that cell, then seat 1 tries to play it again.
      first.socket.send(JSON.stringify({ t: "move", table: id, move: 4 }));
      await settle();

      second.socket.send(JSON.stringify({ t: "move", table: id, move: 4 }));
      await settle();

      const board = first.tables[0].state as (number | null)[];

      expect(board[4], "a taken cell was overwritten").toBe(0);
      expect(first.tables[0].turn, "the turn did not pass").toBe(1);

      // And nonsense is refused without breaking the board.
      for (const move of [99, -1, 1.5, "four", null, { cell: 4 }]) {
        second.socket.send(JSON.stringify({ t: "move", table: id, move }));
      }

      await settle();

      expect(
        (first.tables[0].state as (number | null)[]).filter(
          (cell) => cell !== null,
        ),
        "a malformed move changed the board",
      ).toHaveLength(1);
    } finally {
      for (const socket of sockets) {
        socket.close();
      }
    }
  });

  test("two bees on one flower share a board and one roll", async () => {
    test.setTimeout(120_000);

    /**
     * Co-op pollination, asked of the room.
     *
     * Driven over sockets rather than through two flying bees, and that is a
     * deliberate retreat from an earlier version of this test. The board runs
     * on a twelve second clock, and crossing the park to reach the same flower
     * takes longer than that, so the browser version spent its time racing a
     * timer instead of testing anything: the round resolved itself before the
     * first tile could be clicked. What is actually being tested here is a
     * server contract, so it is asked of the server.
     *
     * Two things have to hold, and they are the whole feature:
     *
     *  - a find by one bee reaches the other, so they are working ONE board;
     *  - both are given the SAME roll, so two people who did the same work on
     *    the same flower are told the same thing about it. One roll each would
     *    also quietly change the failure rate the whole game is built on.
     */
    const sockets: WebSocket[] = [];

    const open = async (who: string) => {
      const socket = new WebSocket(
        `ws://${PARTY_HOST}/parties/garden/garden-schenley?ticket=${encodeURIComponent(
          await partyTicket(who),
        )}`,
      );

      const seen: CoopView[] = [];

      socket.addEventListener("message", (event) => {
        const message = JSON.parse(String(event.data)) as {
          t: string;
          session?: CoopView;
        };

        if (message.t === "coop" && message.session) {
          seen.push(message.session);
        }
      });

      await new Promise<void>((resolve) =>
        socket.addEventListener("open", () => resolve()),
      );

      sockets.push(socket);

      return { socket, seen };
    };

    const settle = () => new Promise((resolve) => setTimeout(resolve, 700));
    const latest = (seen: CoopView[]) => seen[seen.length - 1];

    try {
      const ada = await open("coop-ada");
      const bo = await open("coop-bo");

      await settle();

      // The same stalk, by scatter key.
      const stalk = "frick:black-eyed-susan:3";

      ada.socket.send(
        JSON.stringify({ t: "workOn", instance: stalk, plant: "black-eyed-susan" }),
      );
      await settle();

      expect(latest(ada.seen)?.members).toHaveLength(1);
      expect(
        bo.seen,
        "a flower nobody else is on was announced to the room",
      ).toHaveLength(0);

      bo.socket.send(
        JSON.stringify({ t: "workOn", instance: stalk, plant: "black-eyed-susan" }),
      );
      await settle();

      expect(latest(ada.seen).members).toHaveLength(2);
      expect(latest(bo.seen).members).toHaveLength(2);

      // ONE roll, and it is the same one on both sides.
      expect(
        latest(bo.seen).roll,
        "the two bees were given different rolls",
      ).toBe(latest(ada.seen).roll);

      const roll = latest(ada.seen).roll;

      // A floret Ada turns over is turned over for Bo.
      ada.socket.send(
        JSON.stringify({ t: "found", instance: stalk, token: "f2" }),
      );
      await settle();

      expect(
        latest(bo.seen).finds,
        "a find never reached the other bee",
      ).toContain("f2");

      // And it is a set: the same find twice does not count twice.
      bo.socket.send(
        JSON.stringify({ t: "found", instance: stalk, token: "f2" }),
      );
      await settle();

      expect(latest(ada.seen).finds.filter((f) => f === "f2")).toHaveLength(1);

      /**
       * And the roll does not drift while the board is being worked.
       *
       * This is the assertion with teeth. "Both were given the same number" is
       * true by construction of a shared session and would pass against a
       * server that redrew it constantly, so long as it told everybody. What
       * would actually break the game is a roll that changes underneath a
       * half-finished board, because then the outcome depends on the moment you
       * happen to finish rather than on the work.
       */
      expect(
        latest(ada.seen).roll,
        "the roll changed while the flower was being worked",
      ).toBe(roll);
      expect(latest(bo.seen).roll).toBe(roll);

      /**
       * Leaving takes you off the flower.
       *
       * Asked of BO, not of Ada. The room tells the bees still standing on a
       * flower and nobody else, so Ada cannot witness her own departure: an
       * earlier version of this checked Ada's last message and failed, because
       * her last message was from when she was still on it. The server was
       * right and the assertion was looking in the wrong place.
       */
      ada.socket.send(JSON.stringify({ t: "stopWorking", instance: stalk }));
      await settle();

      expect(
        latest(bo.seen).members.map((member) => member.sub),
        "a bee that left is still on the flower",
      ).toEqual(["coop-bo"]);

      // A different stalk is a different job, even for the same species.
      bo.socket.send(
        JSON.stringify({
          t: "workOn",
          instance: "frick:black-eyed-susan:9",
          plant: "black-eyed-susan",
        }),
      );
      await settle();

      expect(
        latest(bo.seen).instance,
        "two different stalks were treated as one flower",
      ).toBe("frick:black-eyed-susan:9");
      expect(latest(bo.seen).finds, "finds leaked between stalks").toEqual([]);
    } finally {
      for (const socket of sockets) {
        socket.close();
      }
    }
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
        `ws://${PARTY_HOST}/parties/garden/${room}?ticket=${encodeURIComponent(
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
        `ws://${PARTY_HOST}/parties/garden/${room}?ticket=${encodeURIComponent(
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
      `ws://${PARTY_HOST}/parties/garden/${room}?ticket=${encodeURIComponent(
        await partyTicket("twice"),
      )}`,
    );

    await new Promise<void>((resolve) =>
      first.addEventListener("open", () => resolve()),
    );

    await expect.poll(() => roomCount(room)).toBe(1);

    /**
     * The old tab is expected to be TOLD it has been replaced.
     *
     * This watched for a socket close first, and that is the wrong thing to
     * watch: workerd leaves a hibernatable socket in CLOSING and never
     * completes the handshake, so the far end sees `readyState` change and
     * receives no close event at all. A tab that is half-shut and does not know
     * it is exactly the bug this is here to prevent, so the guarantee has to be
     * a message the client can act on rather than a transport state it might
     * never observe.
     */
    const firstToldReplaced = new Promise<boolean>((resolve) => {
      first.addEventListener("message", (event) => {
        const message = JSON.parse(String(event.data)) as {
          t: string;
          reason?: string;
        };

        if (message.t === "refused" && message.reason === "replaced") {
          resolve(true);
        }
      });
      setTimeout(() => resolve(false), 10_000);
    });

    const second = new WebSocket(
      `ws://${PARTY_HOST}/parties/garden/${room}?ticket=${encodeURIComponent(
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
      await firstToldReplaced,
      "the replaced tab was never told it had been replaced",
    ).toBe(true);

    first.close();
    second.close();

    await expect.poll(() => roomCount(room), { timeout: 15_000 }).toBe(0);
  });
});
