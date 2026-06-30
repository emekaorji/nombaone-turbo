#!/usr/bin/env node
/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Production direct-debit (mandate) confirmation runbook.
 *
 * Direct-debit is 404 in Nomba SANDBOX for everyone (confirmed by us + the Slack
 * thread) — it is not enabled there. This script confirms it against PRODUCTION
 * with your LIVE keys, staged so each real-money step is explicit.
 *
 * Creds are read from process.env (NOT apps/api/.env) so live secrets never touch
 * a file. Run each command separately:
 *
 *   export NOMBA_BASE_URL=https://api.nomba.com
 *   export NOMBA_PARENT_ACCOUNT_ID=<live main account id>
 *   export NOMBA_CLIENT_ID=<live client id>
 *   export NOMBA_CLIENT_SECRET=<live private key>
 *
 *   node workbench/t0-direct-debit-prod.mjs probe
 *       → mints a live token, then finds which /v1/direct-debits/* paths exist
 *         (non-404) — settles the Slack-vs-docs path ambiguity empirically.
 *
 *   # Provide an account YOU control + a SMALL amount. CBN bank codes:
 *   #   058 GTBank · 044 Access · 033 UBA · 057 Zenith · 011 First Bank · 232 Sterling
 *   export DD_ACCOUNT_NUMBER=0123456789
 *   export DD_BANK_CODE=058
 *   export DD_ACCOUNT_NAME="Your Name"
 *   export DD_EMAIL=you@example.com
 *   node workbench/t0-direct-debit-prod.mjs create
 *       → creates a mandate (amount cap ₦100 = 10000 kobo, MONTHLY, 1-yr window),
 *         prints the mandateId + the bank-consent instruction. Approve the consent
 *         in your bank app/USSD.
 *
 *   node workbench/t0-direct-debit-prod.mjs status <mandateId>
 *       → poll until ACTIVE / ADVICE_SENT (consent confirmed).
 *
 *   node workbench/t0-direct-debit-prod.mjs debit <mandateId> 5000
 *       → debits ₦50 (5000 kobo) of REAL money from the active mandate. Confirms
 *         the end-to-end charge. (Keep it tiny.)
 * ─────────────────────────────────────────────────────────────────────────────
 */

const need = (k) => {
  const v = process.env[k];
  if (!v) {
    console.error(`Missing env ${k}`);
    process.exit(1);
  }
  return v;
};
const BASE = need('NOMBA_BASE_URL');
const ACCOUNT_ID = need('NOMBA_PARENT_ACCOUNT_ID');

async function token() {
  const r = await fetch(`${BASE}/v1/auth/token/issue`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', accountId: ACCOUNT_ID },
    body: JSON.stringify({
      grant_type: 'client_credentials',
      client_id: need('NOMBA_CLIENT_ID'),
      client_secret: need('NOMBA_CLIENT_SECRET'),
    }),
  });
  const j = await r.json();
  if (!r.ok || !j?.data?.access_token) {
    console.error('token failed', r.status, JSON.stringify(j).slice(0, 300));
    process.exit(1);
  }
  return j.data.access_token;
}
const H = (tok) => ({
  'Content-Type': 'application/json',
  Authorization: `Bearer ${tok}`,
  accountId: ACCOUNT_ID,
});
async function call(tok, method, path, { body, query } = {}) {
  const url = new URL(`${BASE}${path}`);
  if (query) for (const [k, v] of Object.entries(query)) url.searchParams.set(k, v);
  const r = await fetch(url, {
    method,
    headers: H(tok),
    body: body ? JSON.stringify(body) : undefined,
  });
  let j;
  const t = await r.text();
  try {
    j = JSON.parse(t);
  } catch {
    j = t;
  }
  return { status: r.status, ok: r.ok, body: j };
}

const cmd = process.argv[2];
const tok = await token();
console.log(`✓ live token minted against ${BASE}`);

if (cmd === 'probe') {
  // Try both the Slack-reported and the doc-slug path families.
  const candidates = [
    ['POST', '/v1/direct-debits'],
    ['GET', '/v1/direct-debits/mandates'],
    ['GET', '/v1/direct-debits/list-direct-debit-mandates'],
    ['GET', '/v1/direct-debits/status', { query: { mandateId: 'x' } }],
    ['GET', '/v1/direct-debits/check-direct-debit-status', { query: { mandateId: 'x' } }],
    ['GET', '/v1/direct-debits/x'],
    ['PUT', '/v1/direct-debits/update-status'],
    ['PUT', '/v1/direct-debits/update-direct-debit-status'],
    ['POST', '/v1/direct-debits/debit-mandate'],
  ];
  for (const [m, p, opt] of candidates) {
    const res = await call(tok, m, p, { body: m === 'POST' || m === 'PUT' ? {} : undefined, ...opt });
    const exists = res.status !== 404;
    console.log(
      `${exists ? '✓ EXISTS' : '✗ 404   '} ${res.status} ${m} ${p}` +
        (exists ? `  → ${JSON.stringify(res.body?.description ?? res.body?.message ?? res.body).slice(0, 70)}` : '')
    );
  }
  console.log('\nUse the EXISTS paths below for create/status/debit.');
} else if (cmd === 'create') {
  const now = new Date();
  const end = new Date(now.getTime() + 365 * 24 * 3600 * 1000);
  const body = {
    customerAccountNumber: need('DD_ACCOUNT_NUMBER'),
    bankCode: need('DD_BANK_CODE'),
    customerName: need('DD_ACCOUNT_NAME'),
    customerAccountName: need('DD_ACCOUNT_NAME'),
    amount: 10000, // ₦100 cap, kobo
    frequency: 'MONTHLY',
    merchantReference: `nbo-ddtest-${Date.now()}`,
    startDate: now.toISOString().slice(0, 10),
    endDate: end.toISOString().slice(0, 10),
    customerEmail: need('DD_EMAIL'),
    startImmediately: false,
  };
  const res = await call(tok, 'POST', '/v1/direct-debits', { body });
  console.log(res.status, JSON.stringify(res.body, null, 2).slice(0, 1200));
  console.log('\n→ note the mandateId; approve the bank consent; then run: status <mandateId>');
} else if (cmd === 'status') {
  const id = process.argv[3];
  // try both status path families
  for (const p of [
    ['GET', `/v1/direct-debits/${id}`],
    ['GET', '/v1/direct-debits/status', { query: { mandateId: id } }],
    ['GET', '/v1/direct-debits/check-direct-debit-status', { query: { mandateId: id } }],
  ]) {
    const res = await call(tok, p[0], p[1], p[2]);
    if (res.status !== 404) {
      console.log(p[1], res.status, JSON.stringify(res.body).slice(0, 400));
      break;
    }
  }
} else if (cmd === 'debit') {
  const id = process.argv[3];
  const kobo = Number(process.argv[4] ?? 5000);
  const body = {
    mandateId: id,
    amount: kobo,
    merchantReference: `nbo-ddcharge-${Date.now()}`,
    narration: 'nombaone direct-debit confirm',
  };
  const res = await call(tok, 'POST', '/v1/direct-debits/debit-mandate', { body });
  console.log('DEBIT', res.status, JSON.stringify(res.body, null, 2).slice(0, 800));
} else {
  console.log('commands: probe | create | status <mandateId> | debit <mandateId> <kobo>');
}
