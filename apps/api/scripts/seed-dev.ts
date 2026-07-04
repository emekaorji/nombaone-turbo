import { createApiKey } from '@nombaone/sara/api-keys';
import { signupOrganization } from '@nombaone/sara/auth';

import { db, pool } from '../src/shared/config/db';
import { env } from '../src/shared/config/env';

import type { ApiKeyScope } from '@nombaone/core-contracts/types';

/**
 * Dev seed: bring up ONE organization (atomic tenant genesis — org + owner +
 * system ledger accounts) and mint ONE API key for it, then print the secret so
 * you can immediately curl the API. The secret is shown ONCE here (sara never
 * stores it), exactly as a real mint would behave.
 *
 * Run with `pnpm seed:dev`. The key is minted in `sandbox` mode (its prefix is
 * `nbo_sandbox_`), which authenticates on any deployment — live keys are reserved
 * for production.
 */

const SCOPES: ApiKeyScope[] = ['example:read', 'example:write'];

const main = async (): Promise<void> => {
  const suffix = Date.now().toString(36);
  const email = `dev+${suffix}@nombaone.local`;

  const { organization, user } = await signupOrganization(db, {
    organizationName: `Dev Org ${suffix}`,
    name: 'Dev Owner',
    email,
    password: 'devpassword123!',
  });

  // Mint a key in THIS deployment's environment so it works against this host.
  const key = await createApiKey(
    db,
    { organizationId: organization.id, mode: 'sandbox' },
    { name: 'dev key', scopes: SCOPES, createdByUserId: user.id }
  );

  console.log(
    [
      '',
      'Seeded dev tenant:',
      `  organization : ${organization.reference} (${organization.name})`,
      `  owner email  : ${email}`,
      `  mode         : sandbox`,
      `  api key ref  : ${key.reference}`,
      `  api key      : ${key.secret}   <-- shown once, store it now`,
      `  scopes       : ${key.scopes.join(', ')}`,
      '',
      'Try it:',
      `  curl -H "Authorization: Bearer ${key.secret}" http://localhost:${env.PORT}/v1/examples`,
      '',
    ].join('\n')
  );
};

main()
  .catch((error) => {
    console.error('[seed:dev] failed:', error);
    process.exitCode = 1;
  })
  .finally(() => {
    void pool.end();
  });
