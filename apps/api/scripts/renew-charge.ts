/* eslint-disable import/order */
// Prove automatic card RENEWAL: recharge the saved tokenKey (no customer present) via the
// card rail's tokenized-card-payment, scoped to our sub-account, for a fresh invoice.
// The async charge → payment_success webhook → the running app settles it.
//   npx tsx scripts/renew-charge.ts
import { randomUUID } from 'node:crypto';

import { env } from '../src/shared/config/env';
import { db } from '../src/shared/config/db';
import { getNombaClient } from '../src/shared/config/nomba';
import { createCardRail } from '@nombaone/sara/rails';
import { customersTable, invoicesTable, organizationsTable } from '@nombaone/core-db/schema';
import { mintReference } from '@nombaone/sara/reference';

const TOKEN_KEY = '7772492745';
const TOKEN_EMAIL = 'e2e.1782960200346@gmail.com'; // the email the Verve card was tokenized under
const AMOUNT_KOBO = 10000; // ₦100

async function main(): Promise<void> {
  const environment = env.INFRA_ENVIRONMENT;
  const orgId = randomUUID();
  await db.insert(organizationsTable).values({ id: orgId, reference: mintReference('ORG'), name: 'Renewal Test' });
  const custId = randomUUID();
  await db.insert(customersTable).values({
    id: custId,
    reference: mintReference('CUS'),
    organizationId: orgId,
    environment,
    email: TOKEN_EMAIL,
    name: 'Renewal Customer',
  });
  const invRef = mintReference('INV');
  await db.insert(invoicesTable).values({
    reference: invRef,
    organizationId: orgId,
    environment,
    customerId: custId,
    billingReason: 'subscription_cycle',
    subtotal: AMOUNT_KOBO,
    total: AMOUNT_KOBO,
    amountDue: AMOUNT_KOBO,
    finalizedAt: new Date(),
  });

  // Merchant-initiated recharge of the saved card — the actual renewal path.
  const rail = createCardRail(getNombaClient());
  const res = await rail.collect({
    organizationId: orgId,
    environment,
    reference: invRef,
    amountKobo: AMOUNT_KOBO,
    metadata: {
      tokenKey: TOKEN_KEY,
      customerId: custId,
      customerEmail: TOKEN_EMAIL,
      callbackUrl: 'https://tunnel.nombaone.xyz/callback',
      accountId: env.NOMBA_SUBACCOUNT_ID, // sub-account scope → webhook fires + funds land here
    },
  });
  console.log('RENEWAL_INVOICE_REF=', invRef);
  console.log('RENEWAL_CHARGE_RESULT=', JSON.stringify(res));
  process.exit(0);
}
main().catch((e) => {
  console.error('RENEW_ERR=', e instanceof Error ? e.message : String(e));
  process.exit(1);
});
