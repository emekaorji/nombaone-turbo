/* eslint-disable import/order */
// Seed a real org+customer+finalized-open invoice (₦100) in the LIVE db, then create a
// Nomba checkout whose orderReference == the invoice reference + scoped to our sub-account.
// Paying it fires a webhook that the running app settles this exact invoice.
//   npx tsx scripts/seed-invoice.ts
import { randomUUID } from 'node:crypto';

import { env } from '../src/shared/config/env';
import { scriptSubAccountId } from './_subaccount';
import { db } from '../src/shared/config/db';
import { getNombaClient } from '../src/shared/config/nomba';
import { customersTable, invoicesTable, organizationsTable } from '@nombaone/core-db/schema';
import { koboToNombaAmount, NOMBA_ENDPOINTS } from '@nombaone/sara/nomba';
import { mintReference } from '@nombaone/sara/reference';

const AMOUNT_KOBO = Number(process.argv[2]) || 10000; // kobo; default ₦100

async function main(): Promise<void> {
  const mode = 'live' as const; // live-testing harness runs against the NOMBA_LIVE_* account
  const orgId = randomUUID();
  await db.insert(organizationsTable).values({ id: orgId, reference: mintReference('ORG'), name: 'Live E2E Org' });
  const custId = randomUUID();
  await db.insert(customersTable).values({
    id: custId,
    reference: mintReference('CUS'),
    organizationId: orgId,
    mode,
    email: `e2e-cust-${Date.now()}@nombaone.xyz`,
    name: 'Live E2E Customer',
  });
  const invRef = mintReference('INV');
  await db.insert(invoicesTable).values({
    reference: invRef,
    organizationId: orgId,
    mode,
    customerId: custId,
    billingReason: 'manual',
    subtotal: AMOUNT_KOBO,
    total: AMOUNT_KOBO,
    amountDue: AMOUNT_KOBO,
    finalizedAt: new Date(),
  });

  const res = await getNombaClient('live').request({
    method: 'POST',
    endpoint: NOMBA_ENDPOINTS.checkoutOrder,
    idempotencyRef: invRef,
    body: {
      tokenizeCard: process.argv.includes('--tokenize'),
      order: {
        orderReference: invRef, // ← the invoice reference; the webhook will settle THIS invoice
        accountId: scriptSubAccountId, // sub-account → webhook fires
        amount: koboToNombaAmount(AMOUNT_KOBO), // "100.00"
        currency: 'NGN',
        callbackUrl: 'https://tunnel.nombaone.xyz/callback',
        customerId: custId,
        customerEmail: `e2e.${Date.now()}@gmail.com`,
      },
    },
  });
  const data = (res.data as { data?: Record<string, unknown> })?.data ?? {};
  console.log('INVOICE_REF=', invRef);
  console.log('ORG_ID=', orgId);
  console.log('AMOUNT_KOBO=', AMOUNT_KOBO, '→ naira', koboToNombaAmount(AMOUNT_KOBO));
  console.log('CHECKOUT_LINK=', data.checkoutLink);
  console.log('NOMBA_ORDER_ID=', data.orderReference);
  process.exit(0);
}
main().catch((e) => {
  console.error('SEED_ERR=', e instanceof Error ? e.message : String(e));
  process.exit(1);
});
