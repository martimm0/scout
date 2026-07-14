/* eslint-disable @typescript-eslint/no-explicit-any --
 * This file monkey-patches the Web Audio prototypes from inside the page to tap
 * the master output. Re-typing BaseAudioContext.destination as something other
 * than an AudioDestinationNode is the entire trick, and it cannot be expressed
 * honestly in the types it is subverting. */
import { expect, test } from "@playwright/test";
import { signIn } from "./helpers";

/**
 * The soundtrack has no bass pulse, measured at the output.
 *
 * Twice I "fixed" this by rewriting what plays on top, reading the code, and
 * declaring it better. It was not better, because the throb was underneath, and
 * you cannot hear a source file. So this test does not read the code: it taps
 * the master output, watches the spectrum, and checks the low end is not there.
 */
test("nothing throbs: the low end is inaudible against the midrange", async ({
  page,
}) => {
  test.setTimeout(90_000);

  await page.addInitScript(() => {
    const Real = window.AudioContext;
    // Tap the master output and watch the bottom of the spectrum over time.
    (window as any).__lows = [];
    // `destination` is defined on BaseAudioContext, not AudioContext. Patching
    // the wrong prototype silently does nothing at all.
    const realDest = Object.getOwnPropertyDescriptor(
      BaseAudioContext.prototype, "destination",
    )!.get!;

    Object.defineProperty(BaseAudioContext.prototype, "destination", {
      get(this: AudioContext) {
        const dest = realDest.call(this) as AudioDestinationNode;

        if (!(this as any).__tapped) {
          (this as any).__tapped = true;
          const analyser = this.createAnalyser();
          analyser.fftSize = 2048;
          analyser.connect(dest);
          (this as any).__analyser = analyser;

          setInterval(() => {
            const bins = new Float32Array(analyser.frequencyBinCount);
            analyser.getFloatFrequencyData(bins);
            // Bin width = sampleRate / fftSize (~23Hz at 48k).
            const width = this.sampleRate / 2048;
            const energy = (lo: number, hi: number) => {
              let sum = 0, n = 0;
              for (let i = Math.ceil(lo / width); i <= Math.floor(hi / width); i += 1) {
                sum += 10 ** (bins[i] / 10); n += 1;
              }
              return 10 * Math.log10(sum / Math.max(1, n));
            };
            (window as any).__lows.push({
              sub: energy(40, 140),
              bass: energy(140, 260),
              mid: energy(260, 2000),
            });
          }, 100);
        }

        // Hand back the analyser, not the speakers. Everything the game connects
        // to "destination" now flows THROUGH it, which is the only way to hear
        // what the player hears rather than what the code says it plays.
        return (this as any).__analyser as unknown as AudioDestinationNode;
      },
    });
    void Real;
  });

  await signIn(page.context());
  await page.goto("/play");
  await page.waitForTimeout(2500);
  const skip = page.getByRole("button", { name: "Skip", exact: true });
  if (await skip.count()) await skip.first().click();
  await page.getByRole("button", { name: /Sound/ }).click();
  await page.waitForTimeout(9000);

  const lows = await page.evaluate(() => (window as any).__lows as any[]);
  const clean = lows.filter((l) => Number.isFinite(l.bass) && l.bass > -200);
  const avg = (k: string) =>
    clean.reduce((a, b) => a + b[k], 0) / Math.max(1, clean.length);
  const peak = (k: string) => Math.max(...clean.map((l) => l[k]));

  console.log("samples:", clean.length);
  console.log(`SUB   40-140Hz  avg ${avg("sub").toFixed(1)} dB  peak ${peak("sub").toFixed(1)}`);
  console.log(`BASS 140-260Hz  avg ${avg("bass").toFixed(1)} dB  peak ${peak("bass").toFixed(1)}`);
  console.log(`MID 260-2000Hz  avg ${avg("mid").toFixed(1)} dB  peak ${peak("mid").toFixed(1)}`);

  // How much the bass band swings: a pulse is a band that keeps jumping.
  const bassVals = clean.map((l) => l.bass);
  const m = avg("bass");
  const swing = Math.sqrt(
    bassVals.reduce((a, b) => a + (b - m) ** 2, 0) / bassVals.length,
  );
  console.log("BASS swing (stddev over time):", swing.toFixed(1), "dB");

  // The bass band must be far below the midrange: not "quiet", not "tasteful",
  // but buried. When the pulse was there this band ran LEVEL with the mids
  // (-96.5 against -93.8) and swung 6.6dB on the beat. A 30dB gap cannot be
  // heard as a pulse by anybody.
  expect(avg("bass")).toBeLessThan(avg("mid") - 30);
  expect(avg("sub")).toBeLessThan(avg("mid") - 30);

  // And there is genuinely still music playing, so this cannot be passed by
  // simply turning everything off.
  expect(avg("mid")).toBeGreaterThan(-130);
});
