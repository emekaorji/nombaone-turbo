import { defineConfig, devices } from '@playwright/test';

/**
 * Browser proof for Iron Republic.
 *
 * These tests drive a REAL browser against a REAL Next.js server talking to the REAL local
 * billing engine on :8000. Nothing here is mocked — a "payment" in these tests is a
 * genuine subscription in the engine, with genuine invoices.
 *
 * Start the engine first (`apps/api`, port 8000). The web server below is started for you.
 */
export default defineConfig({
  testDir: './tests',
  timeout: 90_000,
  expect: { timeout: 15_000 },
  fullyParallel: false, // these share one engine + one SQLite file; serial is honest
  workers: 1,
  retries: 0,
  reporter: [['list']],

  use: {
    baseURL: 'http://localhost:8060',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },

  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } },
  ],

  webServer: {
    command: 'pnpm dev',
    url: 'http://localhost:8060',
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
