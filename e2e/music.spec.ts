import { expect, test } from "@playwright/test";

declare global {
  interface Window {
    __notes: { freq: number; type: string; at: number; stop: number }[];
    __hits: number;
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
        start(when);
      };
      osc.stop = (when = 0) => {
        window.__notes.push({ freq, type: osc.type, at, stop: when });
        stop(when);
      };

      return osc;
    };

    RealCtx.prototype.createBufferSource = function (this: AudioContext) {
      window.__hits += 1;
      return realBuf.call(this);
    };
  });

  await page.goto("/play");
  await page.waitForTimeout(2000);

  const skip = page.getByRole("button", { name: "Skip", exact: true });
  if (await skip.count()) await skip.first().click();

  // Turn the sound on, then listen for eight seconds of bars.
  await page.getByRole("button", { name: /Sound/ }).click();
  await page.waitForTimeout(8000);

  const notes = await page.evaluate(() => window.__notes);
  const hits = await page.evaluate(() => window.__hits);

  const musical = notes.filter((n) => n.stop > n.at);
  const freqs = musical.map((n) => n.freq);
  const durations = musical.map((n) => n.stop - n.at);

  console.log("notes scheduled:", musical.length);
  console.log("distinct pitches:", new Set(freqs.map((f) => Math.round(f))).size);
  console.log("lowest pitch:", Math.min(...freqs).toFixed(1), "Hz");
  console.log("longest note:", Math.max(...durations).toFixed(2), "s");
  console.log("shaker hits:", hits);

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
});
