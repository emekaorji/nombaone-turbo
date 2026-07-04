/* eslint-disable import/order */
// Probe direct-debit (NIBSS mandate) provisioning on the active account/env.
//   npx tsx scripts/mandate-probe.ts
import { getNombaClient } from '../src/shared/config/nomba';
import { NOMBA_ENDPOINTS } from '@nombaone/sara/nomba';

async function call(label: string, method: 'GET' | 'POST', endpoint: string, body?: unknown): Promise<void> {
  try {
    const res = await getNombaClient('live').request({ method, endpoint, body: body as never });
    console.log(`### ${label} [${res.status}] ${method} ${endpoint}`);
    console.log(JSON.stringify(res.data));
  } catch (e) {
    console.log(`### ${label} ERR ${method} ${endpoint}: ${e instanceof Error ? e.message : String(e)}`);
  }
}

async function main(): Promise<void> {
  await call('list-mandates', 'GET', NOMBA_ENDPOINTS.mandateList);
  await call('create-empty', 'POST', NOMBA_ENDPOINTS.mandateCreate, {});
  await call('status-nobody', 'GET', `${NOMBA_ENDPOINTS.mandateStatus}?mandateId=probe`);
  process.exit(0);
}
main().catch((e) => {
  console.error('PROBE_ERR=', e instanceof Error ? e.message : String(e));
  process.exit(1);
});
