/* eslint-disable import/order */
// Raw tokenized-card-payment to capture the FULL response (transactionId + OTP-required
// status) so we understand the 2-step OTP flow.  npx tsx scripts/raw-charge.ts
import { randomUUID } from 'node:crypto';

import { env } from '../src/shared/config/env';
import { db } from '../src/shared/config/db';
import { getNombaClient } from '../src/shared/config/nomba';
import { customersTable, invoicesTable, organizationsTable } from '@nombaone/core-db/schema';
import { koboToNombaAmount, NOMBA_ENDPOINTS } from '@nombaone/sara/nomba';
import { mintReference } from '@nombaone/sara/reference';

const TOKEN_KEY = process.argv[2] ?? '7772492745';
const TOKEN_EMAIL = process.argv[3] ?? 'e2e.1782960200346@gmail.com';
const AMOUNT_KOBO = 10000;

async function main(): Promise<void> {
  const mode = 'live' as const; // live-testing harness runs against the NOMBA_LIVE_* account
  const orgId = randomUUID();
  await db.insert(organizationsTable).values({ id: orgId, reference: mintReference('ORG'), name: 'Renewal2' });
  const custId = randomUUID();
  await db.insert(customersTable).values({
    id: custId, reference: mintReference('CUS'), organizationId: orgId, mode, email: TOKEN_EMAIL, name: 'Renewal2',
  });
  const invRef = mintReference('INV');
  await db.insert(invoicesTable).values({
    reference: invRef, organizationId: orgId, mode, customerId: custId,
    billingReason: 'subscription_cycle', subtotal: AMOUNT_KOBO, total: AMOUNT_KOBO, amountDue: AMOUNT_KOBO, finalizedAt: new Date(),
  });

  const res = await getNombaClient('live').request({
    method: 'POST',
    endpoint: NOMBA_ENDPOINTS.tokenizedCardCharge,
    idempotencyRef: invRef,
    body: {
      tokenKey: TOKEN_KEY,
      order: {
        amount: koboToNombaAmount(AMOUNT_KOBO),
        currency: 'NGN',
        customerId: custId,
        customerEmail: TOKEN_EMAIL,
        callbackUrl: 'https://tunnel.nombaone.xyz/callback',
        orderReference: invRef,
        accountId: env.NOMBA_LIVE_SUBACCOUNT_ID,
      },
    },
  });
  console.log('INVOICE_REF=', invRef);
  console.log('CHARGE_HTTP=', res.status);
  console.log('CHARGE_RESPONSE=', JSON.stringify(res.data, null, 2));
  process.exit(0);
}
main().catch((e) => {
  console.error('RAW_CHARGE_ERR=', e instanceof Error ? e.message : String(e));
  process.exit(1);
});
