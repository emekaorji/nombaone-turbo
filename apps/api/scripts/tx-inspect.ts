 
// Dump the sub-account's recent transactions with all identifier fields so we can find
// the real transactionId of a pending OTP charge.  npx tsx scripts/tx-inspect.ts
import { env } from '../src/shared/config/env';
import { getNombaClient } from '../src/shared/config/nomba';

async function main(): Promise<void> {
  const sub = env.NOMBA_SUBACCOUNT_ID ?? '';
  const c = getNombaClient();
  const res = await c.request<{ data?: { results?: Record<string, unknown>[] } }>({
    method: 'GET',
    endpoint: `/v1/transactions/accounts/${sub}?limit=15`,
  });
  const results = (res.data as { data?: { results?: Record<string, unknown>[] } })?.data?.results ?? [];
  const ref = process.argv[2];
  console.log('COUNT=', results.length);
  if (ref) {
    // Full dump of the record matching this reference (to find tokenizedCardData/tokenKey).
    const match = results.find(
      (t) => t.onlineCheckoutOrderReference === ref || t.orderReference === ref || t.id === ref
    );
    console.log('MATCH_FULL=', JSON.stringify(match ?? null, null, 2));
    process.exit(0);
  }
  for (const t of results.slice(0, 15)) {
    console.log('---');
    console.log(JSON.stringify({
      id: t.id,
      transactionId: t.transactionId,
      type: t.type,
      status: t.status,
      amount: t.amount,
      orderReference: t.orderReference,
      onlineCheckoutOrderReference: t.onlineCheckoutOrderReference,
      merchantTxRef: t.merchantTxRef,
      time: t.time ?? t.date ?? t.createdAt,
    }));
  }
  process.exit(0);
}
main().catch((e) => {
  console.error('INSPECT_ERR=', e instanceof Error ? e.message : String(e));
  process.exit(1);
});
