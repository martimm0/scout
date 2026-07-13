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
    launchOptions: {
      args: [
        "--use-gl=angle",
        "--use-angle=metal",
        "--enable-unsafe-swiftshader",
      ],
    },
  },

  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],

  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
