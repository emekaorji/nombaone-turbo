/* eslint-disable turbo/no-undeclared-env-vars */
/**
 * Sub-account provisioning probe — "will Nomba mint a sub-account per merchant?"
 *
 * Walks the entire accounts surface and prints the raw response for each call, so
 * the answer is evidence rather than inference (a 500 on one guessed payload
 * proves nothing; a 500 on an EMPTY body and on a bogus sibling path proves the
 * handler never reaches validation).
 *
 * Findings on the live "Nomba Hackathon 2026" account, 2026-07-13:
 *   GET  /v1/accounts/sub-accounts  → 403 Forbidden  (surface exists; not entitled)
 *   POST /v1/accounts/sub-accounts  → 500 for {accountName,accountRef}, {name,reference},
 *                                     {…,email,phone}, and {} alike
 *   POST /v1/accounts/sub-account   → 500  (a path that does not exist ⇒ the 500 is a catch-all)
 *   POST /v1/sub-accounts           → 404
 *   POST /v1/accounts/virtual       → 200, real NUBAN — but the VA never gets an
 *                                     `accountId`, so it cannot be a settlement scope
 *   GET  /v1/accounts               → 200 {results: []} even right after that create
 *
 * ⇒ Per-merchant sub-accounts must be created on the Nomba DASHBOARD and pasted
 *   into the console. Re-run this if Nomba grants the entitlement.
 *
 *   npx tsx --env-file=.env scripts/subaccount-live-probe.ts
 */
const BASE = process.env.NOMBA_LIVE_BASE_URL ?? 'https://api.nomba.com';
const PARENT = process.env.NOMBA_LIVE_PARENT_ACCOUNT_ID ?? '';
const CLIENT_ID = process.env.NOMBA_LIVE_CLIENT_ID ?? '';
const CLIENT_SECRET = process.env.NOMBA_LIVE_CLIENT_SECRET ?? '';

let token = '';

async function call(
  method: string,
  path: string,
  body?: unknown
): Promise<{ status: number; body: string }> {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      accountId: PARENT,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: res.status, body: (await res.text()).slice(0, 400) };
}

const show = (label: string, r: { status: number; body: string }): void =>
  console.log(`\n${label}\n  → HTTP ${r.status}  ${r.body}`);

async function main(): Promise<void> {
  if (!PARENT || !CLIENT_ID || !CLIENT_SECRET) {
    console.error('missing NOMBA_LIVE_* env — run with `npx tsx --env-file=.env`');
    process.exit(1);
  }

  const tokRes = await fetch(`${BASE}/v1/auth/token/issue`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', accountId: PARENT },
    body: JSON.stringify({
      grant_type: 'client_credentials',
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
    }),
  });
  const tok = (await tokRes.json()) as { data?: { access_token?: string } };
  token = tok.data?.access_token ?? '';
  console.log(`AUTH: HTTP ${tokRes.status} — token ${token ? 'OK' : 'MISSING'}`);
  if (!token) process.exit(1);

  console.log('\n──────── READ: does the sub-account surface exist, and are we entitled?');
  show('GET /v1/accounts/sub-accounts', await call('GET', '/v1/accounts/sub-accounts'));
  show('GET /v1/accounts', await call('GET', '/v1/accounts'));
  show('GET /v1/accounts/balance', await call('GET', '/v1/accounts/balance'));

  console.log('\n──────── WRITE: create, across every plausible body shape');
  const ref = `NBO-PROBE-${Date.now()}`;
  const create = (body: unknown): Promise<{ status: number; body: string }> =>
    call('POST', '/v1/accounts/sub-accounts', body);

  show('A) {accountName, accountRef}', await create({ accountName: 'Probe Merchant', accountRef: ref }));
  show('B) {name, reference}', await create({ name: 'Probe Merchant', reference: `${ref}-B` }));
  show('C) + email/phone', await create({ accountName: 'Probe Merchant', accountRef: `${ref}-C`, email: 'probe@nombaone.xyz', phoneNumber: '08000000000' }));
  show('D) {} — an empty body should say WHICH field is missing, not 500', await create({}));
  show('E) POST /v1/accounts/sub-account (a path that does not exist — is the 500 a catch-all?)', await call('POST', '/v1/accounts/sub-account', { accountName: 'Probe', accountRef: `${ref}-E` }));
  show('F) POST /v1/sub-accounts', await call('POST', '/v1/sub-accounts', { accountName: 'Probe', accountRef: `${ref}-F` }));

  process.exit(0);
}

main().catch((e) => {
  console.error('PROBE_ERR=', e instanceof Error ? e.message : String(e));
  process.exit(1);
});

export {};
