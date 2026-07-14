/* eslint-disable import/order */
import { env } from '../src/shared/config/env';
import { scriptSubAccountId } from './_subaccount';
import { getNombaClient } from '../src/shared/config/nomba';
import { NOMBA_ENDPOINTS } from '@nombaone/sara/nomba';
async function main() {
  const c = getNombaClient('live');
  const sub = scriptSubAccountId ?? '';
  const latest = await c.request({ method:'GET', endpoint: NOMBA_ENDPOINTS.transactionRequery, query:{ accountId: sub } });
  console.log('LATEST(sub)=', JSON.stringify((latest.data as any)?.data ?? latest.data).slice(0,500));
  const ord = await c.request({ method:'GET', endpoint: `/v1/checkout/order/672afdc4-4da9-43fe-b70d-25f9e03c1c96` });
  console.log('ORDER(just-paid)=', JSON.stringify(ord.data));
  process.exit(0);
}
main().catch(e=>{console.error('ERR',e.message);process.exit(1);});
