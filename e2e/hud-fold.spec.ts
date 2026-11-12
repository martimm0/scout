import { expect, test, type Page } from "@playwright/test";

import { openPlay } from "./helpers";

/**
 * The HUD gets out of the way.
 *
 * Controls, Field Notes and Scout Stats used to stay open the whole time, which
 * is a lot of text over a meadow. Each now folds itself to its header a few
 * seconds after it opens, unless pinned, and never while somebody has the
 * pointer or the focus in it.
 */

const PANELS = ["Flight controls", "Field notes", "Scout stats"] as const;
const panel = (page: Page, name: string) => page.locator(`aside[aria-label="${name}"]`);

/** Past the walkthrough, which keeps everything folded while it coaches. */
async function arrive(page: Page, subject: string) {
  await openPlay(page, subject);
  await page.getByRole("button", { name: "Skip", exact: true }).click();
  // Somewhere neutral, over the park, so no panel is being hovered.
  await page.mouse.move(640, 300);
}

test.describe("panels fold themselves away", () => {
  test.describe.configure({ timeout: 90_000 });

  test("each panel opens, then folds after a few seconds", async ({ page }) => {
    await arrive(page, "hud-fold-timer");

    for (const name of PANELS) {
      await expect(panel(page, name)).toHaveAttribute("data-open", "true");
    }

    await page.waitForTimeout(5000);
    for (const name of PANELS) {
      await expect(panel(page, name), `${name} folded too soon`).toHaveAttribute("data-open", "true");
    }

    for (const name of PANELS) {
      await expect(panel(page, name), `${name} never folded`).toHaveAttribute(
        "data-open",
        "false",
        { timeout: 6_000 },
      );
    }

    // Folded to the header, not gone: the way back is still there.
    await expect(page.getByRole("button", { name: "Show the controls" })).toBeVisible();
  });

  test("a pinned panel stays open, and still is after a reload", async ({ page }) => {
    await arrive(page, "hud-fold-pin");

    await page.getByRole("button", { name: "Keep Controls open" }).click();
    await page.mouse.move(640, 300);
    await page.waitForTimeout(10_000);

    await expect(panel(page, "Flight controls")).toHaveAttribute("data-open", "true");
    await expect(panel(page, "Scout stats"), "the unpinned one should still fold").toHaveAttribute(
      "data-open",
      "false",
    );

    await page.reload();
    await page.waitForTimeout(3000);
    await page.mouse.move(640, 300);
    await page.waitForTimeout(10_000);

    await expect(panel(page, "Flight controls"), "the pin was forgotten").toHaveAttribute(
      "data-open",
      "true",
    );
    await expect(page.getByRole("button", { name: "Let Controls fold" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  test("it waits while the pointer is over it, and reopening starts the count again", async ({
    page,
  }) => {
    await arrive(page, "hud-fold-hover");

    const notes = panel(page, "Field notes");

    await notes.hover();
    await page.waitForTimeout(10_000);
    await expect(notes, "it folded out from under the pointer").toHaveAttribute("data-open", "true");

    await page.mouse.move(640, 300);
    await expect(notes).toHaveAttribute("data-open", "false", { timeout: 10_000 });

    // Opened again by hand, it gets the whole count again.
    await notes.getByRole("button", { name: "Field Notes", exact: true }).click();
    await page.mouse.move(640, 300);
    await page.waitForTimeout(5000);
    await expect(notes, "a reopened panel folded early").toHaveAttribute("data-open", "true");
    await expect(notes).toHaveAttribute("data-open", "false", { timeout: 6_000 });
  });
});
