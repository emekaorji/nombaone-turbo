 
// Try every read path to retrieve a completed order's tokenizedCardData/token.
//   npx tsx scripts/sbx-verify.ts <orderReference> <orderId>
import { getNombaClient } from '../src/shared/config/nomba';

async function tryGet(label: string, endpoint: string): Promise<void> {
  try {
    const res = await getNombaClient().request({ method: 'GET', endpoint });
    console.log(`\n### ${label} [${res.status}] ${endpoint}`);
    console.log(JSON.stringify(res.data));
  } catch (e) {
    console.log(`\n### ${label} ERR ${endpoint}: ${e instanceof Error ? e.message : String(e)}`);
  }
}

async function main(): Promise<void> {
  const ref = process.argv[2];
  const orderId = process.argv[3];
  await tryGet('requery-by-ref', `/v1/transactions/accounts/single?transactionRef=${ref}`);
  await tryGet('requery-by-orderId', `/v1/transactions/accounts/single?transactionRef=${orderId}`);
  await tryGet('order-by-id', `/v1/checkout/order/${orderId}`);
  await tryGet('order-status', `/v1/checkout/transaction?orderReference=${ref}`);
  process.exit(0);
}
main().catch((e) => {
  console.error('VERIFY_ERR=', e instanceof Error ? e.message : String(e));
  process.exit(1);
});
