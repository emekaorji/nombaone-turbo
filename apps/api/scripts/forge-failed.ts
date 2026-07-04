/* eslint-disable import/order */
// Test payment_failed handling with a GENUINELY-SIGNED webhook (signed with the real
// secret, so the app verifies it as authentic) pointed at a REAL failed transaction id —
// the E4 requery hits live Nomba, gets PAYMENT_FAILED, and the invoice must stay OPEN.
//   npx tsx scripts/forge-failed.ts <invoiceRef>
import { env } from '../src/shared/config/env';
import { computeNombaSignature } from '@nombaone/sara/nomba';

const invRef = process.argv[2];
const FAILED_TXN_ID = 'WEB-ONLINE_C-E575A-744dafd5-bce7-4843-ac2c-c4e693208c51'; // real PAYMENT_FAILED txn
const ts = new Date().toISOString();

async function main(): Promise<void> {
  const payload = {
    event_type: 'payment_failed',
    requestId: `forged-fail-${Date.now()}`,
    data: {
      merchant: { userId: env.NOMBA_LIVE_SUBACCOUNT_ID ?? '', walletId: 'wallet-x' },
      transaction: {
        transactionId: FAILED_TXN_ID,
        type: 'online_checkout',
        time: ts,
        responseCode: '',
        transactionAmount: 1000.0,
        gatewayMessage: 'Insufficient funds',
      },
      order: {
        orderReference: invRef,
        orderId: 'forged-order',
        accountId: env.NOMBA_LIVE_SUBACCOUNT_ID ?? '',
        amount: 1000.0,
        currency: 'NGN',
        paymentMethod: 'card',
      },
    },
  } as Record<string, unknown>;
  const raw = JSON.stringify(payload);
  const sig = computeNombaSignature(env.NOMBA_LIVE_WEBHOOK_SIGNATURE_KEY ?? '', raw, payload, ts);
  const res = await fetch('http://localhost:8000/webhooks/v1/nomba', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'nomba-signature': sig, 'nomba-timestamp': ts },
    body: raw,
  });
  console.log('POST_STATUS=', res.status, '(200 = signature verified + accepted)');
  console.log('BODY=', (await res.text()).slice(0, 200));
  process.exit(0);
}
main().catch((e) => {
  console.error('FORGE_ERR=', e instanceof Error ? e.message : String(e));
  process.exit(1);
});
