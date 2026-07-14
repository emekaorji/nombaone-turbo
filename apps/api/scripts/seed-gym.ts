/**
 * Provision the Iron Republic merchant: one organization + one API key with the scopes
 * the gym reference app actually uses. Prints the key ONCE.
 *
 *   npx tsx --env-file=.env scripts/seed-gym.ts
 */
import { createApiKey } from '@nombaone/sara/api-keys';

import { db, pool } from '../src/shared/config/db';
import { seedTestOrganization } from './_seed';

import type { ApiKeyScope } from '@nombaone/core-contracts/types';

const SCOPES: ApiKeyScope[] = [
  'customers:read', 'customers:write',
  'plans:read', 'plans:write',
  'prices:read', 'prices:write',
  'payment_methods:read', 'payment_methods:write',
  'subscriptions:read', 'subscriptions:write',
  'invoices:read', 'invoices:write',
  'settlements:read', 'settlements:write',
  'organizations:read', 'organizations:write',
  'metrics:read',
  'webhooks:read', 'webhooks:write',
];

async function main(): Promise<void> {
  const seeded = await seedTestOrganization(db, {
    organizationName: 'Iron Republic',
    name: 'Emeka Orji',
    email: `gym.owner.${Date.now()}@nombaone.xyz`,
    password: 'IronRepublic!2026',
  });
  const key = await createApiKey(
    db,
    { organizationId: seeded.organization.id, mode: 'sandbox' },
    { name: 'Iron Republic (gym reference app)', scopes: SCOPES }
  );
  console.log('ORG_ID=' + seeded.organization.id);
  console.log('NOMBAONE_API_KEY=' + key.secret);
  await pool.end();
}
main().catch((e) => { console.error(e); process.exit(1); });
