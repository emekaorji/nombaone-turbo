import { verifyApiKey } from '@nombaone/sara/api-keys';

import { db, pool } from '../src/shared/config/db';

/**
 * Prove an API key authenticates through the REAL request-time path
 * (`verifyApiKey`): SHA-256 lookup, revoked check, constant-time compare, env
 * match. Pass the secret as argv[2]. Run from apps/api with env loaded:
 *   pnpm --filter @nombaone/api exec tsx --env-file=.env scripts/verify-docs-key.ts <key>
 */

const main = async (): Promise<void> => {
  const key = process.argv[2];
  if (!key) throw new Error('Usage: verify-docs-key.ts <nbo_test_...>');
  const verified = await verifyApiKey(db, key);
  console.log('\nKEY AUTHENTICATES ✓');
  console.log(`  organizationId : ${verified.organizationId}`);
  console.log(`  environment    : ${verified.environment}`);
  console.log(`  scopes         : ${verified.scopes.length}`);
  console.log('');
};

main()
  .catch((error) => {
    console.error('KEY REJECTED ✗:', error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => {
    void pool.end();
  });
