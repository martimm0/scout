import { defineConfig, devices } from "@playwright/test";

/**
 * WebGL in headless Chromium needs to be told to use a real backend, or the game
 * renders nothing and every test that touches the canvas fails for a reason that
 * has nothing to do with the code.
 */
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
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
  },

  projects: [
    {
      name: "chromium",
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
      use: { ...devices["Desktop Firefox"] },
    },
    {
      // Safari's engine. Worth running even though the game is desktop-first:
      // WebGL, pointer lock and Web Audio all behave differently here, and a
      // scene that never renders in WebKit is not something to find out from a
      // player.
      name: "webkit",
      use: { ...devices["Desktop Safari"] },
    },
  ],

  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
