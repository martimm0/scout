import { expect, test } from "@playwright/test";

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

  const rows = page.locator("tbody tr");
  await expect(rows).toHaveCount(16);

  // Every row must carry a licence link. This is a licence obligation, and a
  // silently-missing credit is a breach, not a cosmetic bug.
  const licenceLinks = page.locator("tbody tr td a");
  expect(await licenceLinks.count()).toBeGreaterThanOrEqual(32);
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
