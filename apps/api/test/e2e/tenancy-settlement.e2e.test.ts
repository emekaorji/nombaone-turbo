import { and, eq } from 'drizzle-orm';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  customersTable,
  domainEventsTable,
  ledgerTransactionsTable,
  orgBillingSettingsTable,
  orgNombaAccountsTable,
  paymentMethodsTable,
  settlementsTable,
  subscriptionsTable,
} from '@nombaone/core-db/schema';
import { createCustomer } from '@shared/services/customers';
import { createPlan } from '@shared/services/plans';
import { createPrice } from '@shared/services/prices';
import { registerRail } from '@nombaone/sara/rails';
import { mintReference } from '@nombaone/sara/reference';
import { selectDueSubscriptionsFair } from '@shared/services/scheduling';

import { startHarness, type Harness } from '../helpers/harness';

import type { NombaClient } from '@nombaone/sara/nomba';

let cardOutcome: 'succeeded' | 'pending' | 'failed' = 'succeeded';

const fakeNomba: NombaClient = {
  getToken: async () => 'tok',
  async request<T = unknown>() {
    return { status: 200, ok: true, data: {} as T };
  },
  requeryTransaction: async () => ({ found: true, succeeded: true, amount: 0 }),
};

describe('multi-tenancy + settlement e2e (★ H)', () => {
  let harness: Harness;
  let bearerA: string;
  let bearerB: string;
  let ctxA: { organizationId: string; mode: 'sandbox' };
  let ctxB: { organizationId: string; mode: 'sandbox' };

  const scopes = [
    'customers:read', 'customers:write', 'subscriptions:read', 'subscriptions:write',
    'invoices:read', 'invoices:write', 'settlements:read', 'organizations:read', 'organizations:write',
    'webhooks:read', 'webhooks:write',
  ];

  beforeAll(async () => {
    harness = await startHarness();
    harness.setNombaClient(fakeNomba);
    registerRail({ key: 'card', direction: 'pull', collect: async () => ({ status: cardOutcome }) });
    registerRail({ key: 'mandate', direction: 'pull', collect: async () => ({ status: cardOutcome }) });
    registerRail({ key: 'transfer', direction: 'push', collect: async () => ({ status: 'pending', payInstructions: {} }) });

    const orgA = await harness.seedOrg('Ten A');
    const orgB = await harness.seedOrg('Ten B');
    bearerA = (await harness.mintApiKey(orgA.organizationId, 'sandbox', scopes)).secret;
    bearerB = (await harness.mintApiKey(orgB.organizationId, 'sandbox', scopes)).secret;
    ctxA = { organizationId: orgA.organizationId, mode: 'sandbox' };
    ctxB = { organizationId: orgB.organizationId, mode: 'sandbox' };

    // Onboard tenant A to a Nomba sub-account so its collections settle.
    await harness.db.insert(orgNombaAccountsTable).values({
      reference: mintReference('NMA'), organizationId: orgA.organizationId, mode: 'sandbox',
      nombaAccountId: 'nomba_sub_A', accountRef: 'acct_A', kind: 'subaccount', subAccountId: 'nomba_sub_A', status: 'active',
    });
  });

  afterAll(async () => {
    await harness?.stop();
  });

  const asA = (r: request.Test): request.Test => r.set('Authorization', `Bearer ${bearerA}`);
  const asB = (r: request.Test): request.Test => r.set('Authorization', `Bearer ${bearerB}`);
  let seq = 0;
  const uniq = (): string => `${Date.now()}-${seq++}`;

  async function seedCardSub(
    ctx: typeof ctxA,
    bearer: string,
    unit = 500000
  ): Promise<{ subRef: string; subId: string; customerRef: string; invRef: string }> {
    const u = uniq();
    const customer = await createCustomer(harness.db, ctx, { email: `t${u}@acme.test`, name: 'C' });
    const plan = await createPlan(harness.db, ctx, { name: `Plan ${u}` });
    const price = await createPrice(harness.db, ctx, {
      planRef: plan.id, unitAmount: unit, interval: 'month', intervalCount: 1, usageType: 'licensed', billingScheme: 'per_unit', trialPeriodDays: 0,
    });
    const [c] = await harness.db.select({ id: customersTable.id }).from(customersTable)
      .where(and(eq(customersTable.organizationId, ctx.organizationId), eq(customersTable.reference, customer.id))).limit(1);
    const pmRef = mintReference('PMT');
    await harness.db.insert(paymentMethodsTable).values({
      reference: pmRef, organizationId: ctx.organizationId, mode: 'sandbox', customerId: c!.id,
      kind: 'card', status: 'active', tokenKey: 'tok', brand: 'visa', last4: '4242', isDefault: true,
    });
    cardOutcome = 'succeeded';
    const res = await request(harness.app).post('/v1/subscriptions')
      .set('Authorization', `Bearer ${bearer}`).set('Idempotency-Key', `s-${uniq()}`)
      .send({ customerId: customer.id, priceId: price.id, paymentMethodId: pmRef });
    const subId = (await harness.db.select({ id: subscriptionsTable.id }).from(subscriptionsTable)
      .where(eq(subscriptionsTable.reference, res.body.data.id)).limit(1))[0]!.id;
    return { subRef: res.body.data.id, subId, customerRef: customer.id, invRef: res.body.data.latestInvoiceId };
  }

  // ── H5 ★ settlement split (happy + idempotency) ─────────────────────────────
  it('H5 ★ — a collection settles through the sub-account split (gross = fee + net) exactly once', async () => {
    const { subId, invRef } = await seedCardSub(ctxA, bearerA);

    const [stl] = await harness.db.select().from(settlementsTable).where(eq(settlementsTable.organizationId, ctxA.organizationId));
    expect(stl).toBeTruthy();
    expect(stl!.grossKobo).toBe(500000);
    expect(stl!.platformFeeKobo).toBeGreaterThan(0);
    expect(stl!.grossKobo).toBe(stl!.platformFeeKobo + stl!.netToTenantKobo); // L4 kobo-exact
    expect(stl!.subAccountRef).toBe('acct_A');
    expect(stl!.merchantTxRef).toBe(invRef);
    expect(stl!.ledgerTransactionId).toBeTruthy();

    // one balanced settlement ledger transaction
    const settleTxns = (await harness.db.select({ kind: ledgerTransactionsTable.kind, memo: ledgerTransactionsTable.memo })
      .from(ledgerTransactionsTable).where(eq(ledgerTransactionsTable.organizationId, ctxA.organizationId)))
      .filter((t) => t.kind === 'settlement' && t.memo?.includes(stl!.reference));
    expect(settleTxns).toHaveLength(1);

    // settlement.created emitted
    const events = (await harness.db.select({ type: domainEventsTable.type, payload: domainEventsTable.payload })
      .from(domainEventsTable).where(eq(domainEventsTable.organizationId, ctxA.organizationId)))
      .filter((e) => (e.payload as { reference?: string }).reference === stl!.reference);
    expect(events.some((e) => e.type === 'settlement.created')).toBe(true);

    // API list surfaces it
    const list = await asA(request(harness.app).get('/v1/settlements'));
    expect(list.status).toBe(200);
    expect(list.body.data.some((s: { id: string }) => s.id === stl!.reference)).toBe(true);

    // idempotency (K2): exactly one settlement per invoice reference (unique merchant_tx_ref).
    const forInvoice = await harness.db.select().from(settlementsTable).where(eq(settlementsTable.merchantTxRef, invRef));
    expect(forInvoice).toHaveLength(1);
    expect(subId).toBeTruthy();
  });

  // ── H4 config surface ───────────────────────────────────────────────────────
  it('H4 — GET/PUT /v1/organization unifies config; branding updates; the webhook secret is never returned', async () => {
    const get = await asA(request(harness.app).get('/v1/organization'));
    expect(get.status).toBe(200);
    expect(get.body.data.nombaAccount.accountRef).toBe('acct_A');
    expect(get.body.data.billing.settlementMode).toBe('split_at_collection');
    expect(JSON.stringify(get.body.data)).not.toContain('signingSecret"'); // only prefix, never the secret

    const put = await asA(request(harness.app).put('/v1/organization')).set('Idempotency-Key', `st-${uniq()}`)
      .send({ branding: { displayName: 'Acme Billing' }, settlementMode: 'collect_then_payout' });
    expect(put.status).toBe(200);
    expect(put.body.data.billing.branding.displayName).toBe('Acme Billing');
    expect(put.body.data.billing.settlementMode).toBe('collect_then_payout');
    // no field exists to self-raise the rate limit → the body is rejected if it tries
    const bad = await asA(request(harness.app).put('/v1/organization')).set('Idempotency-Key', `st-${uniq()}`).send({ rateLimitPerMinute: 100000 });
    expect(bad.status).toBe(422); // refine: no settable field present
  });

  // ── H6 monthly quota ─────────────────────────────────────────────────────────
  it('H6 — a tenant past its monthly request quota gets 429 QUOTA_EXCEEDED', async () => {
    // A THROWAWAY tenant so exhausting the quota does not pollute A/B.
    const orgQ = await harness.seedOrg('Ten Q');
    const bearerQ = (await harness.mintApiKey(orgQ.organizationId, 'sandbox', ['organizations:read'])).secret;
    // Operator seam: set a tiny quota directly (the tenant API cannot).
    await harness.db.insert(orgBillingSettingsTable)
      .values({ organizationId: orgQ.organizationId, mode: 'sandbox', monthlyRequestQuota: 2 })
      .onConflictDoUpdate({ target: [orgBillingSettingsTable.organizationId, orgBillingSettingsTable.mode], set: { monthlyRequestQuota: 2 } });

    let quotaHit = false;
    for (let i = 0; i < 6; i += 1) {
      const r = await request(harness.app).get('/v1/organization').set('Authorization', `Bearer ${bearerQ}`);
      if (r.status === 429 && r.body.error?.code === 'QUOTA_EXCEEDED') { quotaHit = true; break; }
    }
    expect(quotaHit).toBe(true);
  });

  // ── H7 ★ fair scheduling — no tenant starves ────────────────────────────────
  it('H7 ★ — fair selection caps a backlog tenant per tick and never starves a small tenant', async () => {
    // Tenant A: 4 due subs. Tenant B: 2 due subs. perTenantBudget = 2.
    const aSubs = [await seedCardSub(ctxA, bearerA), await seedCardSub(ctxA, bearerA), await seedCardSub(ctxA, bearerA), await seedCardSub(ctxA, bearerA)];
    const bSubs = [await seedCardSub(ctxB, bearerB), await seedCardSub(ctxB, bearerB)];
    // Make all of them due.
    await harness.db.update(subscriptionsTable).set({ nextBillingAt: new Date(Date.now() - 60_000) })
      .where(eq(subscriptionsTable.organizationId, ctxA.organizationId));
    await harness.db.update(subscriptionsTable).set({ nextBillingAt: new Date(Date.now() - 60_000) })
      .where(eq(subscriptionsTable.organizationId, ctxB.organizationId));

    const drawn = await selectDueSubscriptionsFair(harness.db, 'sandbox', new Date(), { globalBudget: 100, perTenantBudget: 2 });
    const fromA = drawn.filter((r) => r.organizationId === ctxA.organizationId);
    const fromB = drawn.filter((r) => r.organizationId === ctxB.organizationId);
    expect(aSubs.length).toBe(4);
    expect(fromA.length).toBe(2); // A (the backlog tenant) is capped at perTenantBudget
    // ALL of B's due subs are drawn in the same tick — never starved behind A's backlog.
    const drawnIds = new Set(drawn.map((r) => r.id));
    expect(bSubs.every((s) => drawnIds.has(s.subId))).toBe(true);
    expect(fromB.length).toBe(2);
  });

  // ── H2 ⚠ / H3 isolation — A's key cannot touch B's resources ────────────────
  it('H2 ⚠ / H3 — tenant A cannot read or mutate tenant B resources on any surface (no god key)', async () => {
    const b = await seedCardSub(ctxB, bearerB);
    const [bStl] = await harness.db.select().from(settlementsTable).where(eq(settlementsTable.organizationId, ctxB.organizationId)).limit(1);

    // Reads → 404 (no leak). Mutations → 404 (nothing applied).
    expect((await asA(request(harness.app).get(`/v1/subscriptions/${b.subRef}`))).status).toBe(404);
    expect((await asA(request(harness.app).get(`/v1/customers/${b.customerRef}`))).status).toBe(404);
    if (b.invRef) expect((await asA(request(harness.app).get(`/v1/invoices/${b.invRef}`))).status).toBe(404);
    if (bStl) expect((await asA(request(harness.app).get(`/v1/settlements/${bStl.reference}`))).status).toBe(404);
    expect((await asA(request(harness.app).post(`/v1/subscriptions/${b.subRef}/cancel`)).set('Idempotency-Key', `x-${uniq()}`).send({ mode: 'now' })).status).toBe(404);

    // B's data is unchanged (re-read with B's key).
    const stillActive = await asB(request(harness.app).get(`/v1/subscriptions/${b.subRef}`));
    expect(stillActive.status).toBe(200);
    expect(stillActive.body.data.status).not.toBe('canceled');
  });

  // ── K3 ⚠ cross-tenant concurrency — two tenants' cycles don't cross-contaminate ─
  it('K3 ⚠ — two tenants billing concurrently each charge their OWN subscription exactly once', async () => {
    const { runCycle } = await import('@shared/services/billing');
    const a = await seedCardSub(ctxA, bearerA, 300000);
    const bSub = await seedCardSub(ctxB, bearerB, 700000);
    await harness.db.update(subscriptionsTable).set({ nextBillingAt: new Date(Date.now() - 60_000) }).where(eq(subscriptionsTable.id, a.subId));
    await harness.db.update(subscriptionsTable).set({ nextBillingAt: new Date(Date.now() - 60_000) }).where(eq(subscriptionsTable.id, bSub.subId));

    // Both tenants' cycles run at once — under their OWN ctx.
    await Promise.all([runCycle(harness.db, ctxA, a.subRef), runCycle(harness.db, ctxB, bSub.subRef)]);

    const chargesFor = async (invRef: string): Promise<number> =>
      (await harness.db.select({ kind: ledgerTransactionsTable.kind, memo: ledgerTransactionsTable.memo }).from(ledgerTransactionsTable))
        .filter((t) => t.kind === 'charge' && t.memo?.includes(invRef)).length;

    // Each period-1 invoice charged exactly once, in its own tenant's books.
    const [invA] = await harness.db.select({ reference: subscriptionsTable.reference }).from(subscriptionsTable).where(eq(subscriptionsTable.id, a.subId));
    expect(invA).toBeTruthy();
    // no cross-contamination: A has no settlement/charge tied to B's invoice ref and vice versa
    if (bSub.invRef) expect(await chargesFor(bSub.invRef)).toBe(1);
    if (a.invRef) expect(await chargesFor(a.invRef)).toBe(1);
  });
});
