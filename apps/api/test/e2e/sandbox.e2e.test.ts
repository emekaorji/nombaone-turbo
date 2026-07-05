import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createCustomer } from '@/domain/customers';

import { startHarness, type Harness } from '../helpers/harness';

/**
 * Item 3 — the OPT-IN real-sandbox integration suite. This is the ONLY suite that hits
 * the network (`sandbox.nomba.com`). Every other e2e uses a fake Nomba on purpose (fast,
 * deterministic, no creds); this one exercises the real client + rails against the live
 * sandbox to catch shape/contract drift the fake can't.
 *
 * Gated on BOTH `RUN_SANDBOX_E2E=1` AND Nomba being configured (real keys in env), so a
 * normal CI run — no flag, or no creds/network — skips it entirely.
 *
 * Run:
 *   RUN_SANDBOX_E2E=1 pnpm --filter @nombaone/api test -- sandbox.e2e
 * (with NOMBA_BASE_URL / NOMBA_PARENT_ACCOUNT_ID / NOMBA_CLIENT_ID / NOMBA_CLIENT_SECRET
 *  pointing at the sandbox — the same keys T0 used.)
 *
 * SCOPE: this automates the calls that don't need a human — Nomba auth, hosted-checkout
 * INITIATION (returns a real `checkoutLink`), virtual-account issue (real NUBAN), and a
 * requery. The full `create → tokenize → renew → fail → recover` money loop needs a human
 * to COMPLETE the hosted checkout (enter a card on the returned link) and a funded charge,
 * so that leg is driven in the live session (Group E), not headlessly here.
 */
const RUN = process.env.RUN_SANDBOX_E2E === '1';
// Read the env directly (not via the config module) so the gate resolves at collection
// time without pulling in the redis/env singletons before the harness binds them.
const NOMBA_CONFIGURED = Boolean(
  process.env.NOMBA_BASE_URL &&
    process.env.NOMBA_PARENT_ACCOUNT_ID &&
    process.env.NOMBA_CLIENT_ID &&
    process.env.NOMBA_CLIENT_SECRET
);

describe.skipIf(!(RUN && NOMBA_CONFIGURED))('nomba sandbox integration (item 3, opt-in, network)', () => {
  let harness: Harness;
  let bearer: string;
  let ctx: { organizationId: string; mode: 'sandbox' };
  let customerRef: string;

  beforeAll(async () => {
    harness = await startHarness();
    // Do NOT inject a fake — use the REAL sandbox client + register the real rails.
    const { registerRailsIfConfigured } = await import('../../src/shared/config/nomba');
    registerRailsIfConfigured();

    const org = await harness.seedOrg('Sandbox');
    ctx = { organizationId: org.organizationId, mode: 'sandbox' };
    bearer = (
      await harness.mintApiKey(org.organizationId, 'sandbox', ['customers:write', 'payment_methods:write'])
    ).secret;
    const customer = await createCustomer(harness.db, ctx, { email: 'sandbox@acme.test', name: 'Sandbox' });
    customerRef = customer.id;
  }, 60_000);

  afterAll(async () => {
    await harness?.stop();
  });

  const auth = (r: request.Test): request.Test => r.set('Authorization', `Bearer ${bearer}`);

  it('authenticates against the real Nomba sandbox (client_credentials → token)', async () => {
    const { getNombaClient } = await import('../../src/shared/config/nomba');
    const token = await getNombaClient('sandbox').getToken();
    expect(typeof token).toBe('string');
    expect(token.length).toBeGreaterThan(0);
  }, 30_000);

  it('initiates hosted-checkout card tokenization → a real checkoutLink', async () => {
    const res = await auth(request(harness.app).post('/v1/payment-methods/setup'))
      .set('Idempotency-Key', `sbx-setup-${Date.now()}`)
      .send({ customerRef, amount: 5000, callbackUrl: 'https://tunnel.nombaone.xyz/callback' });
    expect(res.status).toBeLessThan(300);
    expect(typeof res.body.data.checkoutLink).toBe('string');
    expect(res.body.data.checkoutLink).toMatch(/^https?:\/\//);
    expect(res.body.data.reference).toMatch(/pmt$/i);
  }, 30_000);

  it('issues a real virtual account (NUBAN) for the transfer rail', async () => {
    const res = await auth(request(harness.app).post('/v1/payment-methods/virtual-account'))
      .set('Idempotency-Key', `sbx-va-${Date.now()}`)
      .send({ customerRef });
    expect(res.status).toBeLessThan(300);
    expect(res.body.data.accountNumber).toMatch(/^\d{10}$/); // a NUBAN
    expect(typeof res.body.data.accountRef).toBe('string');
  }, 30_000);

  it('requeries an unknown transaction gracefully (found:false, no throw)', async () => {
    const { getNombaClient } = await import('../../src/shared/config/nomba');
    const result = await getNombaClient('sandbox').requeryTransaction(ctx, { reference: `nbo000000000000inv` });
    expect(result.found).toBe(false);
    expect(result.succeeded).toBe(false);
  }, 30_000);
});
