/* eslint-disable import/order */
// Create a Nomba hosted checkout (optionally tokenizing). Env vars select live/sandbox.
//   npx tsx scripts/nomba-checkout.ts [amountKobo] [--tokenize]
import { randomUUID } from 'node:crypto';

import { env } from '../src/shared/config/env';
import { getNombaClient } from '../src/shared/config/nomba';
import { koboToNombaAmount, NOMBA_ENDPOINTS } from '@nombaone/sara/nomba';
import { mintReference } from '@nombaone/sara/reference';

async function main(): Promise<void> {
  const amountKobo = Number(process.argv[2]) || 10000;
  const tokenize = process.argv.includes('--tokenize');
  const invRef = mintReference('INV');
  const email = `qa.${invRef}@gmail.com`;

  const res = await getNombaClient().request({
    method: 'POST',
    endpoint: NOMBA_ENDPOINTS.checkoutOrder,
    idempotencyRef: invRef,
    body: {
      tokenizeCard: tokenize,
      order: {
        orderReference: invRef,
        accountId: env.NOMBA_SUBACCOUNT_ID,
        amount: koboToNombaAmount(amountKobo),
        currency: 'NGN',
        callbackUrl: 'https://tunnel.nombaone.xyz/callback',
        customerId: randomUUID(),
        customerEmail: email,
      },
    },
  });
  const data = (res.data as { data?: Record<string, unknown> })?.data ?? {};
  console.log('BASE=', env.NOMBA_BASE_URL);
  console.log('INVOICE_REF=', invRef);
  console.log('EMAIL=', email);
  console.log('TOKENIZE=', tokenize);
  console.log('CHECKOUT_LINK=', data.checkoutLink);
  console.log('ORDER_ID=', data.orderReference ?? data.orderId);
  process.exit(0);
}
main().catch((e) => {
  console.error('CHECKOUT_ERR=', e instanceof Error ? e.message : String(e));
  process.exit(1);
});
