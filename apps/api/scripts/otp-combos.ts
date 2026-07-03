 
// Try every (orderReference, transactionId) combination for the tokenized-card OTP submit.
//   npx tsx scripts/otp-combos.ts <ourRef> <orderId> <otp>
import { getNombaClient } from '../src/shared/config/nomba';

async function main(): Promise<void> {
  const ourRef = process.argv[2] ?? '';
  const orderId = process.argv[3] ?? '';
  const otp = process.argv[4] ?? '';
  const c = getNombaClient();

  const combos: Array<{ orderReference: string; transactionId: string }> = [
    { orderReference: ourRef, transactionId: ourRef },
    { orderReference: orderId, transactionId: orderId },
    { orderReference: orderId, transactionId: ourRef },
  ];

  for (const combo of combos) {
    const res = await c.request({
      method: 'POST',
      endpoint: '/v1/checkout/checkout-card-otp',
      body: { otp, ...combo },
    });
    const body = JSON.stringify(res.data);
    console.log(`COMBO orderRef=${combo.orderReference.slice(0, 12)} txnId=${combo.transactionId.slice(0, 12)} -> ${res.status} ${body}`);
    const ok = (res.data as { code?: string })?.code === '00';
    if (ok) {
      console.log('OTP_ACCEPTED');
      break;
    }
  }
  process.exit(0);
}
main().catch((e) => {
  console.error('COMBO_ERR=', e instanceof Error ? e.message : String(e));
  process.exit(1);
});
