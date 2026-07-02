import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { GenericContainer, type StartedTestContainer, Wait } from 'testcontainers';

import type { Express } from 'express';
import type { InfraTxDb } from '@nombaone/sara/context';
import type { NombaClient } from '@nombaone/sara/nomba';

// This harness deliberately writes process.env at runtime to point the app's
// singletons at throwaway containers — it never READS undeclared env, so the
// turbo env-var rule (meant for build-time reads) does not apply here.
/* eslint-disable turbo/no-undeclared-env-vars */

/**
 * ── The e2e harness ────────────────────────────────────────────────────────
 *
 * Stands up REAL Postgres + Redis in throwaway containers, points the app's env
 * at them, runs the schema migrations, and only THEN dynamically imports the app.
 *
 * The import order is the whole trick: `src/shared/config/{env,db,redis}` bind
 * singletons (the zod-validated env, the pg pool, the ioredis client) AT IMPORT
 * TIME. So we MUST set `process.env` before any `import` of app code runs — hence
 * every app/sara import here is a dynamic `await import(...)` performed after
 * `setEnv()`. A static top-level import would snapshot the wrong (or missing)
 * env and the pool/redis would point nowhere.
 *
 * Exposes the started Express app plus the seed helpers the spec drives:
 * `seedOrg()`, `mintApiKey()`, `setKillSwitch()`.
 */

const currentDir = dirname(fileURLToPath(import.meta.url));
// apps/api/test/helpers → packages/core-db/migrations
const MIGRATIONS_FOLDER = resolve(currentDir, '../../../../packages/core-db/migrations');

export interface Harness {
  app: Express;
  /** Create an organization (tenant genesis) → its id. */
  seedOrg: (name?: string) => Promise<{ organizationId: string; reference: string }>;
  /** Mint an API key for an org in a given environment → the raw secret. */
  mintApiKey: (
    organizationId: string,
    environment: 'test' | 'live',
    scopes: string[]
  ) => Promise<{ secret: string; reference: string }>;
  /** Flip the platform maintenance kill-switch on/off. */
  setKillSwitch: (enabled: boolean, message?: string) => Promise<void>;
  /** The pooled DB handle — lets specs drive sara functions directly (e.g. the
   *  inbound-webhook settle path the BullMQ worker runs). */
  db: InfraTxDb;
  /** Inject a fake Nomba client (no network) for the rail/capture flows. */
  setNombaClient: (client: NombaClient) => void;
  /** Tear down containers + clients. */
  stop: () => Promise<void>;
}

export const startHarness = async (): Promise<Harness> => {
  // 1. Boot the infra containers.
  const postgres: StartedPostgreSqlContainer = await new PostgreSqlContainer('postgres:16-alpine')
    .withDatabase('nombaone_infra')
    .withUsername('nombaone')
    .withPassword('nombaone')
    .start();

  const redisContainer: StartedTestContainer = await new GenericContainer('redis:7-alpine')
    .withExposedPorts(6379)
    .withWaitStrategy(Wait.forLogMessage('Ready to accept connections'))
    .start();

  const databaseUrl = postgres.getConnectionUri();
  const redisUrl = `redis://${redisContainer.getHost()}:${redisContainer.getMappedPort(6379)}`;

  // 2. Set env BEFORE importing ANY app/sara/db code. The singletons bind here.
  process.env.NODE_ENV = 'test';
  process.env.PORT = '0';
  process.env.INFRA_ENVIRONMENT = 'test';
  process.env.INFRA_DATABASE_URL = databaseUrl;
  process.env.REDIS_URL = redisUrl;
  process.env.INFRA_PII_ENCRYPTION_KEY =
    process.env.INFRA_PII_ENCRYPTION_KEY ?? '0'.repeat(64);
  process.env.INFRA_WEBHOOK_SECRET = process.env.INFRA_WEBHOOK_SECRET ?? 'test_webhook_secret';
  process.env.NOMBA_WEBHOOK_SIGNATURE_KEY =
    process.env.NOMBA_WEBHOOK_SIGNATURE_KEY ?? 'test_nomba_signature_key';
  // Pin these OFF so tests are deterministic regardless of a developer's `.env`:
  // debug mode would bypass signature REJECTION, and the payout flag would fire the
  // (unconfirmed) provider bankTransfer. Set before dotenv (override:false keeps them).
  process.env.NOMBA_WEBHOOK_DEBUG = 'false';
  process.env.NOMBA_PAYOUT_ENABLED = 'false';
  // Keep the limiter on by default so its tests are meaningful; specs can flip it.
  delete process.env.DISABLE_API_RATE_LIMIT;

  // 3. Run migrations against the fresh database (drizzle generate/migrate output).
  //    Use core-db's pool factory so we never depend on `pg` directly here.
  const { migrate } = await import('drizzle-orm/node-postgres/migrator');
  const { createPoolDb } = await import('@nombaone/core-db/pool');
  const { db: migrationDb, pool: migrationPool } = createPoolDb({ connectionString: databaseUrl });
  try {
    await migrate(migrationDb, { migrationsFolder: MIGRATIONS_FOLDER });
  } finally {
    await migrationPool.end();
  }

  // 4. NOW import the app + the sara/db handles (they bind to the env above).
  //    Compose the two import-safe app factories here (mirrors src/server.ts's
  //    createSuperApp) rather than importing server.ts, whose module top-level
  //    boots the listener + workers.
  const express = (await import('express')).default;
  const { createMainApp } = await import('../../src/apps/main/server');
  const { createWebhookApp } = await import('../../src/apps/webhook/server');
  const { db, pool } = await import('../../src/shared/config/db');
  const { redis } = await import('../../src/shared/config/redis');
  const { signupOrganization } = await import('@nombaone/sara/auth');
  const { createApiKey } = await import('@nombaone/sara/api-keys');
  const { platformConfigTable } = await import('@nombaone/core-db/schema');
  const { __setNombaClient } = await import('../../src/shared/config/nomba');

  const app = express();
  app.disable('x-powered-by');
  app.use('/webhooks', createWebhookApp());
  app.use(createMainApp());

  const seedOrg: Harness['seedOrg'] = async (name = 'Test Org') => {
    const suffix = Math.random().toString(36).slice(2, 10);
    const { organization } = await signupOrganization(db, {
      organizationName: `${name} ${suffix}`,
      name: 'Test Owner',
      email: `owner+${suffix}@test.local`,
      password: 'password123!',
    });
    return { organizationId: organization.id, reference: organization.reference };
  };

  const mintApiKey: Harness['mintApiKey'] = async (organizationId, environment, scopes) => {
    const key = await createApiKey(
      db,
      { organizationId, environment },
      { name: 'test key', scopes }
    );
    return { secret: key.secret, reference: key.reference };
  };

  const setKillSwitch: Harness['setKillSwitch'] = async (enabled, message) => {
    await db
      .insert(platformConfigTable)
      .values({ key: 'maintenance', value: { enabled, message } })
      .onConflictDoUpdate({
        target: platformConfigTable.key,
        set: { value: { enabled, message }, updatedAt: new Date() },
      });
    // The gate caches for a few seconds; wait it out so the spec sees the change.
    await new Promise((r) => setTimeout(r, 5_100));
  };

  const setNombaClient: Harness['setNombaClient'] = (client) => __setNombaClient(client);

  const stop: Harness['stop'] = async () => {
    __setNombaClient(null);
    await pool.end();
    redis.disconnect();
    await postgres.stop();
    await redisContainer.stop();
  };

  return { app, seedOrg, mintApiKey, setKillSwitch, db, setNombaClient, stop };
};
