 
// Dump the FULL recent transactions for our sub-account (found via probe) — resolves
// the money unit + shows the transaction shape / reference fields.
//   npx tsx scripts/tx-list.ts
import { env } from '../src/shared/config/env';
import { getNombaClient } from '../src/shared/config/nomba';

async function main(): Promise<void> {
  const client = getNombaClient('live');
  const sub = env.NOMBA_LIVE_SUBACCOUNT_ID ?? '';
  const res = await client.request<{ data?: { results?: Record<string, unknown>[] } }>({
    method: 'GET',
    endpoint: `/v1/transactions/accounts/${sub}`,
  });
  const results = (res.data as { data?: { results?: Record<string, unknown>[] } })?.data?.results ?? [];
  console.log('SUBACCOUNT=', sub);
  console.log('TXN_COUNT=', results.length);
  for (const t of results.slice(0, 5)) {
    console.log('\n' + JSON.stringify(t, null, 2));
  }
  process.exit(0);
}
main().catch((e) => {
  console.error('TXLIST_ERR=', e instanceof Error ? e.message : String(e));
  process.exit(1);
});
