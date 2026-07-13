/* eslint-disable import/order */
// Prove automatic card RENEWAL: recharge the saved tokenKey (no customer present) via the
// card rail's tokenized-card-payment, scoped to our sub-account, for a fresh invoice.
// The async charge → payment_success webhook → the running app settles it.
//   npx tsx scripts/renew-charge.ts
import { randomUUID } from 'node:crypto';

import { db } from '../src/shared/config/db';
import { getNombaClient } from '../src/shared/config/nomba';
import { createCardRail } from '@nombaone/sara/rails';
import { customersTable, invoicesTable, organizationsTable } from '@nombaone/core-db/schema';
import { mintReference } from '@nombaone/sara/reference';

const TOKEN_KEY = '7772492745';
const TOKEN_EMAIL = 'e2e.1782960200346@gmail.com'; // the email the Verve card was tokenized under
const AMOUNT_KOBO = 10000; // ₦100

async function main(): Promise<void> {
  const mode = 'live' as const; // live-testing harness runs against the NOMBA_LIVE_* account
  const orgId = randomUUID();
  await db.insert(organizationsTable).values({ id: orgId, reference: mintReference('ORG'), name: 'Renewal Test' });
  const custId = randomUUID();
  const custRef = mintReference('CUS');
  await db.insert(customersTable).values({
    id: custId,
    reference: custRef,
    organizationId: orgId,
    mode,
    email: TOKEN_EMAIL,
    name: 'Renewal Customer',
  });
  const invRef = mintReference('INV');
  await db.insert(invoicesTable).values({
    reference: invRef,
    organizationId: orgId,
    mode,
    customerId: custId,
    billingReason: 'subscription_cycle',
    subtotal: AMOUNT_KOBO,
    total: AMOUNT_KOBO,
    amountDue: AMOUNT_KOBO,
    finalizedAt: new Date(),
  });

  // Merchant-initiated recharge of the saved card — the actual renewal path.
  // Metadata mirrors buildRailCollectMetadata's shape: the CUS reference (never
  // the UUID), and a sub-account id from the CLI (env-coded sub-accounts are
  // gone — they are minted per merchant into org_nomba_accounts).
  //   npx tsx scripts/renew-charge.ts <subAccountId>
  const subAccountId = process.argv[2];
  if (!subAccountId) {
    console.error('usage: npx tsx scripts/renew-charge.ts <subAccountId>');
    console.error('(without sub-account scoping the payment_success webhook never fires)');
    process.exit(1);
  }
  const rail = createCardRail(getNombaClient);
  const res = await rail.collect({
    organizationId: orgId,
    mode,
    reference: invRef,
    amountKobo: AMOUNT_KOBO,
    metadata: {
      invoice: invRef,
      paymentMethod: 'script-renew-charge',
      tokenKey: TOKEN_KEY,
      customerRef: custRef,
      customerEmail: TOKEN_EMAIL,
      callbackUrl: 'https://tunnel.nombaone.xyz/callback',
      accountId: subAccountId, // sub-account scope → webhook fires + funds land here
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
