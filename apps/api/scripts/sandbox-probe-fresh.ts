/**
 * P0 follow-up: api.nomba.com called the fresh creds a SANDBOX token. Verify
 * them against sandbox.nomba.com and re-test the load-bearing sandbox facts on
 * THIS account (the old findings — no webhooks, DD 404 — were from the
 * hackathon account):
 *   S1 token + balance   S2 sub-account surfaces   S3 checkout order shape
 *   S4 direct-debits reachable?   S5 virtual account create
 *
 *   npx tsx --env-file=.env scripts/sandbox-probe-fresh.ts
 */
const BASE = 'https://sandbox.nomba.com';
const CLIENT_ID = '2346ce9c-39f7-4a7c-bbe3-9f7806de7ed1';
const CLIENT_SECRET =
  'vOt3Uvac0kyQj1eDfGAeUf8f45/CvEVUjQpeFfFvgaD6x/o3pIK9C5I4/upF8/uL460req2tTUeGrzfWTmnjuQ==';
const ACCOUNT_ID = '0f7ef961-10f8-45ad-af67-1ad1c236871e';

async function main(): Promise<void> {
  const tok = await fetch(`${BASE}/v1/auth/token/issue`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', accountId: ACCOUNT_ID },
    body: JSON.stringify({
      grant_type: 'client_credentials',
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
    }),
  });
  const tokBody = (await tok.json()) as { data?: { access_token?: string } };
  console.log(`S1 token: HTTP ${tok.status} — access_token ${tokBody.data?.access_token ? 'YES' : 'NO'}`);
  const access = tokBody.data?.access_token;
  if (!access) {
    console.log(JSON.stringify(tokBody).slice(0, 400));
    process.exit(1);
  }

  const call = async (
    method: string,
    path: string,
    body?: unknown
  ): Promise<{ status: number; data: unknown }> => {
    const res = await fetch(`${BASE}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${access}`,
        accountId: ACCOUNT_ID,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    let data: unknown;
    try {
      data = await res.json();
    } catch {
      data = await res.text();
    }
    return { status: res.status, data };
  };

  const log = (label: string, r: { status: number; data: unknown }): void =>
    console.log(`\n${label}\n  HTTP ${r.status}  ${JSON.stringify(r.data).slice(0, 500)}`);

  log('S1b GET /v1/accounts/balance', await call('GET', '/v1/accounts/balance'));

  console.log('\n──── S2 sub-account surfaces');
  log('GET /v1/accounts/sub-accounts', await call('GET', '/v1/accounts/sub-accounts'));
  log('GET /v1/accounts', await call('GET', '/v1/accounts'));
  const subRef = `NBO-PROBE-${Date.now()}`;
  log(
    `POST /v1/accounts/sub-accounts {accountRef:${subRef}}`,
    await call('POST', '/v1/accounts/sub-accounts', {
      accountName: 'nombaone probe merchant',
      accountRef: subRef,
    })
  );

  console.log('\n──── S3 checkout order (₦100, tokenizeCard:true)');
  const orderReference = `NBO-PROBE-CO-${Date.now()}`;
  log(
    `POST /v1/checkout/order {ref:${orderReference}}`,
    await call('POST', '/v1/checkout/order', {
      tokenizeCard: true,
      order: {
        orderReference,
        amount: '100.00',
        currency: 'NGN',
        callbackUrl: 'https://tunnel.nombaone.xyz/callback',
        customerId: 'probe-customer',
        customerEmail: 'probe@nombaone.xyz',
      },
    })
  );

  console.log('\n──── S4 direct-debits');
  log('GET /v1/direct-debits', await call('GET', '/v1/direct-debits'));

  console.log('\n──── S5 virtual account');
  const vaRef = `NBO-PROBE-VA-${Date.now()}`;
  log(
    `POST /v1/accounts/virtual {accountRef:${vaRef}}`,
    await call('POST', '/v1/accounts/virtual', {
      accountRef: vaRef,
      accountName: 'nombaone probe va',
    })
  );

  process.exit(0);
}

main().catch((e) => {
  console.error('PROBE_ERR=', e instanceof Error ? e.message : String(e));
  process.exit(1);
});

export {};
