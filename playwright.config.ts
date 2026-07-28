import { defineConfig, devices } from "@playwright/test";

/**
 * WebGL in headless Chromium needs to be told to use a real backend, or the game
 * renders nothing and every test that touches the canvas fails for a reason that
 * has nothing to do with the code.
 */

/**
 * The port, overridable.
 *
 * It was pinned to 3000, which is fine until something else is already on 3000 —
 * and because `reuseExistingServer` is on outside CI, Playwright would then
 * happily REUSE that stranger and run the whole suite against somebody else's
 * app. The failures that produces are baffling, and the passes are worse. Set
 * `PLAYWRIGHT_PORT` to move both the server and the baseURL together.
 */
const PORT = Number(process.env.PLAYWRIGHT_PORT ?? 3000);
const BASE_URL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? "github" : "list",
  timeout: 120_000,
  expect: { timeout: 15_000 },

  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry",
  },

  projects: [
    {
      name: "chromium",
      // The touch spec needs a touch device; it has its own projects below.
      testIgnore: /mobile\.spec\.ts/,
      use: {
        ...devices["Desktop Chrome"],
        // Headless Chromium needs a real GL backend or the canvas renders
        // nothing and every scene test fails for reasons unrelated to the code.
        // These flags are Chromium-only — passing them to Firefox or WebKit
        // makes the browser refuse to launch at all.
        launchOptions: {
          args: [
            "--use-gl=angle",
            "--use-angle=metal",
            "--enable-unsafe-swiftshader",
          ],
        },
      },
    },
    {
      name: "firefox",
      testIgnore: /mobile\.spec\.ts/,
      use: { ...devices["Desktop Firefox"] },
    },
    {
      // Safari's engine. Worth running even though the game is desktop-first:
      // WebGL, pointer lock and Web Audio all behave differently here, and a
      // scene that never renders in WebKit is not something to find out from a
      // player.
      name: "webkit",
      testIgnore: /mobile\.spec\.ts/,
      use: { ...devices["Desktop Safari"] },
    },
    /**
     * The touch surfaces. Chromium rather than WebKit, because the GL flags below
     * are what make the canvas render at all in headless, and only Chromium takes
     * them. That is a real limit worth stating: this proves the touch CONTROLS,
     * not iOS Safari, which still has to be checked on a device.
     *
     * `hasTouch` and `isMobile` are what make `(pointer: coarse)` match, which is
     * the query the pad is gated on.
     */
    {
      name: "phone",
      testMatch: /mobile\.spec\.ts/,
      use: {
        ...devices["Pixel 5 landscape"],
        launchOptions: {
          args: [
            "--use-gl=angle",
            "--use-angle=metal",
            "--enable-unsafe-swiftshader",
          ],
        },
      },
    },
    {
      name: "tablet",
      testMatch: /mobile\.spec\.ts/,
      use: {
        ...devices["Galaxy Tab S4 landscape"],
        launchOptions: {
          args: [
            "--use-gl=angle",
            "--use-angle=metal",
            "--enable-unsafe-swiftshader",
          ],
        },
      },
    },
  ],

  webServer: {
    command: "npm run dev",
    url: BASE_URL,
    env: { PORT: String(PORT) },
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
