import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    // Integration suites (if added) spin a real Postgres via testcontainers and
    // run migrations in a `beforeAll`; the first run may pull the image.
    testTimeout: 60_000,
    hookTimeout: 120_000,
    // Each integration file spins its own container — cap concurrency so Docker
    // isn't overwhelmed.
    maxWorkers: 3,
    minWorkers: 1,
    // @nombaone/core-db's pool module reads INFRA_DATABASE_URL at import time and
    // builds a lazy (never-connected) default pool; this dummy lets it load.
    // INFRA_PII_ENCRYPTION_KEY is the fixed 32-byte test key for crypto tests.
    env: {
      INFRA_DATABASE_URL: 'postgresql://test:test@127.0.0.1:1/test',
      INFRA_PII_ENCRYPTION_KEY: 'AAECAwQFBgcICQoLDA0ODxAREhMUFRYXGBkaGxwdHh8=',
    },
    // Workspace packages export TypeScript source — let vitest transform them.
    server: { deps: { inline: [/@nombaone\//] } },
  },
});
