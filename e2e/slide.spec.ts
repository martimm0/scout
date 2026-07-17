import { expect, test } from "@playwright/test";

import { enterGame, flyTo, hold, readout } from "./helpers";
import { slideRide } from "../src/features/game/world/slide-ride";
import { setActivePark, terrainHeight } from "../src/features/game/world/terrain";

/**
 * The Blue Slide ride.
 *
 * The cheap test first: the ride LINE is pure and derived from the slide's own
 * prop, so a desync (someone moves or turns the slide and the ride keeps aiming
 * at the old spot) shows up here without a browser. Then the real thing: fly to
 * the top and the bee actually rides down it.
 */
test.describe("the Blue Slide", () => {
  test("the ride line is Frick's, and it goes down", () => {
    setActivePark("schenley");
    expect(slideRide(), "only Frick has the slide").toBeNull();

    setActivePark("frick");
    const ride = slideRide();
    expect(ride).not.toBeNull();

    const top = ride!.at(0);
    const bottom = ride!.at(1);

    // The top stands well above the ground it is planted in, and the bottom is
    // lower than the top: the line runs downhill.
    expect(top.y).toBeGreaterThan(terrainHeight(215, 175) + 20);
    expect(bottom.y).toBeLessThan(top.y - 20);

    // Top and bottom are a slide apart, not the same point.
    expect(Math.hypot(bottom.x - top.x, bottom.z - top.z)).toBeGreaterThan(60);
    expect(Number.isFinite(ride!.yaw)).toBe(true);
  });

  test("fly to the top and you ride it down", async ({ page }) => {
    test.setTimeout(180_000);

    setActivePark("frick");
    const top = slideRide()!.top;

    await enterGame(page, 13);
    await page.goto("/play?park=frick&hour=13&weather=clear&debug=1");
    await page.waitForTimeout(3500);
    await page
      .getByRole("button", { name: "Skip", exact: true })
      .first()
      .click({ timeout: 8000 })
      .catch(() => {});

    await flyTo(page, { x: top.x, z: top.z });

    // Drop onto the top; the ride catches mid-descent and the area becomes the
    // slide with the bee down at ride height rather than up at cruising altitude.
    let caught = false;
    for (let i = 0; i < 24 && !caught; i += 1) {
      const state = await readout(page);
      caught =
        state.Area === "Blue Slide Playground" &&
        Number.parseFloat(state.Altitude ?? "999") < top.y + 6;
      if (!caught) await hold(page, "KeyQ", 280);
    }
    expect(caught, "caught the top of the slide").toBe(true);

    const startAltitude = Number.parseFloat((await readout(page)).Altitude ?? "0");

    // Let the ride run. It carries the bee down the slabs to the run-out.
    await page.waitForTimeout(2600);
    const end = await readout(page);
    const endAltitude = Number.parseFloat(end.Altitude ?? "0");
    const endZ = Number(/z\s*(-?[\d.]+)/.exec(end.Position ?? "")?.[1] ?? "0");

    // It went DOWN (the whole point of a slide) and along to the run-out, without
    // any input from us.
    expect(endAltitude).toBeLessThan(startAltitude - 20);
    expect(endZ).toBeGreaterThan(top.z + 40);
  });
});
