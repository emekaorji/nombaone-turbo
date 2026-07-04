 
// Complete a tokenized-card charge that required an OTP.
//   npx tsx scripts/submit-otp.ts <orderReference> <transactionId> <otp>
import { getNombaClient } from '../src/shared/config/nomba';

async function main(): Promise<void> {
  const orderReference = process.argv[2];
  const transactionId = process.argv[3];
  const otp = process.argv[4];
  const c = getNombaClient('live');

  const res = await c.request({
    method: 'POST',
    endpoint: '/v1/checkout/checkout-card-otp',
    body: { otp, orderReference, transactionId },
  });
  console.log('OTP_SUBMIT_HTTP=', res.status);
  console.log('OTP_SUBMIT_BODY=', JSON.stringify(res.data));
  process.exit(0);
}
main().catch((e) => {
  console.error('OTP_ERR=', e instanceof Error ? e.message : String(e));
  process.exit(1);
});
