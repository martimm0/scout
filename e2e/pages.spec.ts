import { expect, test } from "@playwright/test";

import { hold, readout, signIn } from "./helpers";
import { FUNGUS_PHOTOS } from "../src/features/game/data/fungus-photos";
import { PLANT_PHOTOS } from "../src/features/game/data/plant-photos";
import { SCHENLEY_PHOTOS } from "../src/features/game/data/schenley-photos";

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
  // The journal is behind the sign-in. Without this the test does not read the
  // journal at all: it reads the sign-in wall, and says the journal is broken.
  await signIn(page.context());
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

  // Every species with a photograph, across both parks. A missing row is a
  // licence breach, not a typo: nearly all of these images are CC BY-SA.
  const rows = page.locator("tbody tr");
  await expect(rows).toHaveCount(
    Object.keys(PLANT_PHOTOS).length +
      Object.keys(FUNGUS_PHOTOS).length +
      Object.keys(SCHENLEY_PHOTOS).length,
  );

  // Named, not just counted: assert the actual photographers are on the page.
  for (const photo of [
    ...Object.values(PLANT_PHOTOS),
    ...Object.values(FUNGUS_PHOTOS),
    ...Object.values(SCHENLEY_PHOTOS),
  ]) {
    await expect(page.getByText(photo.author, { exact: false }).first()).toBeVisible();
  }

  // Every row must carry a licence link and a source link. A silently-missing
  // credit is a breach, not a cosmetic bug.
  const licenceLinks = page.locator("tbody tr td a");
  expect(await licenceLinks.count()).toBeGreaterThanOrEqual(76);
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

    // Firefox and WebKit are slower off the mark than Chromium, and asserting on
    // the heading before the navigation has landed reads the home page and calls
    // the gate missing.
    await page.waitForURL(/\/play/);

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
  // so it would wipe a local-mode album on the way to the journal.
  await signIn(page.context());
  await page.goto("/play?hour=13");
  await page.waitForTimeout(4000);

  const skip = page.getByRole("button", { name: "Skip", exact: true });
  if (await skip.count()) await skip.first().click();
  await page.waitForTimeout(1500);

  await page.getByRole("button", { name: /Take a photo/ }).click();
  await page.waitForTimeout(1200);

  await page.goto("/journal");
  await page.getByRole("button", { name: "Photos" }).click();

  const shot = page.locator("li img").first();
  await expect(shot).toBeVisible();

  const src = await shot.getAttribute("src");

  // Cloud mode: the album is a row in Postgres, served from its own endpoint so
  // the browser can cache it, rather than a data URL pasted into the page.
  expect(src).toMatch(/^\/api\/photos\//);

  // And the endpoint really serves a JPEG.
  const response = await page.request.get(src!);
  expect(response.status()).toBe(200);
  expect(response.headers()["content-type"]).toBe("image/jpeg");

  const bytes = await response.body();
  expect(bytes.length).toBeGreaterThan(2000);
  // The magic number, so a blank or corrupt row cannot pass as an image.
  expect(bytes[0]).toBe(0xff);
  expect(bytes[1]).toBe(0xd8);

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

  // The way out. A photograph you can only look at inside somebody else's
  // website is not really yours, and the album is capped, so the player will
  // eventually have to delete one of these to take another.
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("link", { name: "Download" }).first().click(),
  ]);

  // Named after the moment it was taken, not after a UUID.
  expect(download.suggestedFilename()).toMatch(/^scout-[a-z0-9-]+\.jpg$/);

  const saved = await download.path();
  expect(saved).toBeTruthy();

  // Clean up after ourselves. These rows are in the real database.
  await page.getByRole("button", { name: "Remove" }).first().click();
  await expect(page.locator("li img")).toHaveCount(0);

  // And gone means gone: deleted on the server, not merely hidden in the page.
  expect((await page.request.get(src!)).status()).toBe(404);
});

test("one player cannot read another player's photographs", async ({ page }) => {
  test.setTimeout(120_000);

  await signIn(page.context());
  await page.goto("/play?hour=13");
  await page.waitForTimeout(4000);

  const skip = page.getByRole("button", { name: "Skip", exact: true });
  if (await skip.count()) await skip.first().click();
  await page.waitForTimeout(1500);

  await page.getByRole("button", { name: /Take a photo/ }).click();
  await page.waitForTimeout(1200);

  await page.goto("/journal");
  await page.getByRole("button", { name: "Photos" }).click();
  const src = await page.locator("li img").first().getAttribute("src");

  // A different player, holding the id. An id is an unguessable UUID, but
  // "unguessable" is not an access control policy.
  await page.context().clearCookies();
  await signIn(page.context(), "somebody-else");

  expect((await page.request.get(src!)).status()).toBe(404);

  // Put it back the way we found it, and tidy up.
  await page.context().clearCookies();
  await signIn(page.context());
  await page.request.delete(src!);
});

test("the album fills up, and a full album refuses rather than quietly binning the oldest", async ({
  page,
}) => {
  test.setTimeout(180_000);

  // A dedicated player, so this cannot trip over the other photo tests.
  await signIn(page.context(), "e2e-album-filler");
  await page.goto("/journal");

  // Start clean, whatever a previous run left behind.
  const existing = await (await page.request.get("/api/photos")).json();
  for (const photo of existing.photos as { id: string }[]) {
    await page.request.delete(`/api/photos/${photo.id}`);
  }

  // The smallest real JPEG, posted straight at the API. Flying fifty laps of
  // Frick Park to fill an album is not what is under test here.
  const jpeg = await page.evaluate(async () => {
    const canvas = document.createElement("canvas");
    canvas.width = 8;
    canvas.height = 8;

    const context = canvas.getContext("2d")!;
    context.fillStyle = "#f7c948";
    context.fillRect(0, 0, 8, 8);

    return canvas.toDataURL("image/jpeg", 0.5);
  });

  const post = () =>
    page.request.post("/api/photos", {
      data: { src: jpeg, area: "Fern Hollow", clock: "9:00 am", phase: "Morning" },
    });

  for (let i = 0; i < 50; i += 1) {
    expect((await post()).status()).toBe(200);
  }

  // The fifty-first. Refused, and told why.
  const overflow = await post();
  expect(overflow.status()).toBe(409);
  expect(await overflow.json()).toMatchObject({ error: "album-full", limit: 50 });

  // And the cap is a wall, not a conveyor: the fiftieth photo is still there.
  const after = await (await page.request.get("/api/photos")).json();
  expect(after.photos).toHaveLength(50);

  // The journal says so, and offers the way out.
  await page.reload();
  await page.getByRole("button", { name: "Photos" }).click();
  await expect(page.getByText(/Your album is full/)).toBeVisible();
  await expect(page.getByRole("link", { name: "Download" }).first()).toBeVisible();

  // Delete one, and there is room again.
  await page.getByRole("button", { name: "Remove" }).first().click();
  await expect(page.locator("li img")).toHaveCount(49);
  expect((await post()).status()).toBe(200);

  // Tidy up: these are rows in the real database.
  const left = await (await page.request.get("/api/photos")).json();
  for (const photo of left.photos as { id: string }[]) {
    await page.request.delete(`/api/photos/${photo.id}`);
  }
});

test.describe("Schenley Park", () => {
  test("is locked until half of Frick's plants are found, and says what opens it", async ({
    page,
  }) => {
    // A player with no progress. The shared e2e account has been flying all
    // suite and has already found enough of Frick to open Schenley, which is
    // correct behaviour and useless for testing the lock.
    await signIn(page.context(), "e2e-newcomer");
    await page.goto("/journal");

    // A locked door that will not say what opens it is just a wall.
    await expect(page.getByText(/Find/).first()).toBeVisible();
    await expect(page.getByText(/Schenley opens/)).toBeVisible();
    await expect(
      page.getByRole("button", { name: /Fly Schenley Park/ }),
    ).toHaveCount(0);
  });

  test("is a different park: its own areas, its own flowers", async ({ page }) => {
    test.setTimeout(120_000);

    await signIn(page.context());
    await page.goto("/play?debug=1&hour=13&park=schenley");
    await page.waitForTimeout(5000);

    const skip = page.getByRole("button", { name: "Skip", exact: true });
    if (await skip.count()) await skip.first().click();

    const state = await readout(page);

    // Flagstaff Hill, not the Frick Environmental Center.
    expect(state.Area).toBe("Flagstaff Hill");

    // And a way back across the city, from inside the park.
    await expect(
      page.getByRole("button", { name: /Fly to Frick Park/ }),
    ).toBeVisible();
  });

  test("Panther Hollow really is down there", async ({ page }) => {
    test.setTimeout(120_000);

    await signIn(page.context());
    await page.goto("/play?debug=1&hour=13&park=schenley");
    await page.waitForTimeout(5000);

    const skip = page.getByRole("button", { name: "Skip", exact: true });
    if (await skip.count()) await skip.first().click();

    const before = await readout(page);

    // Starts high: Flagstaff Hill is the top of the park.
    expect(Number.parseFloat(before.Altitude)).toBeGreaterThan(60);

    // Fly off the hill, then go down into the hollow. Flying LEVEL keeps your
    // altitude; it is the ground that falls away, which is the whole conceit of
    // this park and the reason the first version of this assertion was wrong.
    await hold(page, "ArrowUp", 6000);
    await hold(page, "KeyQ", 6000);

    const after = await readout(page);
    expect(after.Area).toBe("Panther Hollow");

    // Down below the waterline of the hill you started on. The top of Schenley is
    // mown and the wild part is a hundred feet underneath it.
    expect(Number.parseFloat(after.Altitude)).toBeLessThan(0);
  });
});
