/* eslint-disable import/order */
// Create a LIVE ₦100 checkout scoped to OUR sub-account (order.accountId), tokenizeCard.
// Prints the checkoutLink + full response (learn the response shape / money unit).
//   npx tsx scripts/create-checkout.ts
import { env } from '../src/shared/config/env';
import { getNombaClient } from '../src/shared/config/nomba';
import { NOMBA_ENDPOINTS } from '@nombaone/sara/nomba';

async function main(): Promise<void> {
  const client = getNombaClient();
  const scopeToSub = !process.argv.includes('--no-subaccount');
  const orderReference = `nbo${Date.now()}livetest`;
  const order: Record<string, unknown> = {
    orderReference,
    amount: 100, // ≤ ₦100 whichever unit — resolves kobo-vs-naira on the real requery/debit
    currency: 'NGN',
    callbackUrl: 'https://tunnel.nombaone.xyz/callback',
    customerId: 'live-webhook-test',
    // UNIQUE per run — the account risk-blocks an email after failed attempts, which blocks
    // the whole order (both card + transfer). A fresh email avoids the blocklist.
    customerEmail: `nombaone.test.${Date.now()}@gmail.com`,
  };
  if (scopeToSub) order.accountId = env.NOMBA_SUBACCOUNT_ID; // scope funds to OUR sub-account
  const tokenize = !process.argv.includes('--no-tokenize'); // Nomba's tokenize flow has a bug; skip to test plain
  const res = await client.request({
    method: 'POST',
    endpoint: NOMBA_ENDPOINTS.checkoutOrder,
    idempotencyRef: orderReference,
    body: { tokenizeCard: tokenize, order },
  });
  console.log('SCOPED_TO_SUBACCOUNT=', scopeToSub, ' TOKENIZE=', tokenize);
  console.log('ORDER_REFERENCE=', orderReference);
  console.log('SUBACCOUNT_SCOPED=', Boolean(env.NOMBA_SUBACCOUNT_ID));
  console.log('OK=', res.ok, 'STATUS=', res.status);
  console.log('RESPONSE=', JSON.stringify(res.data, null, 2));
  process.exit(0);
}
main().catch((e) => {
  console.error('CHECKOUT_ERROR=', e instanceof Error ? e.message : String(e));
  process.exit(1);
});
