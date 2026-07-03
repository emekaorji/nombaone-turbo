/* eslint-disable import/order */
// Diagnose a failed/pending checkout: order-status lookup + transaction requery (LIVE,
// un-stubbed) → the real gatewayMessage / status.  npx tsx scripts/diag.ts <ref> [ref...]
import { getNombaClient } from '../src/shared/config/nomba';
import { NOMBA_ENDPOINTS } from '@nombaone/sara/nomba';

async function main(): Promise<void> {
  const client = getNombaClient();
  for (const ref of process.argv.slice(2)) {
    console.log(`\n===== ORDER STATUS  GET /v1/checkout/order/${ref} =====`);
    const o = await client.request({ method: 'GET', endpoint: `/v1/checkout/order/${ref}` });
    console.log('OK=', o.ok, 'HTTP=', o.status, '\nDATA=', JSON.stringify(o.data, null, 2));

    console.log(`\n===== REQUERY  transactionRef=${ref} =====`);
    const r = await client.request({
      method: 'GET',
      endpoint: NOMBA_ENDPOINTS.transactionRequery,
      query: { transactionRef: ref },
    });
    console.log('OK=', r.ok, 'HTTP=', r.status, '\nDATA=', JSON.stringify(r.data, null, 2));
  }
  process.exit(0);
}
main().catch((e) => {
  console.error('DIAG_ERR=', e instanceof Error ? e.message : String(e));
  process.exit(1);
});
