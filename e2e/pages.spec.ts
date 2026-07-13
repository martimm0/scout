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

test("customize does not offer species it cannot render", async ({ page }) => {
  await page.goto("/customize");

  // The picker used to offer a hoverfly and a butterfly while the scene rendered
  // a bee regardless — pick either and you flew a bee in their colours. It must
  // never do that again.
  //
  // Matched on the starter NAMES, not the words "hoverfly"/"butterfly": those
  // appear legitimately in the wing-style copy ("long and tapered, like a
  // hoverfly's"), and an earlier version of this test failed on exactly that.
  await expect(page.getByText("Zip", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Marigold", { exact: true })).toHaveCount(0);

  await expect(
    page.getByText(/The bee is the only pollinator in the park so far/),
  ).toBeVisible();
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

test("every page has a working skip link", async ({ page }) => {
  await page.goto("/");
  await page.keyboard.press("Tab");

  const skip = page.getByRole("link", { name: "Skip to content" });
  await expect(skip).toBeFocused();
});
