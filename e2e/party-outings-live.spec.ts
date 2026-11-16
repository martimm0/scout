import { expect, test, type Browser, type Page } from "@playwright/test";

import {
  PARTY_HOST,
  dismissTutorial,
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

      bo.send({ ...OUTING, do: "join", id });
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
});
