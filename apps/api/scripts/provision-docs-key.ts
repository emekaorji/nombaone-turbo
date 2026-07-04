import { eq } from 'drizzle-orm';

import { createApiKey } from '@nombaone/sara/api-keys';
import { signupOrganization } from '@nombaone/sara/auth';
import { organizationsTable } from '@nombaone/core-db/schema';

import { db, pool } from '../src/shared/config/db';

import type { ApiKeyScope } from '@nombaone/core-contracts/types';

/**
 * Provision a real, working SANDBOX (`nbo_test_`) API key for the docs, the same
 * way a dashboard signup would: an atomic tenant genesis (organization + owner +
 * system ledger accounts) via `signupOrganization`, then a full-scope key via
 * `createApiKey`. The secret is SHA-256 hashed at rest and shown here exactly
 * once — copy it now.
 *
 * Idempotent: it reuses the "Nomba One Docs Sandbox" org if it already exists and
 * just mints a fresh key for it, so re-running does not spawn duplicate tenants.
 *
 * Run from apps/api (so `.env` → INFRA_DATABASE_URL loads):
 *   pnpm --filter @nombaone/api exec tsx scripts/provision-docs-key.ts
 *
 * The key is `test`-environment (a `nbo_test_` secret) because the docs playground
 * is sandbox-only and rejects `nbo_live_` keys outright. Minting a live key would
 * need `environment: 'live'` here — deliberately not done: it moves real money and
 * the docs proxy refuses it.
 */

const ORG_NAME = 'Nomba One Docs Sandbox';
const OWNER_EMAIL = 'docs-sandbox@nombaone.local';

/** Every scope, so the docs playground can exercise the whole API surface. */
const ALL_SCOPES: ApiKeyScope[] = [
  'customers:read', 'customers:write',
  'plans:read', 'plans:write',
  'prices:read', 'prices:write',
  'payment_methods:read', 'payment_methods:write',
  'mandates:write',
  'subscriptions:read', 'subscriptions:write',
  'invoices:read', 'invoices:write',
  'coupons:read', 'coupons:write',
  'billing_settings:read', 'billing_settings:write',
  'settlements:read', 'settlements:write',
  'organizations:read', 'organizations:write',
  'metrics:read',
  'example:read', 'example:write',
  'webhooks:read', 'webhooks:write',
];

const main = async (): Promise<void> => {
  // Reuse the stable docs org if it exists; otherwise do a real atomic signup.
  let [organization] = await db
    .select()
    .from(organizationsTable)
    .where(eq(organizationsTable.name, ORG_NAME))
    .limit(1);

  let ownerUserId: string | undefined;
  let created = false;

  if (!organization) {
    const result = await signupOrganization(db, {
      organizationName: ORG_NAME,
      name: 'Docs Owner',
      email: OWNER_EMAIL,
      password: `docs-${Date.now().toString(36)}-Aa1!`,
    });
    organization = result.organization;
    ownerUserId = result.user.id;
    created = true;
  }

  const key = await createApiKey(
    db,
    { organizationId: organization.id, environment: 'test' },
    { name: 'docs sandbox key', scopes: ALL_SCOPES, createdByUserId: ownerUserId },
  );

  console.log(
    [
      '',
      `Docs sandbox tenant ${created ? '(newly provisioned)' : '(reused existing org)'}:`,
      `  organization : ${organization.reference} (${organization.name})`,
      `  environment  : test`,
      `  api key ref  : ${key.reference}`,
      `  scopes       : ${key.scopes.length} (full surface)`,
      '',
      '  ── SECRET (shown once — store it now) ──',
      `  ${key.secret}`,
      '',
      'Wire it into the docs (apps/docs/.env):',
      `  INFRA_DEMO_SANDBOX_KEY=${key.secret}`,
      '',
      'Smoke-test it:',
      `  curl -H "Authorization: Bearer ${key.secret}" \\`,
      `    "$NEXT_PUBLIC_INFRA_API_BASE/customers"`,
      '',
    ].join('\n'),
  );
};

main()
  .catch((error) => {
    console.error('[provision-docs-key] failed:', error);
    process.exitCode = 1;
  })
  .finally(() => {
    void pool.end();
  });
