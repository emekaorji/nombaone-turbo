/**
 * Local console seed (`pnpm -F @nombaone/console seed:local`).
 *
 * Populates the LOCAL Postgres (the container at the `INFRA_DATABASE_URL` in
 * `apps/console/.env`) with a small, FK-consistent, ledger-balanced dataset so
 * every console screen has data to render: one organization + owner, a couple of
 * API keys, a webhook endpoint, and a handful of example money-path resources.
 *
 * It only USES `@nombaone/sara` / `@nombaone/core-db` (never edits them) — it
 * drives the real domain verbs (`signupOrganization`, `createApiKey`,
 * `createWebhookEndpoint`, `createExample`) so the seed exercises the exact code
 * paths the console reads back. Idempotent at the org level: it skips if the seed
 * owner already exists.
 *
 * Provider-free and deterministic: example creation posts to the in-process mock
 * rail registered by `@nombaone/sara` — no external calls.
 */

// Load apps/console/.env into process.env BEFORE any @nombaone import so the
// pool singleton + crypto util see INFRA_DATABASE_URL / INFRA_PII_ENCRYPTION_KEY.
import './load-env';

import { createPoolDb } from '@nombaone/core-db/pool';
import { signupOrganization, findUserByEmail } from '@nombaone/sara/auth';
import { createApiKey } from '@nombaone/sara/api-keys';
import { createWebhookEndpoint } from '@nombaone/sara/webhooks';
import { createExample } from '@nombaone/sara/example';
import type { DomainContext } from '@nombaone/sara/context';

const SEED_EMAIL = 'owner@acme.test';
const SEED_PASSWORD = 'password123';

async function main(): Promise<void> {
  const { db: txDb, pool } = createPoolDb({ databaseUrl: process.env.INFRA_DATABASE_URL });

  const existing = await findUserByEmail(txDb, SEED_EMAIL);
  if (existing) {
    console.log(`[seed] ${SEED_EMAIL} already exists — nothing to do.`);
    await pool.end();
    return;
  }

  // 1. Atomic signup: org + owner + system accounts + session.
  const { organization } = await signupOrganization(txDb, {
    organizationName: 'Acme Payments',
    name: 'Ada Owner',
    email: SEED_EMAIL,
    password: SEED_PASSWORD,
  });
  console.log(`[seed] organization ${organization.reference}`);

  // New tenants start in the `sandbox` mode.
  const ctx: DomainContext = { organizationId: organization.id, mode: 'sandbox' };

  // 2. API keys (the secret is logged once here for local convenience only).
  const key = await createApiKey(txDb, ctx, {
    name: 'Production backend',
    scopes: ['example:read', 'example:write', 'webhooks:read', 'webhooks:write'],
  });
  await createApiKey(txDb, ctx, { name: 'Read-only dashboard', scopes: ['example:read'] });
  console.log(`[seed] api key ${key.reference} secret=${key.secret}`);

  // 3. Webhook endpoint.
  const endpoint = await createWebhookEndpoint(txDb, ctx, {
    url: 'https://acme.test/webhooks/nombaone',
    enabledEvents: ['*'],
  });
  console.log(`[seed] webhook ${endpoint.reference} secret=${endpoint.signingSecret}`);

  // 4. A handful of example money-path resources (each posts a balanced charge).
  const specs: { kind: 'standard' | 'priority'; amount: number }[] = [
    { kind: 'standard', amount: 250_000 },
    { kind: 'priority', amount: 1_500_000 },
    { kind: 'standard', amount: 75_000 },
    { kind: 'standard', amount: 4_200_000 },
  ];
  for (const spec of specs) {
    const example = await createExample(txDb, ctx, spec);
    console.log(`[seed] example ${example.id} ${spec.kind} ${spec.amount}`);
  }

  console.log('\n[seed] done. Log in with:');
  console.log(`  email:    ${SEED_EMAIL}`);
  console.log(`  password: ${SEED_PASSWORD}`);

  await pool.end();
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('[seed] failed', err);
    process.exit(1);
  });
