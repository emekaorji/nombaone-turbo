import { describe, expect, it } from 'vitest';

import { createNombaClient, toNombaAccountName } from '@nombaone/sara/nomba';

import type { Redis } from 'ioredis';

/**
 * Two defects, both live-probed against the Nomba LIVE account on 2026-07-13,
 * both in the same failure: Nomba rejects a virtual-account `accountName` that
 * contains anything but letters and spaces, AND it signals that rejection as an
 * **HTTP 200** carrying `{"code":"400","status":false}`.
 *
 * Together they were silent-money: `if (!res.ok)` passed, the rail read an absent
 * `data`, and the payer was handed a NUBAN of `undefined`. A customer named
 * "Chidinma Okafor-Eze" could never be given an account to pay into — her invoice
 * simply went unpaid, then dunned, then churned.
 */
describe('nomba/accountName — Nomba accepts letters + spaces ONLY (live-probed)', () => {
  it('passes through a name Nomba already accepts', () => {
    // Live: "Iron Republic Gym" → 200, NUBAN issued.
    expect(toNombaAccountName('Iron Republic Gym')).toBe('Iron Republic Gym');
  });

  it('strips every character class Nomba rejected live', () => {
    // Each of these was a live `400 Account name must not contain special characters.`
    expect(toNombaAccountName('Iron Republic Gym 1')).toBe('Iron Republic Gym');
    expect(toNombaAccountName('IronRepublic2')).toBe('IronRepublic');
    expect(toNombaAccountName("Mary-Jane O'Brien")).toBe('Mary Jane O Brien');
    expect(toNombaAccountName('Chidinma Okafor-Eze')).toBe('Chidinma Okafor Eze');
    expect(toNombaAccountName('Ade Ogunlana Ltd.')).toBe('Ade Ogunlana Ltd');
    expect(toNombaAccountName('Iron Republic & Co')).toBe('Iron Republic Co');
  });

  it('folds accents onto their ASCII base rather than deleting the letter', () => {
    expect(toNombaAccountName('ADÉ ÒGÚNLÀNÀ')).toBe('ADE OGUNLANA');
    expect(toNombaAccountName('Zoë Adébáyò')).toBe('Zoe Adebayo');
  });

  it('always returns something Nomba will accept — 8..64 chars, letters and spaces', () => {
    const cases = [
      'Iron Republic Gym 1',
      "Mary-Jane O'Brien",
      'Ade',
      '',
      '12345',
      '陈大文', // no Latin letters at all
      'A'.repeat(200),
      `${'Wolverhampton '.repeat(10)}Fitness`,
    ];
    for (const c of cases) {
      const out = toNombaAccountName(c);
      expect(out, `input=${JSON.stringify(c)}`).toMatch(/^[A-Za-z ]+$/);
      expect(out.length, `input=${JSON.stringify(c)}`).toBeGreaterThanOrEqual(8);
      expect(out.length, `input=${JSON.stringify(c)}`).toBeLessThanOrEqual(64);
    }
  });

  it('falls back when a name has no Latin letters to keep', () => {
    expect(toNombaAccountName('陈大文')).toBe('Nombaone Customer');
    expect(toNombaAccountName('12345')).toBe('Nombaone Customer');
    expect(toNombaAccountName(null)).toBe('Nombaone Customer');
    expect(toNombaAccountName(undefined)).toBe('Nombaone Customer');
  });
});

describe('nomba/client — an HTTP 200 carrying a failure envelope is NOT ok', () => {
  const fakeRedis = {
    get: async () => null,
    set: async () => 'OK',
    del: async () => 1,
  } as unknown as Redis;

  const clientWith = (bodyForRequest: unknown, httpStatus = 200) => {
    const fetchImpl = (async (url: string | URL) => {
      const href = String(url);
      if (href.includes('/auth/token/issue')) {
        return new Response(JSON.stringify({ data: { access_token: 't', expiresAt: new Date(Date.now() + 3.6e6).toISOString() } }), { status: 200 });
      }
      return new Response(JSON.stringify(bodyForRequest), { status: httpStatus });
    }) as unknown as typeof fetch;

    return createNombaClient({
      redis: fakeRedis,
      fetchImpl,
      config: {
        baseUrl: 'https://api.nomba.com',
        parentAccountId: 'parent',
        clientId: 'cid',
        clientSecret: 'sec',
        mode: 'live',
        tokenRefreshMarginSec: 300,
      },
    });
  };

  it('demotes the exact envelope Nomba returned live for a bad accountName', async () => {
    // Verbatim from the live probe: HTTP 200, body says 400.
    const client = clientWith({
      code: '400',
      description: 'Validation Error',
      message: 'Account name must not contain special characters.',
      status: false,
    });

    const res = await client.request({ method: 'POST', endpoint: '/v1/accounts/virtual', body: {} });

    expect(res.status).toBe(200); // HTTP said fine…
    expect(res.ok).toBe(false); // …but we must not believe it
    expect(res.providerMessage).toBe('Account name must not contain special characters.');
  });

  it('still treats a genuine success envelope as ok', async () => {
    const client = clientWith({
      code: '00',
      description: 'SUCCESS',
      status: true,
      data: { bankAccountNumber: '5691931107' },
    });

    const res = await client.request<{ data: { bankAccountNumber: string } }>({
      method: 'POST',
      endpoint: '/v1/accounts/virtual',
      body: {},
    });

    expect(res.ok).toBe(true);
    expect(res.data.data.bankAccountNumber).toBe('5691931107');
  });

  it('does not demote endpoints whose bodies omit the status flag', async () => {
    const client = clientWith({ results: [], cursor: '' });
    const res = await client.request({ method: 'GET', endpoint: '/v1/accounts' });
    expect(res.ok).toBe(true);
  });

  it('keeps a real HTTP failure failing', async () => {
    const client = clientWith({ code: '403', description: 'Forbidden error', status: false }, 403);
    const res = await client.request({ method: 'GET', endpoint: '/v1/accounts/sub-accounts' });
    expect(res.ok).toBe(false);
    expect(res.pending).toBe(false);
  });

  /**
   * 🔴 DOUBLE-SPEND GUARD. Nomba overloads `status:false` for both "rejected" and
   * "accepted, in flight". A payout that IS being sent answers with `status:false`
   * — and the payout path compensates (credits the merchant's ledger back) on
   * failure. Conflating the two pays the merchant twice: they get the naira from
   * the bank AND keep the balance in our ledger.
   */
  it('does NOT call an in-flight payout a failure (this would double-spend)', async () => {
    const client = clientWith({
      code: '201',
      description: 'PROCESSING',
      status: false, // ← the trap: a SUCCESSFUL transfer reports status:false
      message: 'Unable to process response, please rely on web hook',
      data: { status: 'PENDING_BILLING', id: 'tx-in-flight' },
    });

    const res = await client.request({ method: 'POST', endpoint: '/v1/transfers/bank', body: {} });

    expect(res.pending).toBe(true); // accepted, still working
    expect(res.ok).toBe(true); // and NOT a failure — must never trigger a reversal
    expect(res.providerCode).toBe('201');
  });

  it('still calls a genuinely rejected payout a failure', async () => {
    const client = clientWith({ code: '400', description: 'Insufficient balance', status: false });
    const res = await client.request({ method: 'POST', endpoint: '/v1/transfers/bank', body: {} });
    expect(res.pending).toBe(false);
    expect(res.ok).toBe(false); // never sent → reversal is correct here
  });
});
