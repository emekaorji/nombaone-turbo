 
// Probe for (a) a transaction-LIST endpoint to find the completed ₦100 payment
// (→ money unit + join field without a webhook), and (b) a webhook-config endpoint
// to read the registered URL.  npx tsx scripts/probe.ts
import { env } from '../src/shared/config/env';
import { getNombaClient } from '../src/shared/config/nomba';

async function main(): Promise<void> {
  const client = getNombaClient();
  const sub = env.NOMBA_SUBACCOUNT_ID ?? '';
  const parent = env.NOMBA_PARENT_ACCOUNT_ID ?? '';
  const candidates: [string, Record<string, string>?][] = [
    ['/v1/transactions'],
    ['/v1/transactions/accounts'],
    [`/v1/transactions/accounts/${sub}`],
    [`/v1/transactions/accounts/${parent}`],
    ['/v1/transactions/accounts/single', { accountId: sub }],
    ['/v1/checkout/transactions'],
    ['/v1/webhooks'],
    ['/v1/webhook'],
    ['/v1/account/webhook'],
    ['/v1/accounts/webhook'],
    ['/v1/settings/webhook'],
    ['/v1/accounts/webhooks'],
  ];
  for (const [ep, query] of candidates) {
    try {
      const res = await client.request({ method: 'GET', endpoint: ep, query });
      console.log(`HTTP ${res.status}  GET ${ep}${query ? '?' + new URLSearchParams(query) : ''}`);
      console.log('   ' + JSON.stringify(res.data).slice(0, 400));
    } catch (e) {
      console.log(`ERR       GET ${ep} :: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  process.exit(0);
}
main().catch((e) => {
  console.error('PROBE_ERR=', e instanceof Error ? e.message : String(e));
  process.exit(1);
});
