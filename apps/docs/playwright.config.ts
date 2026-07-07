import { defineConfig, devices } from "@playwright/test";

/**
 * E2E config for the docs. Targets the already-running dev server on :8030
 * (start it with `pnpm dev`). Run: `pnpm exec playwright test`.
 */
export default defineConfig({
  testDir: "./tests",
  timeout: 60_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: "http://localhost:8030",
    headless: true,
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
