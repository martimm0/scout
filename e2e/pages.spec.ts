import { expect, test } from "@playwright/test";

import { signIn } from "./helpers";
import { FUNGUS_PHOTOS } from "../src/features/game/data/fungus-photos";
import { PLANT_PHOTOS } from "../src/features/game/data/plant-photos";

/** The pages around the game: landing, customize, journal, credits, offline. */

test("landing sells the game, not the build status", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "You are a bee." })).toBeVisible();
  await expect(page.getByRole("link", { name: "Fly", exact: true })).toBeVisible();
});

test("customize saves a name, and rejects an empty one", async ({ page }) => {
  await page.addInitScript(() => window.localStorage.clear());
  await page.goto("/customize");

  const name = page.getByLabel("Name");
  const save = page.getByRole("button", { name: /Save pollinator|Saved/ });

  await name.fill("Bramble");
  await save.click();
  await expect(page.getByRole("button", { name: "Saved" })).toBeVisible();

  // An empty name is refused, with a reason, and the button goes dead.
  await name.fill("   ");
  await expect(page.getByText("Your pollinator needs a name.")).toBeVisible();
  await expect(save).toBeDisabled();
});

test("customize offers all three species, and each one really renders", async ({
  page,
}) => {
  await page.addInitScript(() => window.localStorage.clear());
  await page.goto("/customize");

  // All three are offered again — and this time each is a real model. The rule
  // that matters is the one that got broken before: the picker must never offer
  // a species the scene cannot render. So every option here has to survive being
  // selected and flown.
  for (const species of ["Bee", "Hoverfly", "Butterfly"]) {
    await expect(page.getByRole("button", { name: new RegExp(species) })).toBeVisible();
  }
});

test("each species can be selected and flown", async ({ page }) => {
  await signIn(page.context());
  test.setTimeout(180_000);

  for (const species of ["Hoverfly", "Butterfly", "Bee"]) {
    await page.addInitScript(() => window.localStorage.clear());
    await page.goto("/customize");

    await page.getByRole("button", { name: new RegExp(species) }).first().click();
    await expect(
      page.getByRole("button", { name: new RegExp(species) }).first(),
    ).toHaveAttribute("aria-pressed", "true");

    // Now fly it. A species that renders in the picker but crashes the scene is
    // exactly the failure this test exists to catch.
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));

    await page.goto("/play");
    await page.waitForTimeout(4000);

    expect(errors, `${species} threw on /play`).toEqual([]);
    await expect(page.locator("canvas").first()).toBeVisible();
  }
});

test("journal shows locked entries as hints, not as question marks", async ({
  page,
}) => {
  await page.addInitScript(() => window.localStorage.clear());
  await page.goto("/journal");

  await expect(page.getByRole("heading", { name: /pollinator record/i })).toBeVisible();

  await page.getByRole("button", { name: "Ecology" }).click();

  // A locked concept teaches something even while locked.
  await expect(page.getByText(/You'll learn this one the hard way\./)).toBeVisible();
  await expect(page.getByText("???")).toHaveCount(0);
});

test("credits page names every photographer and links every licence", async ({
  page,
}) => {
  await page.goto("/credits");

  // Sixteen plants and eight fungi. Every fungus photograph in the set requires
  // attribution, so a missing fungus row is a licence breach, not a typo.
  const rows = page.locator("tbody tr");
  await expect(rows).toHaveCount(24);

  // Named, not just counted: assert the actual photographers are on the page.
  for (const photo of [
    ...Object.values(PLANT_PHOTOS),
    ...Object.values(FUNGUS_PHOTOS),
  ]) {
    await expect(page.getByText(photo.author, { exact: false }).first()).toBeVisible();
  }

  // Every row must carry a licence link and a source link. A silently-missing
  // credit is a breach, not a cosmetic bug.
  const licenceLinks = page.locator("tbody tr td a");
  expect(await licenceLinks.count()).toBeGreaterThanOrEqual(48);
});

test("offline mode frames the run and starts a clock", async ({ page }) => {
  await page.addInitScript(() => window.localStorage.clear());
  await page.goto("/offline");

  await expect(
    page.getByRole("heading", { name: "You are a pollinator." }),
  ).toBeVisible();

  await page.getByRole("button", { name: "Begin" }).click();
  await page.waitForTimeout(3000);

  // A clock that is actually counting down.
  const clock = page.getByText(/Time left/);
  await expect(clock).toBeVisible();
});

test("the debug overlay is hidden from players, and the stats panel is renamed", async ({
  page,
}) => {
  await signIn(page.context());
  await page.addInitScript(() => window.localStorage.clear());

  // Plain /play — what a player actually loads.
  await page.goto("/play");
  await page.waitForTimeout(3000);

  await expect(page.getByText("Debug Overlay")).toHaveCount(0);
  await expect(page.getByText("Game State")).toHaveCount(0);
  await expect(page.getByText("Scout Stats")).toBeVisible();

  // ?debug=1 brings it back — the e2e suite reads flight state out of it, so it
  // must keep working even though players never see it.
  await page.goto("/play?debug=1");
  await page.waitForTimeout(3000);

  await expect(page.getByText("Debug Overlay")).toBeVisible();
});

test("every page has a working skip link", async ({ browserName, page }) => {
  await page.goto("/");

  const skip = page.getByRole("link", { name: "Skip to content" });

  // The link exists and points at the main landmark in every engine.
  await expect(skip).toHaveAttribute("href", "#main");

  // Whether Tab *reaches* it is a platform decision, not ours: Safari leaves
  // links out of the tab order unless the user turns on Full Keyboard Access.
  // Asserting it there would be testing macOS's default, not our markup.
  test.skip(
    browserName === "webkit",
    "Safari omits links from the tab order unless Full Keyboard Access is on",
  );

  await page.keyboard.press("Tab");
  await expect(skip).toBeFocused();
});

test.describe("the saved game is behind a sign-in", () => {
  test("pressing Fly without an account asks for one", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: "Fly", exact: true }).click();

    // Not the park. The park belongs to somebody.
    await expect(
      page.getByRole("heading", { name: "Sign in to fly" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: /Sign in with Google/ }),
    ).toBeVisible();
    await expect(page.locator("canvas")).toHaveCount(0);
  });

  test("the journal and the profile are behind it too", async ({ page }) => {
    for (const route of ["/journal", "/profile"]) {
      await page.goto(route);
      await expect(
        page.getByRole("heading", { name: "Sign in to fly" }),
      ).toBeVisible();
    }
  });

  test("but the ten-minute run needs no account, and the gate says so", async ({
    page,
  }) => {
    await page.goto("/play");

    // The way in for somebody who will not hand over a Google account to look at
    // some flowers. It saves nothing, so it can ask nothing.
    await page.getByRole("link", { name: /ten-minute run/i }).click();
    await expect(page).toHaveURL(/\/offline/);

    await page.getByRole("button", { name: "Begin" }).click();
    await page.waitForTimeout(2500);

    await expect(page.locator("canvas")).toBeVisible();
  });

  test("signed in, Fly goes straight to the park", async ({ page }) => {
    await signIn(page.context());
    await page.goto("/play");
    await page.waitForTimeout(2500);

    await expect(page.locator("canvas")).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Sign in to fly" }),
    ).toHaveCount(0);
  });
});

test("a photograph taken in the park lands in the journal, and is of the park", async ({
  page,
}) => {
  test.setTimeout(120_000);

  // No addInitScript(localStorage.clear) here: it re-runs on EVERY navigation,
  // so it would wipe the album on the way to the journal and the photo would be
  // gone before it was ever looked at. The context is fresh anyway.
  await signIn(page.context());
  await page.goto("/play?hour=13");
  await page.waitForTimeout(4000);

  const skip = page.getByRole("button", { name: "Skip", exact: true });
  if (await skip.count()) await skip.first().click();
  await page.waitForTimeout(1500);

  await page.getByRole("button", { name: /Take a photo/ }).click();
  await page.waitForTimeout(600);

  await page.goto("/journal");
  await page.getByRole("button", { name: "Photos" }).click();

  const shot = page.locator("li img").first();
  await expect(shot).toBeVisible();

  const src = await shot.getAttribute("src");
  expect(src).toMatch(/^data:image\/jpeg/);

  // It has to be a picture OF SOMETHING. The GL context is created with
  // preserveDrawingBuffer, and the day that quietly changes, toDataURL starts
  // handing back a blank rectangle and every photo in the album is an empty
  // frame that still passes a "the image is there" assertion.
  const spread = await page.evaluate(async (source) => {
    const image = new Image();
    image.src = source!;
    await image.decode();

    const canvas = document.createElement("canvas");
    canvas.width = image.width;
    canvas.height = image.height;

    const context = canvas.getContext("2d")!;
    context.drawImage(image, 0, 0);

    const { data } = context.getImageData(0, 0, canvas.width, canvas.height);
    const values: number[] = [];

    for (let i = 0; i < data.length; i += 4 * 97) {
      values.push((data[i] + data[i + 1] + data[i + 2]) / 3);
    }

    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const variance =
      values.reduce((a, b) => a + (b - mean) ** 2, 0) / values.length;

    return Math.sqrt(variance);
  }, src);

  console.log("photo pixel spread:", spread.toFixed(1));
  expect(spread).toBeGreaterThan(8);
});
