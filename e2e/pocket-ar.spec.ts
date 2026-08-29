import { expect, test, type Page } from "@playwright/test";

import { BADGE_LINES } from "../src/features/game/components/ar-camera";
import { signIn } from "./helpers";

/**
 * The AR viewfinder: your pollinator, standing in the room you are in.
 *
 * There is no camera on a CI machine, so every project that runs this is given
 * a fake one: Chromium through `--use-fake-device-for-media-stream`, which the
 * desktop project already carried for the party microphone, and Firefox through
 * `media.navigator.streams.fake`. WebKit headless has neither and is skipped by
 * name rather than quietly passing an empty test.
 *
 * The thing worth asserting is the PHOTOGRAPH, not that a button was clickable.
 * A composite that silently drops the bee, or crops differently from the
 * viewfinder, would leave every button working and every photo wrong.
 */

test.skip(
  ({ browserName }) => browserName === "webkit",
  "WebKit headless has no fake camera, so the viewfinder is checked on a device instead",
);

type Shot = { width: number; height: number; darkFraction: number; stage: [number, number] };

/** Turn the camera on, take the photo, and measure what came out. */
async function shoot(page: Page): Promise<Shot> {
  await page.getByRole("button", { name: "Turn the camera on" }).click();

  const shutter = page.getByRole("button", { name: "Take the photo" });
  await expect(shutter).toBeVisible({ timeout: 20_000 });

  // Let the fake camera and the render loop both produce a few frames. An
  // empty drawing buffer composites to a photo of nothing, with no error.
  await page.waitForTimeout(1500);
  await shutter.click();

  await expect(page.locator("img[data-shot]")).toBeVisible();

  return page.evaluate(async () => {
    const img = document.querySelector<HTMLImageElement>("img[data-shot]")!;
    await img.decode();

    const canvas = document.createElement("canvas");
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;

    const context = canvas.getContext("2d")!;
    context.drawImage(img, 0, 0);

    /**
     * The band the badge sits in.
     *
     * The badge plane hangs below the model inside the same group, so with the
     * camera where it is it lands a little under two thirds of the way down.
     * The pill behind the words is nearly black, and the fake camera feed is
     * not, so "how much of this strip is very dark" separates a photo with a
     * badge from one without.
     */
    const top = Math.floor(canvas.height * 0.6);
    const height = Math.floor(canvas.height * 0.25);
    const { data } = context.getImageData(0, top, canvas.width, height);

    let dark = 0;

    for (let i = 0; i < data.length; i += 4) {
      if (data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114 < 70) {
        dark += 1;
      }
    }

    const stage = document
      .querySelector<HTMLElement>("img[data-shot]")!
      .closest("div")!.parentElement!.getBoundingClientRect();

    return {
      width: canvas.width,
      height: canvas.height,
      darkFraction: dark / (canvas.width * height),
      stage: [stage.width, stage.height] as [number, number],
    };
  });
}

test.describe("the camera makes a real photograph", () => {
  test("signed out, the photo carries the name and the tagline", async ({ page }) => {
    await page.goto("/pocket");

    const shot = await shoot(page);

    // What you see is what you get. The viewfinder is 3:4 and the file has to
    // be the same shape, or the crop is not the picture the player framed.
    expect(shot.width).toBe(1080);
    expect(shot.height).toBe(Math.round((1080 * shot.stage[1]) / shot.stage[0]));

    /**
     * The badge is in the WebGL layer, so this is also the proof that the GL
     * layer reaches the file at all. Measured at 0.29 against a threshold of
     * 0.08: the pill is most of the width of the band and there is nothing else
     * dark in a fake camera feed.
     */
    expect(shot.darkFraction).toBeGreaterThan(0.08);
  });

  test("signed in, the photo is just your bee", async ({ page }) => {
    await signIn(page.context());
    await page.goto("/pocket");
    await page.waitForTimeout(600);

    const shot = await shoot(page);

    expect(shot.width).toBe(1080);

    /**
     * No badge, and this is also the proof that the VIDEO reaches the file.
     *
     * The GL layer is transparent across this band once the badge is gone, so
     * the only thing that can make it bright is the camera frame underneath. A
     * composite that dropped `drawImage(video)` would leave it black and this
     * would read 1. Between the two tests: the badge proves GL lands in the
     * photo, and this proves the camera does.
     */
    expect(shot.darkFraction).toBeLessThan(0.03);
  });

  test("the badge still draws on a browser without roundRect", async ({ page }) => {
    /**
     * Safari below 16.4 has no `roundRect`.
     *
     * The badge texture is drawn inside a `useMemo` during render, so a throw
     * there did not lose a rounded corner, it took down the entire camera view
     * on the one device the whole passthrough approach exists to support. This
     * removes the method and checks the badge still reaches the photograph.
     */
    await page.addInitScript(() => {
      // @ts-expect-error removing a platform method on purpose
      delete CanvasRenderingContext2D.prototype.roundRect;
    });

    await page.goto("/pocket");

    const shot = await shoot(page);

    expect(shot.darkFraction).toBeGreaterThan(0.08);
  });

  test("the badge says the game's own two lines", () => {
    // Both are copy that already ships: the app name, and the about page's h1.
    expect(BADGE_LINES[0]).toBe("Scout");
    expect(BADGE_LINES[1].length).toBeGreaterThan(0);
  });
});

test.describe("when there is no camera to be had", () => {
  test("a refusal is explained, not swallowed", async ({ page }) => {
    /**
     * The fake-UI flag grants everything, so the only way to see the refusal is
     * to make `getUserMedia` reject the way a real refusal does.
     */
    await page.addInitScript(() => {
      Object.defineProperty(navigator.mediaDevices, "getUserMedia", {
        configurable: true,
        value: () =>
          Promise.reject(
            Object.assign(new Error("denied"), { name: "NotAllowedError" }),
          ),
      });
    });

    await page.goto("/pocket");
    await page.getByRole("button", { name: "Turn the camera on" }).click();

    await expect(page.getByRole("main")).toContainText(
      "The camera is off for this page.",
    );

    // And it offers the way back, rather than being a dead end.
    await expect(page.getByRole("button", { name: "Try again" })).toBeVisible();
  });

  test("no camera at all says so in different words", async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(navigator.mediaDevices, "getUserMedia", {
        configurable: true,
        value: () =>
          Promise.reject(
            Object.assign(new Error("none"), { name: "NotFoundError" }),
          ),
      });
    });

    await page.goto("/pocket");
    await page.getByRole("button", { name: "Turn the camera on" }).click();

    await expect(page.getByRole("main")).toContainText(
      "There is no camera on this device.",
    );
  });
});
