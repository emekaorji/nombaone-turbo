/* eslint-disable import/order */
// Tokenized-card recharge of a saved token (merchant-initiated). Env vars select live/sandbox.
//   npx tsx scripts/nomba-recharge.ts <tokenKey> <customerEmail> [amountKobo]
import { randomUUID } from 'node:crypto';

import { env } from '../src/shared/config/env';
import { getNombaClient } from '../src/shared/config/nomba';
import { koboToNombaAmount, NOMBA_ENDPOINTS } from '@nombaone/sara/nomba';
import { mintReference } from '@nombaone/sara/reference';

async function main(): Promise<void> {
  const tokenKey = process.argv[2];
  const email = process.argv[3];
  const amountKobo = Number(process.argv[4]) || 10000;
  const invRef = mintReference('INV');

  const res = await getNombaClient('live').request({
    method: 'POST',
    endpoint: NOMBA_ENDPOINTS.tokenizedCardCharge,
    idempotencyRef: invRef,
    body: {
      tokenKey,
      order: {
        amount: koboToNombaAmount(amountKobo),
        currency: 'NGN',
        customerId: randomUUID(),
        customerEmail: email,
        callbackUrl: 'https://tunnel.nombaone.xyz/callback',
        orderReference: invRef,
        accountId: env.NOMBA_LIVE_SUBACCOUNT_ID,
      },
    },
  });
  console.log('BASE=', env.NOMBA_LIVE_BASE_URL);
  console.log('INVOICE_REF=', invRef);
  console.log('RECHARGE=', JSON.stringify(res.data, null, 2));
  process.exit(0);
}
main().catch((e) => {
  console.error('RECHARGE_ERR=', e instanceof Error ? e.message : String(e));
  process.exit(1);
});
