import { expect, test } from "@playwright/test";

import { signIn } from "./helpers";

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
  await page.goto("/play");
  await page.waitForTimeout(2000);

  const skip = page.getByRole("button", { name: "Skip", exact: true });
  if (await skip.count()) await skip.first().click();

  // Turn the sound on, then listen for eight seconds of bars.
  await page.getByRole("button", { name: /Sound/ }).click();
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

  // Varied: the old loop cycled seven pitches forever.
  expect(new Set(freqs.map((f) => Math.round(f))).size).toBeGreaterThan(10);

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
