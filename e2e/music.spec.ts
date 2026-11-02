import { expect, test } from "@playwright/test";

import { dismissTutorial, signIn } from "./helpers";

declare global {
  interface Window {
    __notes: { freq: number; type: string; at: number; stop: number }[];
    __hits: number;
    /** Oscillators started, never stopped, and audible: i.e. drones. */
    __drones: () => number;
  }
}

test("the music is varied, and there is nothing droning under it", async ({ page }) => {
  test.setTimeout(90_000);

  // Record every oscillator the game schedules, before any app code runs.
  await page.addInitScript(() => {
    window.__notes = [];
    window.__hits = 0;

    const RealCtx = window.AudioContext;
    const realOsc = RealCtx.prototype.createOscillator;
    const realBuf = RealCtx.prototype.createBufferSource;

    // Trace the audio graph. An oscillator only counts as a drone if it is still
    // running AND its signal actually reaches the speakers: the one oscillator
    // left in the ambience is an LFO wired into a filter's frequency, which is
    // inaudible, and a test that cannot tell those apart is worthless.
    const edges = new Map<object, Set<object>>();
    const running = new Set<AudioNode>();

    const realConnect = AudioNode.prototype.connect;
    AudioNode.prototype.connect = function (this: AudioNode, target: never, ...rest: never[]) {
      let out = edges.get(this);
      if (!out) {
        out = new Set();
        edges.set(this, out);
      }
      out.add(target as unknown as object);

      return realConnect.call(this, target, ...rest) as never;
    };

    window.__drones = () => {
      let count = 0;

      for (const node of running) {
        const seen = new Set<object>();
        const queue: object[] = [node];
        let audible = false;

        while (queue.length) {
          const current = queue.shift()!;
          if (seen.has(current)) continue;
          seen.add(current);

          if (current instanceof AudioDestinationNode) {
            audible = true;
            break;
          }

          for (const next of edges.get(current) ?? []) queue.push(next);
        }

        if (audible) count += 1;
      }

      return count;
    };

    RealCtx.prototype.createOscillator = function (this: AudioContext) {
      const osc = realOsc.call(this);
      const start = osc.start.bind(osc);
      const stop = osc.stop.bind(osc);
      const setValue = osc.frequency.setValueAtTime.bind(osc.frequency);
      let at = 0;
      // The pitch is SCHEDULED, so frequency.value still reads 440 at this point.
      // Catch it where it is actually set.
      let freq = 0;

      osc.frequency.setValueAtTime = (value: number, when: number) => {
        freq = value;
        return setValue(value, when);
      };

      osc.start = (when = 0) => {
        at = when;
        running.add(osc);
        start(when);
      };
      osc.stop = (when = 0) => {
        window.__notes.push({ freq, type: osc.type, at, stop: when });
        running.delete(osc);
        stop(when);
      };

      return osc;
    };

    RealCtx.prototype.createBufferSource = function (this: AudioContext) {
      window.__hits += 1;
      return realBuf.call(this);
    };
  });

  // /play is behind the sign-in now, and a signed-out visit lands on the wall,
  // where there is no Sound button to click and no music to listen to.
  await signIn(page.context());
  await page.addInitScript(() => window.localStorage.clear());
  await page.goto("/play");
  await page.waitForTimeout(2000);

  await dismissTutorial(page);

  // Turn the sound on, then listen for eight seconds of bars.
  // A real user gesture, on a toggle that is currently OFF. Both halves matter:
  // browsers keep an AudioContext suspended until a gesture, so if a persisted
  // setting has already switched sound "on" at load, nothing is actually audible,
  // and clicking then merely turns it off again. That is how these tests came to
  // be earnestly measuring silence.
  await page.getByRole("button", { name: /Sound off/i }).click();
  await expect(page.getByRole("button", { name: /Sound on/i })).toBeVisible();
  await page.waitForTimeout(8000);

  const notes = await page.evaluate(() => window.__notes);
  const hits = await page.evaluate(() => window.__hits);
  const drones = await page.evaluate(() => window.__drones());

  const musical = notes.filter((n) => n.stop > n.at);
  const freqs = musical.map((n) => n.freq);
  const durations = musical.map((n) => n.stop - n.at);

  console.log("notes scheduled:", musical.length);
  console.log("distinct pitches:", new Set(freqs.map((f) => Math.round(f))).size);
  console.log("lowest pitch:", Math.min(...freqs).toFixed(1), "Hz");
  console.log("longest note:", Math.max(...durations).toFixed(2), "s");
  console.log("shaker hits:", hits);
  console.log("audible oscillators left running:", drones);

  // It plays at all, and it plays a lot: this is a band, not a metronome.
  expect(musical.length).toBeGreaterThan(60);

  // Varied: the old loop cycled seven pitches, forever, in the same order.
  //
  // The threshold sits below what a good run produces (12 to 20). The melody
  // random-walks a pentatonic, so the count in any single window genuinely
  // varies, and a threshold set at the high-water mark is a test that fails on
  // Tuesdays. Eight is still out of reach of the old loop.
  expect(new Set(freqs.map((f) => Math.round(f))).size).toBeGreaterThanOrEqual(8);

  // Nothing down in the sub, and nothing left ringing. That combination is
  // exactly what made the old loop feel like a bass pulse.
  expect(Math.min(...freqs)).toBeGreaterThan(120);
  expect(Math.max(...durations)).toBeLessThan(0.6);

  // And its pulse is a shaker rather than a drone: eight to the bar.
  expect(hits).toBeGreaterThan(40);

  // THE ONE THAT MATTERS. The area ambience used to be two detuned oscillators
  // held forever, and that sustained low beating tone is what the whole
  // soundtrack actually sounded like, in both game modes, no matter what the
  // melody was doing. Nothing that reaches the speakers may run without end.
  expect(drones).toBe(0);
});

/**
 * Every sound the engine makes, counted from before any app code runs, and
 * which of the buffer sources loop: the ambience bed is the only one that does.
 */
async function countSounds(page: import("@playwright/test").Page) {
  await page.addInitScript(() => {
    const counts = { oscillators: 0, beds: 0 };
    (window as unknown as { __sounds: typeof counts }).__sounds = counts;

    const RealCtx = window.AudioContext;
    const realOsc = RealCtx.prototype.createOscillator;
    const realBuf = RealCtx.prototype.createBufferSource;

    RealCtx.prototype.createOscillator = function (this: AudioContext) {
      counts.oscillators += 1;
      return realOsc.call(this);
    };
    RealCtx.prototype.createBufferSource = function (this: AudioContext) {
      const source = realBuf.call(this);
      const start = source.start.bind(source);

      source.start = (...args: Parameters<typeof source.start>) => {
        if (source.loop) counts.beds += 1;
        start(...args);
      };

      return source;
    };
  });
}

const sounds = (page: import("@playwright/test").Page) =>
  page.evaluate(
    () => (window as unknown as { __sounds: { oscillators: number; beds: number } }).__sounds,
  );

test("the park goes quiet when you leave it", async ({ page }) => {
  test.setTimeout(90_000);

  /**
   * The engine and its timers live at module level and nothing stopped them,
   * and the site navigates client side, so the park's music went on playing
   * over Pocket and the journal, where there is no button to turn it off.
   */
  await countSounds(page);
  await signIn(page.context());
  await page.addInitScript(() => window.localStorage.clear());
  await page.goto("/play");
  await page.waitForTimeout(2000);
  await dismissTutorial(page);
  await page.getByRole("button", { name: /Sound off/i }).click();
  await page.waitForTimeout(2000);

  await page
    .getByRole("navigation", { name: "Primary navigation" })
    .getByRole("link", { name: "Parties" })
    .click();
  await page.waitForURL(/\/parties/);
  await page.waitForTimeout(1000);

  const left = (await sounds(page)).oscillators;
  await page.waitForTimeout(4000);

  expect((await sounds(page)).oscillators - left, "the music played on after the park").toBe(0);
});

test("the wind comes up when the sound goes on, where you stand", async ({ page }) => {
  test.setTimeout(90_000);

  /**
   * Sound starts off, and the area was recorded while it was. Turning it on
   * started only the music, and the area's ambience waited for the player to
   * cross into another area before there was any wind or birdsong at all.
   */
  await countSounds(page);
  await signIn(page.context());
  await page.addInitScript(() => window.localStorage.clear());
  await page.goto("/play");
  await page.waitForTimeout(2000);
  await dismissTutorial(page);
  await page.waitForTimeout(1500);

  await page.getByRole("button", { name: /Sound off/i }).click();
  await expect
    .poll(async () => (await sounds(page)).beds, {
      message: "no ambience where the player was standing",
      timeout: 5_000,
    })
    .toBeGreaterThan(0);
});
