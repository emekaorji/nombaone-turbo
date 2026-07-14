/**
 * P0 probes for the FRESH live account (plan: continue-pls-but-use-quiet-curry).
 *
 *   P1 — do the fresh creds authenticate against api.nomba.com at all?
 *   P2 — ARCHITECTURE-DECIDING: does any sub-account create/list surface exist?
 *        Works → per-merchant sub-accounts are mintable. 404s → fall back to
 *        virtual-account-as-subaccount / splitRequest / manual paste.
 *   P3 — checkout order: which link field comes back (checkoutLink vs
 *        checkoutUrl), and is `allowedPaymentMethods` accepted?
 *
 * Money safety: P3 creates a hosted-checkout ORDER (₦100). Nothing is charged
 * until a human pays the link; the order simply expires otherwise.
 *
 *   npx tsx scripts/subaccount-probe.ts
 */
import { env } from '../src/shared/config/env';
import { getNombaClient } from '../src/shared/config/nomba';

const HR = '─'.repeat(70);

function show(label: string, status: number, data: unknown): void {
  console.log(`\n${label}\n  HTTP ${status}  ${JSON.stringify(data).slice(0, 600)}`);
}

async function main(): Promise<void> {
  const client = getNombaClient('live');
  const parent = env.NOMBA_LIVE_PARENT_ACCOUNT_ID ?? '';

  // ── P1: auth. The first request forces a token issue; a wrong host/creds
  // pair (or an IP-whitelist wall) dies right here, before anything else.
  console.log(HR + '\nP1 — token + a harmless authenticated GET');
  try {
    const res = await client.request({ method: 'GET', endpoint: '/v1/accounts/balance' });
    show('GET /v1/accounts/balance (parent balance)', res.status, res.data);
    console.log('\nP1 VERDICT: AUTH OK — fresh creds are live-account creds.');
  } catch (e) {
    console.error(`\nP1 VERDICT: AUTH FAILED — ${e instanceof Error ? e.message : String(e)}`);
    console.error('If this is NOMBA_UNAUTHORIZED, the creds may be sandbox-only or IP-whitelisted.');
    process.exit(1);
  }

  // ── P2: every sub-account surface named across the integration reference
  // and the public docs. GETs first (harmless), then ONE create attempt.
  console.log('\n' + HR + '\nP2 — sub-account surfaces');
  const gets: [string, Record<string, string>?][] = [
    ['/v1/accounts/sub-accounts'],
    ['/v1/accounts'],
    ['/v1/accounts/list'],
    [`/v1/accounts/${parent}`],
    ['/v1/sub-accounts'],
    ['/v1/accounts/virtual'],
  ];
  for (const [ep, query] of gets) {
    try {
      const res = await client.request({ method: 'GET', endpoint: ep, query });
      show(`GET ${ep}`, res.status, res.data);
    } catch (e) {
      console.log(`\nGET ${ep}\n  ERR ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  const accountRef = `NBO-PROBE-${Date.now()}`;
  try {
    const res = await client.request({
      method: 'POST',
      endpoint: '/v1/accounts/sub-accounts',
      idempotencyRef: accountRef,
      body: { accountName: 'nombaone probe merchant', accountRef },
    });
    show(`POST /v1/accounts/sub-accounts {accountRef:${accountRef}}`, res.status, res.data);
    console.log(res.ok
      ? '\nP2 VERDICT: SUB-ACCOUNT CREATE WORKS — mint per merchant.'
      : '\nP2 VERDICT: create endpoint responded non-OK — inspect above; likely FALLBACK territory.');
  } catch (e) {
    console.log(`\nPOST /v1/accounts/sub-accounts ERR ${e instanceof Error ? e.message : String(e)}`);
    console.log('\nP2 VERDICT: NO sub-account create — use fallback (virtual-account / splitRequest / manual paste).');
  }

  // ── P3: checkout order shape. ₦100, tokenizing, no accountId yet (P2 may
  // not have yielded one) — this probe is about FIELD NAMES, not settlement.
  console.log('\n' + HR + '\nP3 — checkout order shape (₦100, tokenizeCard:true)');
  const orderReference = `NBO-PROBE-CO-${Date.now()}`;
  try {
    const res = await client.request<{ data?: Record<string, unknown> }>({
      method: 'POST',
      endpoint: '/v1/checkout/order',
      idempotencyRef: orderReference,
      body: {
        tokenizeCard: true,
        order: {
          orderReference,
          amount: '100.00',
          currency: 'NGN',
          callbackUrl: 'https://tunnel.nombaone.xyz/callback',
          customerId: 'probe-customer',
          customerEmail: 'probe@nombaone.xyz',
          allowedPaymentMethods: ['CARD', 'BANK_TRANSFER'],
        },
      },
    });
    show(`POST /v1/checkout/order {ref:${orderReference}}`, res.status, res.data);
    const inner = (res.data?.data ?? {}) as Record<string, unknown>;
    console.log(`\nP3 VERDICT: link field = ${
      inner.checkoutLink ? 'checkoutLink' : inner.checkoutUrl ? 'checkoutUrl' : 'NEITHER (inspect above)'
    }`);
  } catch (e) {
    console.log(`\nP3 ERR ${e instanceof Error ? e.message : String(e)}`);
  }

  process.exit(0);
}

main().catch((e) => {
  console.error('PROBE_ERR=', e instanceof Error ? e.message : String(e));
  process.exit(1);
});
