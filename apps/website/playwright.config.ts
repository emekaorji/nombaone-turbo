import { defineConfig, devices } from "@playwright/test";

/**
 * Visual + structural verification harness. Boots the dev server on 8050,
 * visits every route at desktop (1440) and mobile (390), captures full-page
 * screenshots to `.design-refs/actual/<project>/`, and asserts no page errors.
 * The .pen frames are the reference (see VERIFY.md for the route -> node-id map).
 */
export default defineConfig({
  testDir: "./tests",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [["list"]],
  use: {
    baseURL: "http://localhost:8050",
    trace: "on-first-retry",
  },
  webServer: {
    command: "pnpm dev",
    url: "http://localhost:8050",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  projects: [
    {
      name: "desktop",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } },
    },
    {
      name: "mobile",
      use: { ...devices["Pixel 7"], viewport: { width: 390, height: 844 } },
    },
  ],
});
