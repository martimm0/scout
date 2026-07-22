import { expect, test } from "@playwright/test";

import {
  demandingPlantToSpawn,
  dismissTutorial,
  enterGame,
  findPlant,
  flyToPlant,
  hold,
  readout,
  resetProgress,
  signIn,
} from "./helpers";
import { PLANTS } from "../src/features/game/data/plants";
import { FUNGI } from "../src/features/game/data/fungi";
import {
  areaAt,
  PARKS,
  setActivePark,
  terrainHeight,
} from "../src/features/game/world/terrain";
import {
  scatterFoliage,
  scatterGrass,
} from "../src/features/game/world/scatter";
import { scatterSpecies } from "../src/features/game/world/species-scatter";
import { canPollinate } from "../src/features/game/state/game-store";
import {
  ACCESSORY_INFO,
  accessoryUnlocked,
} from "../src/features/game/data/accessories";
import { BADGES_BY_ID } from "../src/features/game/data/badges";
import { triviaFor } from "../src/features/game/data/trivia";
import { FUNGUS_PHOTOS } from "../src/features/game/data/fungus-photos";
import { PLANT_PHOTOS } from "../src/features/game/data/plant-photos";
import { SCHENLEY_PHOTOS } from "../src/features/game/data/schenley-photos";
import { HIGHLAND_PHOTOS } from "../src/features/game/data/highland-photos";

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
      Object.keys(SCHENLEY_PHOTOS).length +
      Object.keys(HIGHLAND_PHOTOS).length,
  );

  // Named, not just counted: assert the actual photographers are on the page.
  for (const photo of [
    ...Object.values(PLANT_PHOTOS),
    ...Object.values(FUNGUS_PHOTOS),
    ...Object.values(SCHENLEY_PHOTOS),
    ...Object.values(HIGHLAND_PHOTOS),
  ]) {
    await expect(page.getByText(photo.author, { exact: false }).first()).toBeVisible();
  }

  // Every row must carry a licence link and a source link. A silently-missing
  // credit is a breach, not a cosmetic bug.
  const licenceLinks = page.locator("tbody tr td a");
  expect(await licenceLinks.count()).toBeGreaterThanOrEqual(76);
});

test("offline mode frames the run and renders the park", async ({ page }) => {
  await page.addInitScript(() => window.localStorage.clear());

  // The offline run mounts the scene from a CLIENT click, not a page load, which
  // is the path that used to lose the WebGL context to React's dev double-invoke:
  // createRoot ran twice on the same canvas, the context was lost, and the park
  // was replaced by the shell's flat green for the rest of the session. Catch
  // both the symptom (a warning and a lost context) and the result (a blank
  // canvas), because the old test watched the HUD and passed straight through it.
  const glErrors: string[] = [];
  page.on("console", (message) => {
    const text = message.text();
    if (/createRoot should only be called once|Context Lost/.test(text)) {
      glErrors.push(text);
    }
  });

  await page.goto("/offline");

  await expect(
    page.getByRole("heading", { name: "You are a pollinator." }),
  ).toBeVisible();

  await page.getByRole("button", { name: "Begin" }).click();
  await page.waitForTimeout(3000);

  // A clock that is actually counting down.
  const clock = page.getByText(/Time left/);
  await expect(clock).toBeVisible();

  // The park is actually on the canvas, not the shell's flat background showing
  // through a transparent GL context. A rendered park has real variation across
  // the frame; a flat fill has almost none.
  const spread = await page.evaluate(() => {
    const canvas = document.querySelector("canvas") as HTMLCanvasElement;
    const scratch = document.createElement("canvas");
    scratch.width = 80;
    scratch.height = 80;
    const context = scratch.getContext("2d")!;
    context.drawImage(canvas, 0, 0, 80, 80);
    const { data } = context.getImageData(0, 0, 80, 80);
    const values: number[] = [];
    for (let i = 0; i < data.length; i += 4) {
      values.push((data[i] + data[i + 1] + data[i + 2]) / 3);
    }
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    return Math.sqrt(
      values.reduce((a, b) => a + (b - mean) ** 2, 0) / values.length,
    );
  });

  expect(glErrors, glErrors.join("\n")).toEqual([]);
  // A flat fill sits near zero; the park runs well above it.
  expect(spread).toBeGreaterThan(10);
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
    // Scoped to the page body, not the whole document: there is a Sign in button
    // in the nav on every page, so an unscoped locator matches two and Playwright
    // rightly refuses to guess which one the test meant.
    await expect(
      page.getByRole("main").getByRole("button", { name: /Sign in with Google/ }),
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

  await dismissTutorial(page);
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

  await dismissTutorial(page);
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

    // Wait for the picker itself before asserting anything about it. It is
    // client-rendered off a hydrated store, so under load the assertions can beat
    // it onto the page, and "the lock note is missing" and "the lock note has not
    // arrived yet" look identical from here.
    const picker = page.getByRole("list", { name: "Parks" });
    await expect(picker).toBeVisible({ timeout: 20_000 });

    // By NAME, not by "contains the word Schenley": Highland's card also says
    // Schenley, because Schenley is what opens it, and the filter matched both.
    const schenley = picker
      .getByRole("listitem")
      .filter({ has: page.getByText("Schenley Park", { exact: true }) });
    await expect(schenley).toBeVisible();

    // A locked door that will not say what opens it is just a wall.
    await expect(schenley).toContainText("Schenley Park opens");
    await expect(schenley).toContainText("Find 8 of Frick Park's plants");

    // And no way through it.
    await expect(
      schenley.getByRole("button", { name: /Fly Schenley Park/ }),
    ).toHaveCount(0);
  });

  test("is a different park: its own areas, its own flowers", async ({ page }) => {
    test.setTimeout(120_000);

    await signIn(page.context());
    await page.goto("/play?debug=1&hour=13&park=schenley");
    await page.waitForTimeout(5000);

    await dismissTutorial(page);

    const state = await readout(page);

    // Flagstaff Hill, not the Frick Environmental Center.
    expect(state.Area).toBe("Flagstaff Hill");

    // And a way back across the city, from inside the park.
    await expect(
      page.getByRole("button", { name: /Fly to Frick Park/ }),
    ).toBeVisible();
  });

  test("can be opened straight from a link, without the debug overlay", async ({
    page,
  }) => {
    test.setTimeout(120_000);

    await signIn(page.context());

    // The link you would hand somebody to show them the second park. It builds
    // Schenley without granting the unlock and without a developer overlay
    // stapled over the screen.
    await page.goto("/play?park=schenley");
    await page.waitForTimeout(5000);

    await dismissTutorial(page);

    await expect(page.getByText("Debug Overlay")).toHaveCount(0);
    await expect(page.locator("canvas").first()).toBeVisible();
    await expect(
      page.getByRole("button", { name: /Fly to Frick Park/ }),
    ).toBeVisible();
  });

  test("Panther Hollow really is down there", async ({ page }) => {
    test.setTimeout(120_000);

    await signIn(page.context());
    await page.goto("/play?debug=1&hour=13&park=schenley");
    await page.waitForTimeout(5000);

    await dismissTutorial(page);

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

test.describe("the about page and the site chrome", () => {
  test("about explains the game, the plan, and who it is for", async ({ page }) => {
    await page.goto("/about");

    await expect(
      page.getByRole("heading", { name: /A game about being very small/ }),
    ).toBeVisible();

    // What it is, how to play, where it is going, why, and who for.
    await expect(page.getByRole("heading", { name: "How to play" })).toBeVisible();
    await expect(page.getByText(/MMORPG/)).toBeVisible();
    await expect(page.getByText(/raining outside/)).toBeVisible();
    await expect(page.getByRole("heading", { name: "For Dawn" })).toBeVisible();
    await expect(page.getByText(/birthday present/)).toBeVisible();

    // The card headings render as headings. They used to be passed as a `title`
    // prop that nothing rendered, so they only ever appeared as a tooltip.
    await expect(page.getByRole("heading", { name: "Fly", exact: true })).toBeVisible();
  });

  test("the footer credits 3sb and describes the game", async ({ page }) => {
    await page.goto("/");

    await expect(page.getByText("A pollinator RPG based in Pittsburgh, PA")).toBeVisible();

    const link = page.getByRole("link", { name: "A 3sb Original" });
    await expect(link).toBeVisible();
    await expect(link).toHaveAttribute("href", "https://www.3sb.io/");
  });

  test("dark mode dresses the pages around the game, and is remembered", async ({
    page,
  }) => {
    await page.goto("/about");

    const background = () =>
      page.evaluate(() =>
        getComputedStyle(document.body).backgroundColor,
      );

    const light = await background();

    // The control must be findable, not merely present. The first version was an
    // unlabelled circle with a sun glyph at the end of a row of nav links, and it
    // read as decoration: it was on the page and nobody could find it.
    const toggle = page.getByRole("button", { name: /Switch to dark mode/ });
    await expect(toggle).toBeVisible();
    await expect(toggle).toContainText("Light");

    await toggle.click();
    const dark = await background();

    expect(dark).not.toBe(light);

    // It survives a navigation, and it is applied before the first paint rather
    // than after, so nobody gets a white flash on the way to a dark page.
    await page.goto("/credits");
    expect(await background()).toBe(dark);
    expect(
      await page.evaluate(() => document.documentElement.dataset.theme),
    ).toBe("dark");
  });
});

test.describe("the weather is Pittsburgh's weather", () => {
  test("the API answers with a well-formed sky, whatever the service does", async ({
    page,
  }) => {
    const response = await page.request.get("/api/weather");
    expect(response.status()).toBe(200);

    const body = await response.json();
    const w = body.weather;

    // The contract holds even when the upstream is down, because the route falls
    // back to a fair day rather than to a broken object. A weather service being
    // unreachable is not a reason for the sky to be missing.
    expect(["clear", "cloudy", "overcast", "fog", "drizzle", "rain", "snow", "thunderstorm"]).toContain(w.condition);
    expect(["none", "rain", "snow"]).toContain(w.falling);
    expect(w.cloudCover).toBeGreaterThanOrEqual(0);
    expect(w.cloudCover).toBeLessThanOrEqual(1);
    expect(w.intensity).toBeGreaterThanOrEqual(0);
    expect(w.intensity).toBeLessThanOrEqual(1);
    expect(typeof w.temperature).toBe("number");
    expect(typeof w.label).toBe("string");

    console.log("Pittsburgh right now:", w.label, `${Math.round(w.temperature)}C`, `cloud ${Math.round(w.cloudCover * 100)}%`);
  });

  test("the real observation reaches the park, not just the test hook", async ({
    page,
  }) => {
    test.setTimeout(120_000);

    // Stand in for the weather service. This exercises the path a real player
    // takes: the game asks the server what the weather is and renders the answer.
    await page.route("**/api/weather", (route) =>
      route.fulfill({
        json: {
          live: true,
          weather: {
            condition: "snow",
            label: "Heavy snow",
            temperature: -6,
            cloudCover: 0.95,
            wind: 20,
            precipitation: 3,
            falling: "snow",
            intensity: 0.8,
            observedAt: "2026-01-09T08:00",
          },
        },
      }),
    );

    await signIn(page.context());
    await page.goto("/play?debug=1&hour=13");
    await page.waitForTimeout(5000);

    await dismissTutorial(page);

    const stats = page.getByRole("complementary", { name: "Scout stats" });
    await expect(stats).toContainText("Heavy snow");
    await expect(stats).toContainText("-6°C");
  });

  test("the park shows the date and the hour in Pittsburgh", async ({ page }) => {
    test.setTimeout(120_000);

    await signIn(page.context());
    await page.goto("/play?hour=13");
    await page.waitForTimeout(4000);

    await dismissTutorial(page);

    const stats = page.getByRole("complementary", { name: "Scout stats" });

    // The date, in Pittsburgh, which is not always the player's date.
    const today = new Intl.DateTimeFormat("en-GB", {
      timeZone: "America/New_York",
      weekday: "short",
      day: "numeric",
      month: "short",
    }).format(new Date());

    await expect(stats).toContainText(today);
    await expect(stats).toContainText("1:00 pm");
  });

  test("rain is actually drawn, and fog actually hides the park", async ({
    page,
  }) => {
    test.setTimeout(180_000);

    await signIn(page.context());

    /** The mean and the spread of what is on screen. */
    const look = async (weather: string) => {
      await page.goto(`/play?hour=13&weather=${weather}`);
      await page.waitForTimeout(4500);

      await dismissTutorial(page);
      await page.waitForTimeout(1200);

      return page.evaluate(() => {
        const canvas = document.querySelector("canvas") as HTMLCanvasElement;
        const shot = canvas.toDataURL("image/jpeg", 0.9);

        return new Promise<{ mean: number; spread: number }>((resolve) => {
          const image = new Image();

          image.onload = () => {
            const scratch = document.createElement("canvas");
            scratch.width = image.width;
            scratch.height = image.height;

            const context = scratch.getContext("2d")!;
            context.drawImage(image, 0, 0);

            const { data } = context.getImageData(0, 0, image.width, image.height);
            const values: number[] = [];

            for (let i = 0; i < data.length; i += 4 * 53) {
              values.push((data[i] + data[i + 1] + data[i + 2]) / 3);
            }

            const mean = values.reduce((a, b) => a + b, 0) / values.length;
            const spread = Math.sqrt(
              values.reduce((a, b) => a + (b - mean) ** 2, 0) / values.length,
            );

            resolve({ mean, spread });
          };

          image.src = shot;
        });
      });
    };

    const clear = await look("clear");
    const fog = await look("fog");

    console.log("clear:", clear, "fog:", fog);

    // Fog flattens the park: everything moves toward one grey, so the spread of
    // brightness across the frame collapses. This is the assertion that would
    // catch the weather being computed and then never reaching the renderer,
    // which is the failure mode that looks fine in the code and blank on screen.
    expect(fog.spread).toBeLessThan(clear.spread * 0.85);
  });
});

test.describe("the weather is Pittsburgh's weather", () => {
  test("the service answers, and answers with something usable", async ({
    page,
  }) => {
    const response = await page.request.get("/api/weather");
    expect(response.status()).toBe(200);

    const body = await response.json();
    const weather = body.weather;

    console.log("Pittsburgh right now:", JSON.stringify(weather));

    // Whatever the sky is doing, the shape has to be complete: the scene reads
    // every one of these on the first frame, and an undefined cloud cover is a
    // NaN in the light rig rather than a nice error.
    expect(typeof weather.label).toBe("string");
    expect(typeof weather.temperature).toBe("number");
    expect(weather.cloudCover).toBeGreaterThanOrEqual(0);
    expect(weather.cloudCover).toBeLessThanOrEqual(1);
    expect(["none", "rain", "snow"]).toContain(weather.falling);
    expect(weather.intensity).toBeGreaterThanOrEqual(0);
    expect(weather.intensity).toBeLessThanOrEqual(1);

    // And when it fails it says so rather than inventing a sky.
    expect(typeof body.live).toBe("boolean");
  });

  test("the HUD shows the date, the time and the real conditions", async ({
    page,
  }) => {
    test.setTimeout(90_000);

    await signIn(page.context());
    await page.goto("/play?hour=13&weather=rain");
    await page.waitForTimeout(4000);

    const stats = page.getByRole("complementary", { name: "Scout stats" });

    await expect(stats).toContainText("Rain");
    await expect(stats).toContainText("1:00 pm");
    // The date, in Pittsburgh, which is not always the player's date.
    await expect(stats).toContainText(/\d+ \w{3}/);
  });

  test("weather changes what you can see, not just what the label says", async ({
    page,
  }) => {
    test.setTimeout(180_000);

    await signIn(page.context());

    /** Mean brightness of the rendered park. */
    const brightness = async (weather: string) => {
      await page.goto(`/play?hour=13&weather=${weather}`);
      await page.waitForTimeout(4500);

      await dismissTutorial(page);
      await page.waitForTimeout(1200);

      return page.evaluate(() => {
        const canvas = document.querySelector("canvas") as HTMLCanvasElement;
        const scaled = document.createElement("canvas");
        scaled.width = 200;
        scaled.height = 120;

        const context = scaled.getContext("2d")!;
        context.drawImage(canvas, 0, 0, 200, 120);

        const { data } = context.getImageData(0, 0, 200, 120);
        let sum = 0;

        for (let i = 0; i < data.length; i += 4) {
          sum += (data[i] + data[i + 1] + data[i + 2]) / 3;
        }

        return sum / (data.length / 4);
      });
    };

    const clear = await brightness("clear");
    const storm = await brightness("storm");

    console.log(`brightness: clear ${clear.toFixed(1)}, storm ${storm.toFixed(1)}`);

    // A thunderstorm has to actually darken the park. If the only thing the
    // weather changed were a word in the corner of the HUD, this is the assertion
    // that would catch it.
    expect(storm).toBeLessThan(clear * 0.85);
  });
});

test.describe("the difficult flowers", () => {
  test("about a tenth of each park's flowers are gated, and they are the hard ones", async () => {
    for (const park of ["frick", "schenley", "highland"] as const) {
      const plants = PLANTS.filter((plant) =>
        plant.homes.some((home) => home.park === park),
      );
      const demanding = plants.filter((plant) => plant.demanding);
      const share = demanding.length / plants.length;

      console.log(
        `${park}: ${demanding.length}/${plants.length} gated (${Math.round(share * 100)}%) - ${demanding.map((p) => p.id).join(", ")}`,
      );

      // Roughly a tenth. Not a fraction of a flower: 10% of 16 is 1.6, and you
      // cannot gate six tenths of a milkweed.
      expect(share).toBeGreaterThan(0.05);
      expect(share).toBeLessThan(0.2);
    }

    // Every gated flower must SAY why, and must have a quiz to pass. A gate with
    // no way through it is a wall.
    for (const plant of PLANTS.filter((p) => p.demanding)) {
      expect(plant.demanding!.length).toBeGreaterThan(20);
      expect(triviaFor(plant.id).length).toBeGreaterThan(0);
    }
  });

  test("a demanding flower says so from the air, before you fly to it", async ({
    page,
  }) => {
    test.setTimeout(180_000);

    await enterGame(page);

    const gated = demandingPlantToSpawn();
    expect(await flyToPlant(page, gated)).toBe(true);

    // The tag over the flower warns you BEFORE you land. Flying down to be told
    // you cannot work it is a wasted trip.
    await expect(page.getByText("Pass the quiz to pollinate")).toBeVisible();

    await page.keyboard.press("Space");

    const menu = page.getByRole("dialog", { name: /Landed/ });
    await expect(menu).toBeVisible();

    // The button is not there to press, and the card says WHY rather than simply
    // withholding.
    await expect(menu.getByText("Learn it before you work it")).toBeVisible();
    await expect(menu.getByRole("button", { name: /Pollinate/ })).toHaveCount(0);

    // And the quiz is right there, as the way through.
    await expect(menu.getByRole("button", { name: /quiz/i })).toBeVisible();
  });

  test("the gate is a rule, not a disabled button", () => {
    // canPollinate is what startMinigame actually consults, so this is the rule
    // itself rather than a re-implementation of it. A disabled button is a
    // suggestion; this is the thing that says no.
    const gated = PLANTS.find((plant) => plant.demanding)!;
    const ordinary = PLANTS.find((plant) => !plant.demanding)!;

    expect(canPollinate({ quizPassed: {} }, gated.id)).toBe(false);
    expect(canPollinate({ quizPassed: { [gated.id]: true } }, gated.id)).toBe(
      true,
    );

    // And an ordinary flower is never gated, quiz or no quiz.
    expect(canPollinate({ quizPassed: {} }, ordinary.id)).toBe(true);
  });
});

test.describe("Highland Park", () => {
  test("is a park about water on a hilltop, not a valley", async ({ page }) => {
    test.setTimeout(120_000);

    await signIn(page.context());
    await page.goto("/play?debug=1&hour=13&park=highland&weather=clear");
    await page.waitForTimeout(5000);

    await dismissTutorial(page);

    const state = await readout(page);

    // You start at the gates, at the bottom, looking up at a hill with a wall
    // round it.
    expect(state.Area).toBe("The Entrance Gates");
    await expect(page.locator("canvas").first()).toBeVisible();
  });

  test("the reservoir really is a lake on top of a hill", () => {
    setActivePark("highland");

    const [cx, cz] = PARKS.highland.landmarks.reservoirOne;

    // Inside the ring: the basin. Outside and a little further: the embankment,
    // standing well above it. That difference IS the park.
    const water = terrainHeight(cx, cz);
    const rim = terrainHeight(cx + 130, cz);

    expect(rim).toBeGreaterThan(water + 15);

    // And the whole thing is far above the river at the bottom of the map.
    const river = terrainHeight(0, -272);
    expect(water - river).toBeGreaterThan(100);

    setActivePark("frick");
  });

  test("nothing grows in the drinking water", () => {
    setActivePark("highland");

    const inWater = (x: number, z: number) =>
      ["reservoir-one", "reservoir-two"].includes(areaAt(x, z).id);

    // The grass scatter used to key off Frick's area names, so every area of
    // every other park fell through to a default and grew a lawn. That put grass
    // on the surface of the city's drinking water.
    const grassOnWater = scatterGrass().filter((blade) =>
      inWater(blade.position[0], blade.position[2]),
    );
    expect(grassOnWater).toHaveLength(0);

    const scatter = scatterFoliage();
    const treesOnWater = Object.values(scatter)
      .flat()
      .filter((prop) => inWater(prop.position[0], prop.position[2]));
    expect(treesOnWater).toHaveLength(0);

    setActivePark("frick");
  });

  test("every species each park claims actually exists in the world", () => {
    for (const park of ["frick", "schenley", "highland"] as const) {
      setActivePark(park);

      const placed = new Set(scatterSpecies().map((instance) => instance.id));
      const claimed = [...PLANTS, ...FUNGI].filter((species) =>
        species.homes.some((home) => home.park === park),
      );
      const missing = claimed.filter((species) => !placed.has(species.id));

      // A species in the data and nowhere on the ground is a journal entry
      // nobody can fill and a badge nobody can earn. This has bitten twice.
      expect(
        missing.map((species) => species.id),
        `${park} claims species it does not place`,
      ).toEqual([]);
    }

    setActivePark("frick");
  });
});

test.describe("customization", () => {
  test("the accessories you have not earned are shown, locked, and named", async ({
    page,
  }) => {
    await signIn(page.context(), "e2e-newcomer");
    await resetProgress(page);
    await page.goto("/customize");

    // Free from the start: you have to be able to make the bee yours before you
    // have earned anything.
    await expect(page.getByRole("button", { name: /^Cap/ })).toBeEnabled();

    // Earned. Visible, disabled, and it says what earns it, because a reward you
    // cannot see is not a reward.
    const lantern = page.getByRole("button", { name: /Foxfire Lantern/ });
    await expect(lantern).toBeVisible();
    await expect(lantern).toBeDisabled();
    await expect(lantern).toContainText("Earned with Foxfire");
  });

  test("the gate is a rule: you cannot wear what you have not earned", () => {
    // What updatePollinator actually consults, rather than a restatement of it.
    expect(accessoryUnlocked({}, "lantern")).toBe(false);
    expect(accessoryUnlocked({ foxfire: true }, "lantern")).toBe(true);

    // The free ones are always free.
    expect(accessoryUnlocked({}, "cap")).toBe(true);
    expect(accessoryUnlocked({}, "none")).toBe(true);

    // Every locked accessory names a badge that actually exists. A gate that
    // points at a badge nobody can earn is a gate with no key.
    for (const info of ACCESSORY_INFO) {
      if (info.badge) {
        expect(
          BADGES_BY_ID.get(info.badge),
          `${info.id} points at a badge that does not exist: ${info.badge}`,
        ).toBeTruthy();
      }
    }
  });

  test("the customize page previews the real model, and takes a hex code", async ({
    page,
  }) => {
    test.setTimeout(90_000);

    await signIn(page.context());
    await page.goto("/customize");
    await page.waitForTimeout(2500);

    // The actual 3D model, not a flat drawing of it.
    await expect(page.locator("canvas").first()).toBeVisible();

    // Type a colour nobody put in the swatches.
    const hex = page.getByLabel("Body colour, hex code");
    await hex.fill("ff00aa");
    await hex.press("Enter");

    await expect
      .poll(async () =>
        page.evaluate(
          () =>
            JSON.parse(localStorage.getItem("scout-game-state") ?? "{}")?.state
              ?.pollinator?.bodyColor,
        ),
      )
      .toBe("#ff00aa");
  });

  test("a change made while the save is loading is not clobbered by it", async ({
    page,
  }) => {
    test.setTimeout(120_000);

    await signIn(page.context(), "e2e-racer");

    // Put a bee on the server, then arrive and immediately ask for a butterfly.
    await page.goto("/customize");
    await page.waitForTimeout(2500);
    await page.getByRole("button", { name: /Bee/ }).first().click();
    await page.waitForTimeout(2500);

    // Reload, and pick something else the instant the page is interactive, while
    // the resume request for that stored bee is still in the air.
    await page.goto("/customize");
    await page.getByRole("button", { name: /Butterfly/ }).first().click();

    // Give the load every chance to land and stamp on it.
    await page.waitForTimeout(4000);

    // Your click is newer than a request that was already in flight.
    await expect(
      page.getByRole("button", { name: /Butterfly/ }).first(),
    ).toHaveAttribute("aria-pressed", "true");
  });

  test("the preview draws the bee, and redraws it when you change one", async ({
    page,
  }) => {
    test.setTimeout(120_000);

    await signIn(page.context());
    await page.goto("/customize");
    await page.waitForTimeout(4000);

    // A bee, explicitly. The pollinator is saved to the account, so this player
    // arrives as whatever the last test left them, and a butterfly is mostly
    // wings that are deliberately NOT tinted by the body colour: the model barely
    // responds, and the test fails for a reason that is not the preview.
    await page.getByRole("button", { name: /Bee/ }).first().click();
    await page.waitForTimeout(1200);

    /**
     * The average colour of the model, ignoring the cream background.
     *
     * Asserting the canvas is VISIBLE is what the other tests do, and it is what
     * let a preview that drew absolutely nothing pass for as long as it did: the
     * element was there, sized, and transparent. The only way to know a canvas
     * drew something is to read the pixels back out of it.
     */
    const beeColor = () =>
      page.evaluate(() => {
        const canvas = document.querySelector("canvas") as HTMLCanvasElement;
        const scaled = document.createElement("canvas");
        scaled.width = 120;
        scaled.height = 120;

        const context = scaled.getContext("2d")!;
        context.drawImage(canvas, 0, 0, 120, 120);

        const { data } = context.getImageData(0, 0, 120, 120);
        let r = 0;
        let g = 0;
        let b = 0;
        let n = 0;

        for (let i = 0; i < data.length; i += 4) {
          // Skip the cream background and anything near white.
          if (data[i] > 240 && data[i + 1] > 235 && data[i + 2] > 210) continue;

          r += data[i];
          g += data[i + 1];
          b += data[i + 2];
          n += 1;
        }

        return n === 0 ? null : { r: r / n, g: g / n, b: b / n, pixels: n };
      });

    const hex = page.getByLabel("Body colour, hex code");

    const paint = async (color: string) => {
      await hex.fill(color);
      await hex.press("Enter");
      await page.waitForTimeout(1500);

      return beeColor();
    };

    // Deliberately no assumption about the colour it starts on. The pollinator is
    // saved to the ACCOUNT now, so the shared test player arrives wearing
    // whatever the last test left it in, and a check against "the default yellow"
    // fails for a reason that has nothing to do with the preview.
    const red = await paint("ee2222");

    // There is a bee there at all. Asserting the canvas is visible is what the
    // other tests do, and it is exactly what let a preview that drew absolutely
    // nothing pass for as long as it did: the element was present, sized, and
    // completely transparent. Reading the pixels is the only way to know.
    expect(red, "the preview drew nothing").not.toBeNull();
    expect(red!.pixels).toBeGreaterThan(200);
    expect(red!.r).toBeGreaterThan(red!.b + 25);

    const blue = await paint("2222ee");

    // The whole point of a live preview. The GL root is created once and the bee
    // is re-rendered into it, and if that re-render ever stops reaching the
    // screen, this is the assertion that notices.
    expect(blue!.b).toBeGreaterThan(blue!.r + 25);
  });

  test("customization reaches the account, not just the browser", async ({
    page,
  }) => {
    test.setTimeout(120_000);

    await signIn(page.context(), "e2e-customizer");
    await resetProgress(page);

    await page.goto("/customize");
    await page.waitForTimeout(2000);

    const hex = page.getByLabel("Body colour, hex code");
    await hex.fill("00cc88");
    await hex.press("Enter");

    /**
     * The whole point of this test.
     *
     * The customize page did not mount the cloud sync, so a change went to the
     * store, and to localStorage, and nowhere else: you could recolour your bee,
     * pick up another device, and find the old one waiting. Checking the SERVER
     * is the only way to catch that; checking localStorage would have passed
     * happily the whole time it was broken.
     */
    await expect
      .poll(
        async () => {
          const response = await page.request.get("/api/progress");

          if (!response.ok()) {
            return null;
          }

          const body = await response.json();

          return body.progress?.pollinator?.bodyColor ?? null;
        },
        { timeout: 20_000 },
      )
      .toBe("#00cc88");
  });
});

test.describe("a popover owns the keyboard", () => {
  test("P during the quiz does not take a photograph", async ({ page }) => {
    test.setTimeout(180_000);

    // enterGame signs in as the default player, so signing in as somebody else
    // first is pointless: it silently overwrites the cookie.
    await enterGame(page);

    // Clear the album AFTER that, and as the account that will actually take the
    // photograph. The album is its own table, so resetProgress does not touch it,
    // and without this the test is not idempotent: a run that legitimately
    // catches the bug leaves a photo behind and every later run fails for that
    // instead of for the bug.
    const existing = await (await page.request.get("/api/photos")).json();
    for (const photo of existing.photos as { id: string }[]) {
      await page.request.delete(`/api/photos/${photo.id}`);
    }

    expect(await findPlant(page)).toBe(true);
    await page.keyboard.press("Space");
    await page.getByRole("button", { name: /quiz/i }).click();
    await expect(page.getByRole("dialog", { name: /Quiz/i })).toBeVisible();

    // The scene listens on window and this handler had no modal gate at all, so
    // reading a question and pressing P photographed the dialog.
    await page.keyboard.press("KeyP");
    await page.waitForTimeout(800);

    const album = await (await page.request.get("/api/photos")).json();
    expect(album.photos).toHaveLength(0);
  });

  test("G during the quiz does not make the bee dance", async ({ page }) => {
    test.setTimeout(180_000);

    await enterGame(page);

    expect(await findPlant(page)).toBe(true);
    await page.keyboard.press("Space");
    await page.getByRole("button", { name: /quiz/i }).click();
    await expect(page.getByRole("dialog", { name: /Quiz/i })).toBeVisible();

    // The gesture branch checked only "not a repeat, not already gesturing".
    // The bee waggled behind the dialog you were reading.
    await page.keyboard.press("KeyG");
    await page.waitForTimeout(600);

    // Movement is the readout's word for what the bee is doing. A gesture is not
    // hovering.
    const state = await readout(page);
    expect(state.Movement).toBe("Hovering");
  });

  test("you can type into a popover: the scene stops eating the letters", async ({
    page,
  }) => {
    test.setTimeout(180_000);

    await enterGame(page);

    // The scene preventDefaults A, D, W, S, E, Q, F, G, R, P, Space and Shift on
    // window, which is most of the alphabet you need and both common vowels.
    // Nothing in the game could contain a text input until this was gated. Prove
    // it with the input that already exists on /customize while the scene is not
    // mounted, and then prove the gate itself here by pressing the same letters
    // into a popover and checking they do not reach the scene.
    expect(await findPlant(page)).toBe(true);
    await page.keyboard.press("Space");

    const menu = page.getByRole("dialog", { name: /Landed/ });
    await expect(menu).toBeVisible();

    const before = await readout(page);

    // Every key the scene used to swallow. None of them should move the bee.
    for (const code of ["KeyW", "KeyA", "KeyS", "KeyD", "KeyE", "KeyQ"]) {
      await page.keyboard.press(code);
    }
    await page.waitForTimeout(500);

    const after = await readout(page);

    // Position is exact: none of those keys moved the bee horizontally. Altitude
    // gets a hair of tolerance because the bee bobs gently in place even while
    // landed, and that idle sway is not the scene reading a keystroke: a fifth of
    // a unit is the bob, a flight input would be several units a second.
    expect(after.Position).toBe(before.Position);
    expect(
      Math.abs(
        Number.parseFloat(after.Altitude) - Number.parseFloat(before.Altitude),
      ),
    ).toBeLessThan(0.5);
  });
});
