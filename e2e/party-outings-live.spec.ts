import { expect, test, type Browser, type Page } from "@playwright/test";

import {
  PARTY_HOST,
  dismissTutorial,
  flyTo,
  heading,
  hold,
  nameThePlayer,
  partyTicket,
  position,
  readout,
  resetProgress,
  signIn,
} from "./helpers";
import { COURSES, raceGates } from "../party/games/courses";
import { slideRide } from "../src/features/game/world/slide-ride";
import { setActivePark } from "../src/features/game/world/terrain";
import type { OutingView, Pose, TableView } from "../party/protocol";

/**
 * Races and hide and seek, against the real room.
 *
 * The rules are tested as arithmetic in `party-outings.spec.ts`. What is here
 * is the part arithmetic cannot reach: that the room really does referee from
 * the poses it relays, that its clock really is the pose stream, and that a
 * seeker who is counting is really sent nothing.
 *
 * Positions come from raw sockets wherever the test needs a bee to be
 * somewhere in particular. A socket can say it is anywhere. A browser bee can
 * only get there by flying, and reads where it is from the debug readout.
 */

type Heard = { sub: string; pose: Pose; at: number };

/** A raw player: a socket that keeps what the room has told it. */
async function rawBee(room: string, who: string) {
  const socket = new WebSocket(
    `ws://${PARTY_HOST}/parties/garden/${room}?ticket=${encodeURIComponent(
      await partyTicket(who),
    )}`,
  );
  const state = {
    outings: [] as OutingView[],
    tables: [] as TableView[],
    heard: [] as Heard[],
    welcome: null as null | { players: { sub: string; pose: Pose | null }[] },
    /** The room's clock, minus this machine's, when it last said. */
    skew: 0,
  };
  let hovering: ReturnType<typeof setInterval> | null = null;

  socket.addEventListener("message", (event) => {
    const message = JSON.parse(String(event.data)) as Record<string, unknown> & { t: string };

    if (message.t === "outings") {
      state.outings = message.outings as OutingView[];
      state.skew = (message.now as number) - Date.now();
    } else if (message.t === "tables") {
      state.tables = message.tables as TableView[];
    } else if (message.t === "pos") {
      state.heard.push({
        sub: message.sub as string,
        pose: message.pose as Pose,
        at: Date.now(),
      });
    } else if (message.t === "welcome") {
      state.welcome = message as unknown as typeof state.welcome;
    }
  });

  await new Promise<void>((resolve, reject) => {
    socket.addEventListener("open", () => resolve());
    socket.addEventListener("error", () => reject(new Error(`${who} could not join ${room}`)));
  });

  const send = (message: Record<string, unknown>) => {
    if (socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify(message));
    }
  };
  const say = (x: number, z: number, altitude = 60) =>
    send({ t: "pos", pose: { x, z, altitude, heading: 0, gesture: "none" } });

  return {
    who,
    state,
    send,
    say,
    /**
     * Stay somewhere, saying so ten times a second.
     *
     * Which is what a real tab does, and it matters: the room keeps time by
     * the poses it hears, so a room full of silent sockets has no clock.
     */
    hover(x: number, z: number, altitude = 60) {
      if (hovering) {
        clearInterval(hovering);
      }

      say(x, z, altitude);
      hovering = setInterval(() => say(x, z, altitude), 100);
    },
    /** Fly in a straight line, a pose every nine units, as a boosting bee does. */
    async flyTo(from: { x: number; z: number }, to: { x: number; z: number }, altitude = 60) {
      if (hovering) {
        clearInterval(hovering);
        hovering = null;
      }

      const distance = Math.hypot(to.x - from.x, to.z - from.z);
      const steps = Math.max(1, Math.ceil(distance / 9));

      for (let step = 1; step <= steps; step += 1) {
        say(
          from.x + ((to.x - from.x) * step) / steps,
          from.z + ((to.z - from.z) * step) / steps,
          altitude,
        );
        await new Promise((resolve) => setTimeout(resolve, 12));
      }
    },
    /** Say nothing more. A tab that has been put behind another one. */
    still() {
      if (hovering) {
        clearInterval(hovering);
        hovering = null;
      }
    },
    /** The round this player is in, if any. */
    mine: () =>
      state.outings.find((outing) =>
        outing.members.some((member) => member.sub === who),
      ),
    close() {
      if (hovering) {
        clearInterval(hovering);
      }

      socket.close();
    },
  };
}

type RawBee = Awaited<ReturnType<typeof rawBee>>;

const OUTING = { t: "outing" } as const;

test.describe("a race, refereed by the room", () => {
  const start = COURSES.frick.sprint.start;

  test("starts five seconds after it is begun, with nobody doing anything but flying", async () => {
    test.setTimeout(60_000);

    const ada = await rawBee("garden-frick", "race-clock-ada");
    const bo = await rawBee("garden-frick", "race-clock-bo");

    try {
      ada.hover(start.x, start.z);
      bo.hover(start.x + 4, start.z);

      ada.send({ ...OUTING, do: "open", kind: "race", course: "sprint" });
      await expect.poll(() => ada.mine()?.phase).toBe("gathering");

      const id = ada.mine()!.id;

      // Everybody in the room is told, and not only whoever opened it.
      await expect.poll(() => bo.state.outings.map((round) => round.id)).toContain(id);

      bo.send({ ...OUTING, do: "join", id });
      await expect.poll(() => bo.mine()?.members.length).toBe(2);

      // Not the host.
      bo.send({ ...OUTING, do: "begin", id });
      await new Promise((resolve) => setTimeout(resolve, 700));
      expect(ada.mine()?.phase).toBe("gathering");

      ada.send({ ...OUTING, do: "begin", id });
      await expect.poll(() => ada.mine()?.phase).toBe("countdown");

      const begun = Date.now();
      const round = ada.mine()!;

      // The deadline is in the room's time, and the message says what time
      // the room thinks it is, so a screen can draw the count from either.
      expect(round.deadline - round.since).toBe(5000);
      expect(Math.abs(ada.state.skew)).toBeLessThan(2000);

      await expect
        .poll(() => bo.mine()?.phase, { timeout: 15_000, intervals: [50] })
        .toBe("running");

      const waited = Date.now() - begun;

      // No alarm is involved. The room noticed the count had run out because
      // these two were still saying where they were.
      expect(waited, "the countdown was not five seconds").toBeGreaterThan(4500);
      expect(waited, "the countdown was not five seconds").toBeLessThan(7500);
      expect(ada.mine()!.race!.startedAt).toBeGreaterThan(0);
    } finally {
      ada.close();
      bo.close();
    }
  });

  test("is finished by flying every gate in order, and not by flying some of them", async () => {
    test.setTimeout(120_000);

    const ada = await rawBee("garden-schenley", "race-fly-ada");
    const bo = await rawBee("garden-schenley", "race-fly-bo");
    const course = COURSES.schenley.sprint;

    try {
      ada.hover(course.start.x, course.start.z);
      bo.hover(course.start.x, course.start.z + 5);

      ada.send({ ...OUTING, do: "open", kind: "race", course: "sprint" });
      await expect.poll(() => ada.mine()?.id).toBeTruthy();

      const id = ada.mine()!.id;

      bo.send({ ...OUTING, do: "join", id });
      await expect.poll(() => ada.mine()?.members.length).toBe(2);
      ada.send({ ...OUTING, do: "begin", id });
      await expect
        .poll(() => ada.mine()?.phase, { timeout: 15_000, intervals: [50] })
        .toBe("running");

      const gates = raceGates("schenley", ada.mine()!.race!);

      // Bo cuts the first gate and flies the rest of the lap. The next gate is
      // always the one he skipped, so none of them count.
      const cutting = (async () => {
        let from = { x: course.start.x, z: course.start.z + 5 };

        for (const gate of gates.slice(1)) {
          // Wide of the first gate on the way to the second.
          await bo.flyTo(from, gate, 60);
          from = gate;
        }

        bo.hover(from.x, from.z);
      })();

      let from = { x: course.start.x, z: course.start.z };

      for (let lap = 0; lap < course.laps; lap += 1) {
        for (const gate of gates) {
          // The two under-bridge gates only count below the deck.
          await ada.flyTo(from, gate, gate.top === undefined ? 60 : gate.top - 20);
          from = gate;
        }
      }

      ada.hover(from.x, from.z);
      await cutting;

      await expect
        .poll(() => ada.mine()?.race?.progress[ada.who]?.finishedIn ?? null)
        .not.toBeNull();

      const progress = ada.mine()!.race!.progress;

      expect(progress[ada.who].gates).toBe(gates.length * course.laps);
      expect(progress[ada.who].finishedIn).toBeGreaterThan(0);
      expect(progress[bo.who], "a racer who skipped the first gate was given the rest").toEqual({
        gates: 0,
        finishedIn: null,
      });
      // Bo is still out, so it is not over.
      expect(ada.mine()!.phase).toBe("running");

      // He gives up, and that is everybody home.
      bo.send({ ...OUTING, do: "leave", id });
      await expect.poll(() => ada.mine()?.phase).toBe("done");
    } finally {
      ada.close();
      bo.close();
    }
  });

  test("is one thing at a time: no racing from a chair, and no chair from a race", async () => {
    test.setTimeout(60_000);

    const ada = await rawBee("garden-highland", "one-thing-ada");
    const bo = await rawBee("garden-highland", "one-thing-bo");
    const settle = () => new Promise((resolve) => setTimeout(resolve, 700));

    try {
      ada.hover(-30, 190);
      bo.hover(-30, 190);

      // Ada sits down to a board, and then asks for a race.
      ada.send({ t: "open", kind: "tictactoe" });
      await expect.poll(() => ada.state.tables.length).toBe(1);
      ada.send({ ...OUTING, do: "open", kind: "hide", seeker: "me" });
      await settle();
      expect(ada.state.outings, "a round was opened from a chair").toEqual([]);

      // Bo opens a round, and then asks for a chair, two ways.
      bo.send({ ...OUTING, do: "open", kind: "hide", seeker: "me" });
      await expect.poll(() => bo.mine()?.id).toBeTruthy();

      const id = bo.mine()!.id;

      bo.send({ t: "open", kind: "connect4" });
      bo.send({ t: "sit", table: ada.state.tables[0].id });
      await settle();
      expect(ada.state.tables).toHaveLength(1);
      expect(ada.state.tables[0].seats, "a racer was given a chair").toEqual([ada.who]);

      // And Ada cannot join Bo's round from hers.
      ada.send({ ...OUTING, do: "join", id });
      await settle();
      expect(bo.mine()!.members.map((member) => member.sub)).toEqual([bo.who]);
    } finally {
      ada.close();
      bo.close();
    }
  });

  test("passes to the next bee when its host goes, and is gone when they all have", async () => {
    test.setTimeout(60_000);

    const ada = await rawBee("garden-highland", "host-ada");
    const bo = await rawBee("garden-highland", "host-bo");
    const watcher = await rawBee("garden-highland", "host-watcher");

    try {
      ada.hover(-30, 190);
      bo.hover(-30, 190);
      watcher.hover(0, 0);

      ada.send({ ...OUTING, do: "open", kind: "hide", seeker: "anyone" });
      await expect.poll(() => ada.mine()?.id).toBeTruthy();
      bo.send({ ...OUTING, do: "join", id: ada.mine()!.id });
      await expect.poll(() => watcher.state.outings[0]?.members.length).toBe(2);

      // A closed socket, and not a polite Leave.
      ada.close();
      await expect
        .poll(() => watcher.state.outings[0]?.members.map((member) => member.sub))
        .toEqual([bo.who]);

      bo.close();
      await expect.poll(() => watcher.state.outings).toEqual([]);
    } finally {
      ada.close();
      bo.close();
      watcher.close();
    }
  });
});

test.describe("leaving a round", () => {
  test("is never refused, however many buttons you have pressed", async () => {
    /**
     * Everything asked of a round is on a budget of twelve in ten seconds.
     * Leave was too, and Leave is shown as done on your own screen the moment
     * you press it. So one dropped by the budget left you out of the round as
     * far as you could see and in it as far as anybody else could: a racer who
     * would never finish, who could start nothing new, and who had no button
     * left to press about it.
     */
    test.setTimeout(60_000);

    const ada = await rawBee("garden-highland", "leave-ada");
    const watcher = await rawBee("garden-highland", "leave-watcher");

    try {
      ada.hover(-30, 190);
      watcher.hover(0, 0);

      ada.send({ ...OUTING, do: "open", kind: "hide", seeker: "me" });
      await expect.poll(() => ada.mine()?.id).toBeTruthy();

      const id = ada.mine()!.id;

      // Well over the budget, on things the room will refuse anyway.
      for (let press = 0; press < 20; press += 1) {
        ada.send({ ...OUTING, do: "begin", id });
      }

      // The budget is spent: another round cannot be asked for.
      ada.send({ ...OUTING, do: "leave", id });
      await expect
        .poll(() => watcher.state.outings, { message: "a Leave was dropped by the rate limit" })
        .toEqual([]);

      // And it really was spent, or this test proves nothing: asking for a
      // new round straight away gets no answer.
      ada.send({ ...OUTING, do: "open", kind: "hide", seeker: "me" });
      await new Promise((resolve) => setTimeout(resolve, 700));
      expect(watcher.state.outings).toEqual([]);
    } finally {
      ada.close();
      watcher.close();
    }
  });
});

test.describe("hide and seek, refereed by the room", () => {
  test("sends a counting seeker nothing about the hiders, and everybody else everything", async () => {
    test.setTimeout(90_000);

    const room = "garden-frick";
    const ada = await rawBee(room, "blind-ada");
    const bo = await rawBee(room, "blind-bo");
    const watcher = await rawBee(room, "blind-watcher");
    let second: RawBee | null = null;

    try {
      ada.hover(-180, 155);
      bo.hover(-170, 150);
      watcher.hover(-160, 150);

      ada.send({ ...OUTING, do: "open", kind: "hide", seeker: "me" });
      await expect.poll(() => ada.mine()?.id).toBeTruthy();

      const id = ada.mine()!.id;

      bo.send({ ...OUTING, do: "join", id });
      await expect.poll(() => ada.mine()?.members.length).toBe(2);

      // Before it begins, Ada hears Bo like anybody else.
      await expect
        .poll(() => ada.state.heard.some((heard) => heard.sub === bo.who))
        .toBe(true);

      ada.send({ ...OUTING, do: "begin", id });
      await expect.poll(() => ada.mine()?.phase).toBe("hiding");

      const round = ada.mine()!;
      const area = COURSES.frick.hide[round.hide!.area];

      expect(round.hide!.seekers).toEqual([ada.who]);
      expect(round.hide!.hiders).toEqual([bo.who]);

      // Bo goes and hides. Let anything already on the wire arrive first.
      bo.hover(area.x + 10, area.z, area.top - 40);
      await new Promise((resolve) => setTimeout(resolve, 500));

      const adaFrom = ada.state.heard.length;
      const watcherFrom = watcher.state.heard.length;

      await new Promise((resolve) => setTimeout(resolve, 2000));

      const leaked = ada.state.heard.slice(adaFrom).filter((heard) => heard.sub === bo.who);
      const seen = watcher.state.heard.slice(watcherFrom).filter((heard) => heard.sub === bo.who);

      expect(leaked, "the seeker was sent where a hider is while counting").toEqual([]);
      // Somebody who is not playing is sent it as usual. Without this the test
      // would pass against a room that had simply stopped relaying Bo.
      expect(seen.length).toBeGreaterThan(5);

      // A second tab for the seeker is welcomed with everybody's last pose.
      // Everybody but the hiders.
      second = await rawBee(room, ada.who);
      await expect.poll(() => second!.state.welcome).not.toBeNull();

      const welcomed = second.state.welcome!.players;

      expect(welcomed.find((player) => player.sub === bo.who)?.pose, "the welcome gave the hider away").toBeNull();
      expect(welcomed.find((player) => player.sub === watcher.who)?.pose).not.toBeNull();

      second.hover(-180, 155);

      // Bo says he is hidden and then says nothing more at all: a hider who
      // has hidden and gone to look at another tab. The count ends, and the
      // seeker is told where he is without his sending anything.
      bo.still();
      await new Promise((resolve) => setTimeout(resolve, 400));

      const from = second.state.heard.length;

      bo.send({ ...OUTING, do: "ready", id });
      await expect.poll(() => second!.mine()?.phase).toBe("seeking");
      await expect
        .poll(
          () => second!.state.heard.slice(from).find((heard) => heard.sub === bo.who)?.pose,
          { message: "a seeker was never told where a silent hider was" },
        )
        .toMatchObject({ x: area.x + 10, z: area.z });

      // He was inside the hiding place, so he is still hidden.
      expect(second.mine()!.hide!.hiders).toEqual([bo.who]);
    } finally {
      ada.close();
      bo.close();
      watcher.close();
      second?.close();
    }
  });

  test("is played to the end: found, joined the seekers, found the last one", async () => {
    test.setTimeout(90_000);

    const room = "garden-schenley";
    const ada = await rawBee(room, "seek-ada");
    const bo = await rawBee(room, "seek-bo");
    const cy = await rawBee(room, "seek-cy");

    try {
      ada.hover(-150, 30);
      bo.hover(-150, 34);
      cy.hover(-150, 38);

      ada.send({ ...OUTING, do: "open", kind: "hide", seeker: "me" });
      await expect.poll(() => ada.mine()?.id).toBeTruthy();

      const id = ada.mine()!.id;

      // One at a time. Two sockets that ask at once are answered in whichever
      // order the room heard them, and the order they joined in is the order
      // the hiders are listed in below.
      bo.send({ ...OUTING, do: "join", id });
      await expect.poll(() => ada.mine()?.members.length).toBe(2);
      cy.send({ ...OUTING, do: "join", id });
      await expect.poll(() => ada.mine()?.members.length).toBe(3);
      ada.send({ ...OUTING, do: "begin", id });
      await expect.poll(() => ada.mine()?.phase).toBe("hiding");

      const area = COURSES.schenley.hide[ada.mine()!.hide!.area];
      const low = area.top - 40;
      const boAt = { x: area.x - 30, z: area.z };
      const cyAt = { x: area.x + 30, z: area.z };

      bo.hover(boAt.x, boAt.z, low);
      cy.hover(cyAt.x, cyAt.z, low);
      await new Promise((resolve) => setTimeout(resolve, 400));

      bo.send({ ...OUTING, do: "ready", id });
      await new Promise((resolve) => setTimeout(resolve, 400));
      // One hider ready is not all of them.
      expect(ada.mine()!.phase).toBe("hiding");
      cy.send({ ...OUTING, do: "ready", id });
      await expect.poll(() => ada.mine()?.phase).toBe("seeking");
      expect(ada.mine()!.hide!.hiders).toEqual([bo.who, cy.who]);

      // Ada flies to where Bo is.
      ada.hover(boAt.x + 2, boAt.z, low);
      await expect.poll(() => ada.mine()?.hide?.seekers).toEqual([ada.who, bo.who]);
      expect(ada.mine()!.hide!.found[0]).toMatchObject({ sub: bo.who, by: ada.who, why: "found" });
      expect(ada.mine()!.phase).toBe("seeking");

      // Bo, now a seeker, flies to Cy, and after a moment's grace finds her.
      bo.hover(cyAt.x - 2, cyAt.z, low);
      await expect.poll(() => ada.mine()?.phase, { timeout: 15_000 }).toBe("done");

      const over = ada.mine()!;

      expect(over.hide!.found.map((entry) => [entry.sub, entry.by])).toEqual([
        [bo.who, ada.who],
        [cy.who, bo.who],
      ]);
      expect(over.hide!.hiders).toEqual([]);
      expect(over.ended).toBeUndefined();

      // Nothing in what the room sent says where anybody settled.
      expect(JSON.stringify(over)).not.toContain("anchors");
    } finally {
      ada.close();
      bo.close();
      cy.close();
    }
  });
});

/* ------------------------------------------------------------------ *
 * With a real browser in the round
 * ------------------------------------------------------------------ */

/** A signed-in page with its own account, in its own context. */
async function playerPage(browser: Browser, who: string): Promise<Page> {
  const context = await browser.newContext();
  const name = who[0].toUpperCase() + who.slice(1);

  await nameThePlayer(`outing-${who}`, `outing-${who}@example.com`, name);
  await signIn(context, `outing-${who}`, `outing-${who}@example.com`, name);

  const page = await context.newPage();

  await page.goto("/");
  await resetProgress(`outing-${who}`);

  return page;
}

/** Into a party, with the debug readout on and the Games panel open. */
async function intoParty(page: Page, park: "Frick" | "Schenley" | "Highland", extra = "") {
  await page.goto(`/parties?debug=1&hour=12&month=7${extra}`);
  await page.getByRole("button", { name: new RegExp(`Join the ${park}`) }).click();
  await page.waitForURL(/\/play/);
  await page.waitForTimeout(2500);
  await dismissTutorial(page);
  await page.waitForTimeout(600);
  await page.getByRole("button", { name: /^Games/ }).click();
}

async function where(page: Page) {
  const state = await readout(page);

  return {
    ...position(state),
    altitude: Number.parseFloat(state.Altitude ?? "0"),
    heading: heading(state),
    speed: Number.parseFloat(state.Speed ?? "0"),
  };
}

/** How far the bee flies while a key is held. */
async function flown(page: Page, key: string, ms: number) {
  const before = await where(page);

  await hold(page, key, ms);
  await page.waitForTimeout(300);

  const after = await where(page);

  return Math.hypot(after.x - before.x, after.z - before.z);
}

/** Turn to face a point, by the readout, until it is dead ahead. */
async function face(page: Page, target: { x: number; z: number }) {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const here = await where(page);
    let turn = Math.atan2(target.x - here.x, -(target.z - here.z)) - here.heading;

    while (turn > Math.PI) turn -= Math.PI * 2;
    while (turn <= -Math.PI) turn += Math.PI * 2;

    if (Math.abs(turn) < 0.05) {
      return;
    }

    await hold(page, turn > 0 ? "ArrowRight" : "ArrowLeft", Math.max(40, (Math.abs(turn) / 2) * 1000));
  }
}

/** The gate columns that are lit, as the scene graph has them. */
function litGates(page: Page) {
  return page.evaluate(() => {
    const scene = (window as unknown as {
      __scoutScene?: { traverse: (visit: (node: { userData: Record<string, unknown> }) => void) => void };
    }).__scoutScene;
    let lit: number[][] | null = null;

    scene?.traverse((node) => {
      if (Array.isArray(node.userData.outingGates)) {
        lit = node.userData.outingGates as number[][];
      }
    });

    return lit as number[][] | null;
  });
}

/** Where somebody else's bee is drawn, or null if it is not drawn at all. */
function drawn(page: Page, sub: string) {
  return page.evaluate((who) => {
    const scene = (window as unknown as {
      __scoutScene?: {
        traverse: (
          visit: (node: {
            userData: Record<string, unknown>;
            visible: boolean;
            position: { x: number; y: number; z: number };
          }) => void,
        ) => void;
      };
    }).__scoutScene;
    let at: { x: number; y: number; z: number } | null = null;

    scene?.traverse((node) => {
      if (node.userData.remoteBee === who && node.visible) {
        at = { x: node.position.x, y: node.position.y, z: node.position.z };
      }
    });

    return at as { x: number; y: number; z: number } | null;
  }, sub);
}

/**
 * Highland's third hiding place, and why the tests wait for it.
 *
 * The room draws the hiding place at random, and a browser bee cannot be put
 * anywhere: it has to fly. This is the one hiding place in any park whose edge
 * is a short hop from where you arrive, twenty-odd units, so it is the one a
 * test can reach inside the count. The others are a hundred and fifty away.
 */
const NEAR = COURSES.highland.hide[2];

/**
 * A pause between tries at drawing it.
 *
 * Each try is three requests from one player, open, begin and leave, and the
 * room takes twelve in ten seconds from anybody before it stops listening.
 * Tried as fast as the room would answer, a run of bad draws went over that
 * on about the fifth: the next "open" was dropped without a word, the Join
 * button it should have produced never appeared, and the test sat waiting for
 * it until its own five minutes ran out.
 */
const unhurried = () => new Promise((resolve) => setTimeout(resolve, 2700));

test.describe("the Games panel, with a mouse", () => {
  /**
   * The list of things to start is longer than the panel that holds it, on
   * anything the size of a laptop, and the rounds out in the park are at the
   * bottom of it. The panel scrolls. But the park takes the wheel for climbing
   * and diving, from anywhere on the page, so a wheel over the panel moved the
   * bee and left the list where it was: the buttons for a race and for hide
   * and seek could be seen by nobody who did not think to press Tab.
   *
   * Every other test here presses those buttons through Playwright, which
   * scrolls a button into view before it clicks it, and so never noticed.
   * This one uses the wheel, and clicks where the button actually is.
   */
  test("the wheel scrolls the list, to the rounds at the bottom of it, and does not fly the bee", async ({ browser }) => {
    test.setTimeout(180_000);

    const page = await playerPage(browser, "wheeler");

    try {
      await intoParty(page, "Frick");

      const last = page.getByRole("button", { name: /Hide and seek: pick a seeker/ });

      /** The list's own scrolling box, and where the last button is in it. */
      const measure = () =>
        last.evaluate((button) => {
          let box: HTMLElement | null = button.parentElement;

          while (box && !/(auto|scroll)/.test(getComputedStyle(box).overflowY)) {
            box = box.parentElement;
          }

          const list = box!.getBoundingClientRect();
          const mine = button.getBoundingClientRect();

          return {
            x: list.left + list.width / 2,
            y: list.top + list.height / 2,
            scrolled: box!.scrollTop,
            overflows: box!.scrollHeight - box!.clientHeight,
            // To the pixel: boxes are measured in fractions of one.
            inView: mine.top >= list.top - 1 && mine.bottom <= list.bottom + 1,
            button: { x: mine.left + mine.width / 2, y: mine.top + mine.height / 2 },
            page: window.scrollY,
          };
        });

      const before = await measure();

      expect(before.overflows, "the list fits now, so this test is about nothing").toBeGreaterThan(40);
      expect(before.inView, "the last button was in view without scrolling").toBe(false);

      const height = (await where(page)).altitude;

      await page.mouse.move(before.x, before.y);

      for (let turn = 0; turn < 8; turn += 1) {
        await page.mouse.wheel(0, 200);
        await page.waitForTimeout(120);
      }

      const after = await measure();

      expect(after.scrolled, "the wheel did not scroll the list").toBeGreaterThan(40);
      expect(after.inView, "the rounds at the bottom of the list were never reached").toBe(true);
      // The page under the park did not go anywhere, at the end of the list
      // or before it.
      expect(after.page).toBe(0);
      await page.waitForTimeout(600);
      expect(
        Math.abs((await where(page)).altitude - height),
        "scrolling the list flew the bee",
      ).toBeLessThan(1.5);

      // And the button is where it looks to be: pressed with the mouse.
      await page.mouse.click(after.button.x, after.button.y);
      await expect(page.getByRole("region", { name: "Hide and seek" })).toContainText("In it: Wheeler");

      // Over the park the wheel is still the wheel: up is up.
      await page.mouse.move(640, 300);

      for (let turn = 0; turn < 6; turn += 1) {
        await page.mouse.wheel(0, -200);
        await page.waitForTimeout(120);
      }

      await page.waitForTimeout(600);
      expect((await where(page)).altitude - height, "the wheel no longer climbs").toBeGreaterThan(3);
    } finally {
      await page.context().close();
    }
  });
});

test.describe("a race, in the hand", () => {
  test("holds you at the start until the room says go, and lights the way", async ({ browser }) => {
    test.setTimeout(180_000);

    const page = await playerPage(browser, "racer");

    try {
      await intoParty(page, "Frick");

      // Nothing lit before anybody has asked for a race.
      expect(await litGates(page)).toEqual([]);

      await page.getByRole("button", { name: /Race: The creek sprint/ }).click();

      const card = page.getByRole("region", { name: "Race: The creek sprint" });

      await expect(card).toContainText("At the start: Racer");

      const start = COURSES.frick.sprint.start;

      // One column, at the start, for the room to find it by.
      await expect.poll(() => litGates(page)).toEqual([[start.x, start.z]]);

      /**
       * Wait before starting it, as somebody waiting for a friend does, and
       * watch every number the countdown shows.
       *
       * The card kept the time from when it was opened until its clock began
       * to tick, so the first thing a countdown showed was five seconds plus
       * however long you had waited, and then five.
       */
      await page.waitForTimeout(6000);
      await page.evaluate(() => {
        const view = window as unknown as { __counts?: number[] };

        view.__counts = [];

        const look = () => {
          const shown = Number(document.querySelector("[role='timer']")?.textContent);

          if (Number.isFinite(shown) && shown > 0) {
            view.__counts!.push(shown);
          }

          if (view.__counts!.length < 400) {
            requestAnimationFrame(look);
          }
        };

        look();
      });

      await card.getByRole("button", { name: "Start the race" }).click();
      await expect(card.getByRole("timer")).toBeVisible();

      // Held. The key is down for two seconds and the bee goes nowhere.
      expect(await flown(page, "ArrowUp", 2000), "a racer flew during the countdown").toBeLessThan(1);

      const counts = await page.evaluate(
        () => (window as unknown as { __counts: number[] }).__counts,
      );

      expect(counts.length, "the countdown was never seen").toBeGreaterThan(0);
      expect(Math.max(...counts), "a five-second countdown showed more than five").toBeLessThanOrEqual(5);

      // The first gate and the one after it, and no others.
      const [first, second] = COURSES.frick.sprint.gates;

      expect(await litGates(page)).toEqual([
        [first.x, first.z],
        [second.x, second.z],
      ]);

      await expect(card.locator("[data-outing='progress']")).toContainText("gate 1 of 8", {
        timeout: 15_000,
      });
      await expect(card).toContainText("Lap 1 of 2");

      // And let go.
      expect(await flown(page, "ArrowUp", 1500), "a racer was still held after go").toBeGreaterThan(15);

      await card.getByRole("button", { name: "Leave" }).click();
      await expect(card).toHaveCount(0);
      await expect.poll(() => litGates(page)).toEqual([]);
      // Back to the lobby, where another can be started.
      await expect(page.getByRole("button", { name: /Quick dash/ })).toBeVisible();
    } finally {
      await page.context().close();
    }
  });

  test("is flown at the bee's speed, whatever you fly and whatever the weather", async ({ browser }) => {
    test.setTimeout(180_000);

    const page = await playerPage(browser, "moth");

    try {
      // A moth, which is the fastest thing in the game, in the rain, which
      // slows anything without a coat on.
      await page.evaluate(() =>
        window.localStorage.setItem(
          "scout-game-state",
          JSON.stringify({
            version: 0,
            state: { owner: "outing-moth", pollinator: { type: "moth" } },
          }),
        ),
      );
      await intoParty(page, "Frick", "&weather=rain");

      /** The fastest the readout says while boosting forward. */
      const topSpeed = async () => {
        let top = 0;

        await page.keyboard.down("ShiftLeft");
        await page.keyboard.down("ArrowUp");

        for (let sample = 0; sample < 10; sample += 1) {
          await page.waitForTimeout(160);
          top = Math.max(top, (await where(page)).speed);
        }

        await page.keyboard.up("ArrowUp");
        await page.keyboard.up("ShiftLeft");
        await page.waitForTimeout(400);

        return top;
      };

      // Coat off. You start with one on, and a coat is what keeps the rain
      // from slowing you.
      await page.keyboard.press("KeyC");

      await page.getByRole("button", { name: /Race: The creek sprint/ }).click();

      const card = page.getByRole("region", { name: "Race: The creek sprint" });

      await card.getByRole("button", { name: "Start the race" }).click();
      await expect(card.locator("[data-outing='progress']")).toBeVisible({ timeout: 15_000 });

      // Up out of the trees, so a trunk is not what sets the speed.
      await hold(page, "KeyE", 2500);

      // 26 x 2.2 = 57.2: neither the moth's 69.8 nor the wet moth's 43.3.
      const racing = await topSpeed();

      expect(racing, "a racing moth was not flying at the bee's speed").toBeGreaterThan(55);
      expect(racing).toBeLessThan(59.5);

      // And out of the race, it is a moth in the rain again.
      await card.getByRole("button", { name: "Leave" }).click();
      await expect(card).toHaveCount(0);

      // 26 x 1.22 (a moth) x 0.62 (wet) x 2.2 (boost) = 43.3.
      const after = await topSpeed();

      expect(after, "the moth in the rain was not the speed this test assumes").toBeGreaterThan(40);
      expect(after).toBeLessThan(47);
    } finally {
      await page.context().close();
    }
  });

  /**
   * A Leave that never reached the room, said again when the connection is
   * back.
   *
   * The screen takes you out of a round the moment you press Leave. If that
   * one frame is lost, on a connection that is dying without having closed,
   * the room still has you in it: a racer who will never finish, on everybody
   * else's screen, with no button left on yours to do anything about it. A
   * connection that comes back before the room has noticed the old one go
   * does not take you out either, because to the room you never left.
   *
   * Both halves are made to happen here. The Leave is dropped on its way out,
   * and the old socket is kept from closing so the new one arrives beside it.
   */
  test("a Leave that was lost is said again when the connection comes back", async ({ browser }) => {
    test.setTimeout(180_000);

    const page = await playerPage(browser, "ghost");
    const watcher = await rawBee("garden-frick", "ghost-watcher");

    try {
      watcher.hover(0, 0);
      await intoParty(page, "Frick");

      await page.getByRole("button", { name: /Race: The creek sprint/ }).click();

      const card = page.getByRole("region", { name: "Race: The creek sprint" });

      await expect(card).toContainText("At the start: Ghost");
      await expect.poll(() => watcher.state.outings[0]?.members.length).toBe(1);

      // The frame is lost on the way out.
      await page.evaluate(() => {
        const live = (
          window as unknown as {
            __scoutPartySocketForTest: { _ws: WebSocket };
          }
        ).__scoutPartySocketForTest._ws;
        const send = live.send.bind(live);

        live.send = (data: Parameters<WebSocket["send"]>[0]) => {
          if (!String(data).includes('"leave"')) {
            send(data);
          }
        };
      });

      await card.getByRole("button", { name: "Leave" }).click();
      await expect(card).toHaveCount(0);

      // Gone from the screen, and the room has heard nothing.
      await page.waitForTimeout(1500);
      expect(watcher.state.outings[0]?.members.map((member) => member.sub)).toEqual(["outing-ghost"]);

      // The connection comes back, and the old one has not yet closed.
      await page.evaluate(() => {
        const socket = (
          window as unknown as {
            __scoutPartySocketForTest: { _ws: WebSocket; reconnect: () => void };
          }
        ).__scoutPartySocketForTest;

        socket._ws.close = () => {};
        socket.reconnect();
      });

      await expect
        .poll(() => watcher.state.outings.length, { timeout: 20_000 })
        .toBe(0);
      // And the round did not come back onto the screen on the way.
      await expect(card).toHaveCount(0);
      await expect(page.getByRole("button", { name: /Quick dash/ })).toBeVisible();
    } finally {
      watcher.close();
      await page.context().close();
    }
  });

  /**
   * A gate with a ceiling, flown by a bee that has to get under it.
   *
   * Two gates in the game only count from under a bridge deck. The rules are
   * held against the park's geometry in `party-outings.spec.ts`, and a socket
   * can say it is under anything. What neither shows is that a bee can be
   * flown there: that there is air under the deck at a height the flight
   * floor allows, and that the height on the card is the height the room
   * judges by. If it could not, the course would have a gate nobody can pass
   * and a race nobody can finish.
   */
  test("a gate under a bridge is passed by a bee that flies under the deck", async ({ browser }) => {
    test.setTimeout(300_000);

    const page = await playerPage(browser, "under");
    const course = COURSES.schenley.sprint;
    const [stones, bridge] = course.gates;

    expect(bridge.top, "this test is about the gate with a ceiling").toBeDefined();

    try {
      await intoParty(page, "Schenley");
      await page.getByRole("button", { name: new RegExp(`Race: ${course.name}`) }).click();

      const card = page.getByRole("region", { name: `Race: ${course.name}` });
      const begin = card.getByRole("button", { name: "Start the race" });

      // The start is thirty units from where you arrive: inside its reach.
      await expect(begin).toBeEnabled();
      await begin.click();

      const progress = card.locator("[data-outing='progress']");

      await expect(progress).toContainText("gate 1 of 7", { timeout: 15_000 });

      // The first gate has no ceiling, and is flown over the trees.
      await flyTo(page, stones);
      await expect(progress).toContainText("gate 2 of 7");

      // Down to under the deck, and along the hollow to the bridge.
      const ceiling = bridge.top! - 6;
      let reached = false;

      for (let step = 0; step < 40 && !reached; step += 1) {
        const here = await where(page);
        const distance = Math.hypot(bridge.x - here.x, bridge.z - here.z);

        if (distance < 8) {
          reached = true;
        } else if (here.altitude > ceiling) {
          await hold(page, "KeyQ", Math.min(2500, ((here.altitude - ceiling + 4) / 17) * 1000));
        } else {
          await face(page, bridge);
          await hold(page, "ArrowUp", Math.max(200, (Math.min(distance * 0.7, 40) / 26) * 1000));
        }
      }

      expect(reached, "the bee never got under the bridge").toBe(true);
      expect((await where(page)).altitude, "the bee was not under the deck").toBeLessThan(bridge.top!);
      await expect(progress).toContainText("gate 3 of 7");
    } finally {
      await page.context().close();
    }
  });

  /**
   * A race begins without anybody who is not at its start, and that has to be
   * said before it happens, to both of them.
   *
   * The card listed every member under "At the start" wherever they were, and
   * told a joiner only that they were waiting. So a joiner who drifted forty
   * units while they waited was dropped as the countdown began, their card gone
   * without a word, and the host flew alone a race they had started for two.
   */
  test("says who has left the start, to the host and to the one who left", async ({ browser }) => {
    test.setTimeout(240_000);

    const start = COURSES.frick.sprint.start;
    const page = await playerPage(browser, "starter");
    const bo = await rawBee("garden-frick", "wander-bo");

    try {
      bo.hover(start.x, start.z);
      await intoParty(page, "Frick");

      await page.getByRole("button", { name: /Race: The creek sprint/ }).click();

      const card = page.getByRole("region", { name: "Race: The creek sprint" });

      await expect(card).toContainText("At the start: Starter");
      await expect.poll(() => bo.state.outings[0]?.id).toBeTruthy();

      const id = bo.state.outings[0].id;

      bo.send({ ...OUTING, do: "join", id });
      await expect(card).toContainText("At the start: Starter, wander-bo.");
      await expect(card.locator("[data-outing='without']")).toHaveCount(0);

      // Bo wanders off. The host is told, and told what starting now means.
      bo.hover(start.x + 90, start.z);
      await expect(card).toContainText("At the start: Starter. On the way: wander-bo.");
      await expect(card.locator("[data-outing='without']")).toHaveText(
        "Started now, it goes without wander-bo.",
      );

      // And back.
      bo.hover(start.x, start.z);
      await expect(card).toContainText("At the start: Starter, wander-bo.");
      await expect(card.locator("[data-outing='without']")).toHaveCount(0);

      // The other way round: the host goes, the race is Bo's, and the browser
      // joins it as anybody would.
      await card.getByRole("button", { name: "Leave" }).click();
      await expect(card).toHaveCount(0);
      await page.getByRole("button", { name: "Join" }).click();
      await expect(card).toContainText("Waiting for wander-bo to start it.");
      await expect(card.locator("[data-outing='away']")).toHaveCount(0);

      // And wanders, as somebody waiting does.
      let gone = 0;

      for (let tries = 0; tries < 6 && gone < 45; tries += 1) {
        await hold(page, "ArrowUp", 1500);

        const here = await where(page);

        gone = Math.hypot(here.x - start.x, here.z - start.z);

        if (gone < 45) {
          // Up against something. Turn and try another way.
          await hold(page, "ArrowRight", 500);
        }
      }

      expect(gone, "the joiner never got away from the start").toBeGreaterThan(45);
      await expect(card.locator("[data-outing='away']")).toContainText("You have left the start");
      await expect(card.locator("[data-outing='away']")).toContainText("or it goes without you");
      await expect(card).toContainText("On the way: Starter.");

      // It starts, and it does go without them: which they had been told.
      bo.send({ ...OUTING, do: "begin", id });
      await expect(card).toHaveCount(0);
      expect(bo.mine()!.members.map((member) => member.sub)).toEqual([bo.who]);
    } finally {
      bo.close();
      await page.context().close();
    }
  });

  /**
   * The whole of a round, with nobody in it but real players.
   *
   * Every other race here has a socket in it somewhere, saying it is wherever
   * the test needs it to be. This one has two browsers and no sockets: one
   * opens a dash, the other joins it from the lobby, both are held, one flies
   * to wherever the room sent them by the columns alone, and both read the
   * result. It is the only test in which a gate is passed by a bee that had to
   * fly to it.
   */
  test("a dash between two real players is flown to the end and read by both", async ({ browser }) => {
    test.setTimeout(300_000);

    const dasher = await playerPage(browser, "dasher");
    const waiter = await playerPage(browser, "waiter");
    const thrown: string[] = [];

    dasher.on("pageerror", (error) => thrown.push(`dasher: ${error.message}`));
    waiter.on("pageerror", (error) => thrown.push(`waiter: ${error.message}`));

    try {
      await intoParty(dasher, "Highland");
      await intoParty(waiter, "Highland");

      await dasher.getByRole("button", { name: /Quick dash/ }).click();

      const card = dasher.getByRole("region", { name: "Race: Quick dash" });

      await expect(card).toContainText("At the start: Dasher");

      // The other player finds it in the lobby and is let in from where they
      // arrived, which is where the dash was opened.
      await waiter.getByRole("button", { name: "Join" }).click();

      const theirs = waiter.getByRole("region", { name: "Race: Quick dash" });

      await expect(theirs).toContainText("Waiting for Dasher to start it.");
      await expect(card).toContainText("At the start: Dasher, Waiter");

      await card.getByRole("button", { name: "Start the race" }).click();

      // Both held, on both screens, by the one countdown.
      await expect(card.getByRole("timer")).toBeVisible();
      await expect(theirs.getByRole("timer")).toBeVisible();
      expect(await flown(waiter, "ArrowUp", 1200), "the one who joined flew during the countdown").toBeLessThan(1);

      await expect(card.locator("[data-outing='progress']")).toContainText("gate 1 of 1", {
        timeout: 15_000,
      });
      await expect(theirs.locator("[data-outing='progress']")).toContainText("gate 1 of 1");

      // Where the room sent them, read off the one column that is lit, and
      // the same column on both screens.
      const lit = await litGates(dasher);

      expect(lit, "a dash lights exactly its one landmark").toHaveLength(1);
      expect(await litGates(waiter)).toEqual(lit);

      const target = { x: lit![0][0], z: lit![0][1] };
      const from = await where(dasher);

      expect(
        Math.hypot(target.x - from.x, target.z - from.z),
        "a dash was sent somewhere near",
      ).toBeGreaterThan(150);

      expect(await flyTo(dasher, target), "the dasher never reached the landmark").toBe(true);

      // Home, by the room's reckoning, on the screen of the one who flew it
      // and on the screen of the one who did not.
      await expect(card).toContainText(/You are home in \d+\.\d s\. Waiting for the others\./, {
        timeout: 15_000,
      });
      await expect(theirs).toContainText(/1\. Dasher/);
      await expect(theirs).toContainText("0 of 1 gates");
      // Nothing left to fly at for the one who is home.
      await expect.poll(() => litGates(dasher)).toEqual([]);

      /**
       * Home, and not waiting about. The button says Done, because the race
       * is done for whoever is home, and pressing it keeps the time in the
       * race: it used to say Leave and take the time with it, so that the
       * next one in read "1." beside their own name.
       */
      await card.getByRole("button", { name: "Done" }).click();
      await expect(card).toHaveCount(0);
      // Free to start the next thing while the other is still out there.
      await expect(dasher.getByRole("button", { name: /Quick dash/ })).toBeVisible();

      await dasher.waitForTimeout(1500);
      await expect(theirs).toContainText(/1\. Dasher/);
      await expect(theirs).toContainText("0 of 1 gates");
      // Still a race to the one in it, with the column still lit.
      expect(await litGates(waiter)).toEqual(lit);

      // The one still out there gives up, and nobody is left to read it to.
      await theirs.getByRole("button", { name: "Leave" }).click();
      await expect(theirs).toHaveCount(0);
      await expect.poll(() => litGates(waiter)).toEqual([]);
      // And nothing of it is left in either lobby.
      await expect(waiter.getByRole("button", { name: /Quick dash/ })).toBeVisible();
      await expect(waiter.getByText("under way")).toHaveCount(0);
      await expect(dasher.getByText("under way")).toHaveCount(0);

      expect(thrown, "something threw during the round").toEqual([]);
    } finally {
      await dasher.context().close();
      await waiter.context().close();
    }
  });
});

test.describe("hide and seek, in the hand", () => {
  test("a seeker who loses the connection while counting is not left held", async ({ browser }) => {
    test.setTimeout(180_000);

    const page = await playerPage(browser, "dropped");
    const bo = await rawBee("garden-schenley", "drop-bo");

    try {
      bo.hover(-150, 30);
      await intoParty(page, "Schenley");

      await page.getByRole("button", { name: /Hide and seek: I will seek/ }).click();

      const card = page.getByRole("region", { name: "Hide and seek" });

      await expect(card).toContainText("In it: Dropped");
      await expect.poll(() => bo.state.outings[0]?.id).toBeTruthy();
      bo.send({ ...OUTING, do: "join", id: bo.state.outings[0].id });
      await card.getByRole("button", { name: "Start hiding" }).click();

      // Counting: the veil is up and the bee is held.
      await expect(page.getByText("Counting. No peeking.")).toBeVisible();
      expect(await flown(page, "ArrowUp", 1200), "the seeker flew while counting").toBeLessThan(1);

      // The connection goes. The count has twenty-five seconds left to run,
      // and nothing is ever going to arrive to end it.
      await page.evaluate(() =>
        (window as unknown as { __scoutPartySocketForTest: { close: () => void } }).__scoutPartySocketForTest.close(),
      );

      await expect
        .poll(() => flown(page, "ArrowUp", 1200), { timeout: 20_000 })
        .toBeGreaterThan(10);
      await expect(page.getByText("Counting. No peeking.")).toHaveCount(0);
    } finally {
      bo.close();
      await page.context().close();
    }
  });

  test("a hider who is hidden cannot move, and can again once found", async ({ browser }) => {
    test.setTimeout(300_000);

    const page = await playerPage(browser, "hider");
    const ada = await rawBee("garden-highland", "hunt-ada");

    try {
      ada.hover(-30, 190, 92);
      await intoParty(page, "Highland");

      const card = page.getByRole("region", { name: "Hide and seek" });

      // Until the room draws the hiding place beside where you arrive.
      for (let attempt = 0; ; attempt += 1) {
        expect(attempt, "the near hiding place never came up").toBeLessThan(30);

        ada.send({ ...OUTING, do: "open", kind: "hide", seeker: "me" });
        await page.getByRole("button", { name: "Join", exact: true }).click();
        await expect(card).toContainText("In it:");
        await expect.poll(() => ada.mine()?.members.length).toBe(2);
        ada.send({ ...OUTING, do: "begin", id: ada.mine()!.id });
        await expect.poll(() => ada.mine()?.phase).toBe("hiding");

        if (ada.mine()!.hide!.area === 2) {
          break;
        }

        // Not that one. The seeker goes home, which ends it.
        ada.send({ ...OUTING, do: "leave", id: ada.mine()!.id });
        await card.getByRole("button", { name: "Done" }).click();
        await expect(card).toHaveCount(0);
        await expect.poll(() => ada.mine()).toBeUndefined();
        await unhurried();
      }

      // Where you arrive is outside the ring, and the card says so and will
      // not take "I am hidden" for an answer.
      await expect(card.locator("[data-outing='outside']")).toBeVisible();
      await expect(card.getByRole("button", { name: "I am hidden" })).toBeDisabled();

      await face(page, NEAR);
      await hold(page, "ArrowUp", 1700);
      await expect(card.locator("[data-outing='outside']")).toHaveCount(0);
      await expect(card.getByRole("button", { name: "I am hidden" })).toBeEnabled();

      /**
       * Up over the trees, still inside the ring. The sky is not a hiding
       * place, and the card has to say THAT: it used to say "outside it: 0
       * ahead", which is the spot directly underneath, and nothing about
       * height at all.
       */
      const low = await where(page);

      await hold(page, "KeyE", ((NEAR.top + 6 - low.altitude) / 17) * 1000 + 500);
      await expect(card.locator("[data-outing='above']")).toContainText("too high");
      await expect(card.locator("[data-outing='outside']")).toHaveCount(0);
      await expect(card.getByRole("button", { name: "I am hidden" })).toBeDisabled();

      // And back down among them.
      await hold(page, "KeyQ", (((await where(page)).altitude - low.altitude) / 17) * 1000 + 300);
      await expect(card.locator("[data-outing='above']")).toHaveCount(0);

      await card.getByRole("button", { name: "I am hidden" }).click();
      await expect(card).toContainText("Hidden.");

      // The only hider is hidden, so the count is over and the seeking is on.
      await expect.poll(() => ada.mine()?.phase).toBe("seeking");
      expect(ada.mine()!.hide!.hiders).toEqual(["outing-hider"]);

      // Let the readout catch up with the bee first. It is redrawn on a tick,
      // and this bee was flying in a third of a second ago: measured at once,
      // the last of that drift read as a hider who flew a unit and a half.
      await page.waitForTimeout(800);
      expect(await flown(page, "ArrowUp", 1500), "a hidden hider flew").toBeLessThan(1);
      // Past the moment the room takes their spot, and still nowhere.
      await page.waitForTimeout(1500);
      expect(await flown(page, "ArrowUp", 1200)).toBeLessThan(1);
      expect(await flown(page, "KeyE", 800), "a hidden hider climbed").toBeLessThan(1);
      expect(ada.mine()!.hide!.hiders, "the room thought a held hider had moved").toEqual(["outing-hider"]);

      // The seeker flies to exactly where the hider is.
      const there = await where(page);

      ada.hover(there.x + 1, there.z, there.altitude);
      await expect(card).toContainText("Everybody found.");
      expect(ada.mine()!.hide!.found[0]).toMatchObject({ sub: "outing-hider", by: ada.who, why: "found" });

      // Found, and free.
      await expect
        .poll(() => flown(page, "ArrowUp", 1200), { timeout: 20_000 })
        .toBeGreaterThan(10);
    } finally {
      ada.close();
      await page.context().close();
    }
  });

  test("a seeker is not shown where anybody went, and finds them by flying there", async ({ browser }) => {
    test.setTimeout(300_000);

    const page = await playerPage(browser, "seeker");
    const bo = await rawBee("garden-highland", "found-bo");

    try {
      bo.hover(-24, 190, 92);
      await intoParty(page, "Highland");

      const card = page.getByRole("region", { name: "Hide and seek" });

      // Bo is beside you, and drawn, before anything starts.
      await expect.poll(() => drawn(page, bo.who), { timeout: 30_000 }).not.toBeNull();

      for (let attempt = 0; ; attempt += 1) {
        expect(attempt, "the near hiding place never came up").toBeLessThan(30);

        await page.getByRole("button", { name: /Hide and seek: I will seek/ }).click();
        await expect(card).toContainText("In it:");
        await expect.poll(() => bo.state.outings.find((round) => round.phase === "gathering")?.id).toBeTruthy();
        bo.send({
          ...OUTING,
          do: "join",
          id: bo.state.outings.find((round) => round.phase === "gathering")!.id,
        });
        await card.getByRole("button", { name: "Start hiding" }).click();
        await expect.poll(() => bo.mine()?.phase).toBe("hiding");

        if (bo.mine()!.hide!.area === 2) {
          break;
        }

        await card.getByRole("button", { name: "Leave" }).click();
        await expect(card).toHaveCount(0);
        bo.send({ ...OUTING, do: "leave", id: bo.mine()!.id });
        await expect.poll(() => bo.mine()).toBeUndefined();
        await unhurried();
      }

      await expect(page.getByText("Counting. No peeking.")).toBeVisible();

      // Bo is no longer drawn at all: not where he was, and not anywhere.
      await expect.poll(() => drawn(page, bo.who)).toBeNull();

      // He hides just inside the ring, on the side you are on.
      const here = await where(page);
      const away = Math.hypot(here.x - NEAR.x, here.z - NEAR.z);
      const spot = {
        x: NEAR.x + ((here.x - NEAR.x) / away) * (NEAR.radius - 4),
        z: NEAR.z + ((here.z - NEAR.z) / away) * (NEAR.radius - 4),
      };

      bo.hover(spot.x, spot.z, here.altitude);
      await page.waitForTimeout(1500);
      expect(await drawn(page, bo.who), "a hider was drawn for the seeker during the count").toBeNull();

      // And having hidden, he stops saying where he is: a hider who has gone
      // to look at another tab. He must still be there to be found.
      bo.still();

      // Watch for the first frame he is drawn in, from inside the page.
      await page.evaluate((who) => {
        const view = window as unknown as {
          __firstSeen?: { x: number; z: number } | null;
          __scoutScene?: {
            traverse: (
              visit: (node: {
                userData: Record<string, unknown>;
                visible: boolean;
                position: { x: number; z: number };
              }) => void,
            ) => void;
          };
        };

        view.__firstSeen = null;

        const look = () => {
          view.__scoutScene?.traverse((node) => {
            if (!view.__firstSeen && node.userData.remoteBee === who && node.visible) {
              view.__firstSeen = { x: node.position.x, z: node.position.z };
            }
          });

          if (!view.__firstSeen) {
            requestAnimationFrame(look);
          }
        };

        look();
      }, bo.who);

      bo.send({ ...OUTING, do: "ready", id: bo.mine()!.id });
      await expect(card).toContainText("1 still hidden");

      const first = await page.waitForFunction(
        () => (window as unknown as { __firstSeen?: { x: number; z: number } | null }).__firstSeen,
        undefined,
        { timeout: 20_000 },
      );
      const seen = (await first.jsonValue()) as { x: number; z: number };

      // Where he hid, and not on the way there from where he set off: a bee
      // easing across the park to its hiding place points straight at it.
      expect(
        Math.hypot(seen.x - spot.x, seen.z - spot.z),
        "the hider was first drawn somewhere other than the hiding spot",
      ).toBeLessThan(5);

      // Close enough to be told so, in a word.
      await expect(card.locator("[data-warmth]")).toHaveText(/warm|hot/);

      await face(page, spot);
      await hold(page, "ArrowUp", 1500);

      await expect(card).toContainText("Everybody found.", { timeout: 20_000 });
      expect(bo.mine()!.hide!.found[0]).toMatchObject({ sub: bo.who, by: "outing-seeker", why: "found" });
    } finally {
      bo.close();
      await page.context().close();
    }
  });

  /**
   * Who found whom, read after the finder has gone home.
   *
   * The row looked the finder up among the members, and a seeker who found
   * one hider and left was "A bee" on every card for the rest of the round.
   * The browser here does nothing at all: it joins, never goes to the hiding
   * place, is caught when the count ends, and is a seeker from then on, which
   * is somebody still in the round to read the card to.
   */
  test("the card still says who found somebody after the finder has gone", async ({ browser }) => {
    test.setTimeout(240_000);

    const page = await playerPage(browser, "reader");
    const ada = await rawBee("garden-schenley", "finder-ada");
    const bo = await rawBee("garden-schenley", "found-bo");
    const cy = await rawBee("garden-schenley", "hidden-cy");

    try {
      ada.hover(-150, 30);
      bo.hover(-150, 34);
      cy.hover(-150, 38);
      await intoParty(page, "Schenley");

      ada.send({ ...OUTING, do: "open", kind: "hide", seeker: "me" });
      await expect.poll(() => ada.mine()?.id).toBeTruthy();

      const id = ada.mine()!.id;

      bo.send({ ...OUTING, do: "join", id });
      await expect.poll(() => ada.mine()?.members.length).toBe(2);
      cy.send({ ...OUTING, do: "join", id });
      await expect.poll(() => ada.mine()?.members.length).toBe(3);
      await page.getByRole("button", { name: "Join", exact: true }).click();
      await expect.poll(() => ada.mine()?.members.length).toBe(4);
      ada.send({ ...OUTING, do: "begin", id });
      await expect.poll(() => ada.mine()?.phase).toBe("hiding");

      const area = COURSES.schenley.hide[ada.mine()!.hide!.area];
      const low = area.top - 40;

      bo.hover(area.x - 30, area.z, low);
      cy.hover(area.x + 30, area.z, low);

      // The browser never says it is hidden, so the count runs its length.
      await expect.poll(() => ada.mine()?.phase, { timeout: 45_000 }).toBe("seeking");

      const card = page.getByRole("region", { name: "Hide and seek" });

      // Caught where it stood, and so one of the seekers.
      await expect(card).toContainText("was not in the hiding place");

      ada.hover(area.x - 30 + 2, area.z, low);
      await expect.poll(() => ada.mine()?.hide?.found.length).toBe(2);
      await expect(card).toContainText("found by finder-ada");

      // The finder goes home. The round goes on: Cy is still out there.
      ada.send({ ...OUTING, do: "leave", id });
      await expect.poll(() => bo.mine()?.members.length).toBe(3);
      expect(bo.mine()!.phase).toBe("seeking");

      await expect(card).toContainText("1 still hidden");
      await expect(card).toContainText("found by finder-ada");
      await expect(card).not.toContainText("A bee");
    } finally {
      ada.close();
      bo.close();
      cy.close();
      await page.context().close();
    }
  });

  /**
   * The Blue Slide owns a bee for three and a half seconds and throws it off
   * the bottom. A hold that only zeroes the stick does nothing about that: a
   * seeker who started the count from the top of the slide was carried ninety
   * units down it and shoved, while the card said they were held.
   */
  test("a hold takes a bee off the Blue Slide, and not down it", async ({ browser }) => {
    test.setTimeout(300_000);

    setActivePark("frick");

    const top = slideRide()!.top;
    const page = await playerPage(browser, "slider");
    const bo = await rawBee("garden-frick", "slide-bo");

    try {
      bo.hover(-180, 155);
      await intoParty(page, "Frick");

      await page.getByRole("button", { name: /Hide and seek: I will seek/ }).click();

      const card = page.getByRole("region", { name: "Hide and seek" });

      await expect(card).toContainText("In it: Slider");
      await expect.poll(() => bo.state.outings[0]?.id).toBeTruthy();
      bo.send({ ...OUTING, do: "join", id: bo.state.outings[0].id });
      await expect(card.getByRole("button", { name: "Start hiding" })).toBeEnabled();

      // To the top of the slide and onto it, as `slide.spec.ts` does.
      await flyTo(page, { x: top.x, z: top.z });

      let caught = false;

      for (let tries = 0; tries < 24 && !caught; tries += 1) {
        const state = await readout(page);

        caught =
          state.Area === "Blue Slide Playground" &&
          Number.parseFloat(state.Altitude ?? "999") < top.y + 6;

        if (!caught) {
          await hold(page, "KeyQ", 280);
        }
      }

      expect(caught, "never caught the top of the slide").toBe(true);

      // Riding. Start the count from here.
      await card.getByRole("button", { name: "Start hiding" }).click();
      await expect(page.getByText("Counting. No peeking.")).toBeVisible();

      const held = await where(page);

      // Longer than the whole ride, so one that was still running has run.
      await page.waitForTimeout(4200);

      const after = await where(page);

      expect(
        Math.hypot(after.x - held.x, after.z - held.z),
        "a counting seeker was carried down the slide",
      ).toBeLessThan(8);
      expect(held.altitude - after.altitude, "a counting seeker slid downhill").toBeLessThan(8);
    } finally {
      bo.close();
      await page.context().close();
    }
  });
});
