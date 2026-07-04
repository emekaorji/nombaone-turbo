import { and, eq } from 'drizzle-orm';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  customersTable,
  ledgerAccountsTable,
  orgNombaAccountsTable,
  paymentMethodsTable,
  refundsTable,
  settlementsTable,
} from '@nombaone/core-db/schema';
import { createCustomer } from '@nombaone/sara/customers';
import { createPlan } from '@nombaone/sara/plans';
import { createPrice } from '@nombaone/sara/prices';
import { registerRail } from '@nombaone/sara/rails';
import { mintReference } from '@nombaone/sara/reference';

import { startHarness, type Harness } from '../helpers/harness';

import type { NombaClient, NombaRequest } from '@nombaone/sara/nomba';

// The fake Nomba client: bankLookup returns an account name; bankTransfer is asserted
// NOT called (NOMBA_PAYOUT_ENABLED is off in the test env).
let bankTransferCalls = 0;
const fakeNomba: NombaClient = {
  getToken: async () => 'tok',
  async request<T = unknown>(req: NombaRequest) {
    if (req.endpoint.includes('/transfers/bank') && req.method === 'POST') bankTransferCalls += 1;
    if (req.endpoint.includes('/transfers/bank/lookup')) {
      return { status: 200, ok: true, data: { data: { accountName: 'Ada Payer' } } as T };
    }
    return { status: 200, ok: true, data: {} as T };
  },
  requeryTransaction: async () => ({ found: true, succeeded: true, amount: 0 }),
};

describe('settlement refund + payout + escrow e2e (F1/F2/F3)', () => {
  let harness: Harness;
  let bearerA: string;
  let bearerB: string;
  let ctxA: { organizationId: string; mode: 'sandbox' };
  const scopes = [
    'customers:read', 'customers:write', 'subscriptions:read', 'subscriptions:write',
    'invoices:read', 'invoices:write', 'settlements:read', 'settlements:write',
  ];
  let seq = 0;
  const uniq = (): string => `${Date.now()}-${seq++}`;

  beforeAll(async () => {
    harness = await startHarness();
    harness.setNombaClient(fakeNomba);
    registerRail({ key: 'card', direction: 'pull', collect: async () => ({ status: 'succeeded' }) });
    registerRail({ key: 'mandate', direction: 'pull', collect: async () => ({ status: 'succeeded' }) });
    registerRail({ key: 'transfer', direction: 'push', collect: async () => ({ status: 'pending', payInstructions: {} }) });

    const orgA = await harness.seedOrg('Refund A');
    const orgB = await harness.seedOrg('Refund B');
    bearerA = (await harness.mintApiKey(orgA.organizationId, 'sandbox', scopes)).secret;
    bearerB = (await harness.mintApiKey(orgB.organizationId, 'sandbox', scopes)).secret;
    ctxA = { organizationId: orgA.organizationId, mode: 'sandbox' };
    await harness.db.insert(orgNombaAccountsTable).values({
      reference: mintReference('NMA'), organizationId: orgA.organizationId, mode: 'sandbox',
      nombaAccountId: 'nomba_sub_A', accountRef: 'acct_A', kind: 'subaccount', subAccountId: 'nomba_sub_A', status: 'active',
    });
  });

  afterAll(async () => {
    await harness?.stop();
  });

  const asA = (r: request.Test): request.Test => r.set('Authorization', `Bearer ${bearerA}`);

  /** Seed a card subscription that collects + settles → returns its settlement row. */
  async function seedSettlement(unit = 500000): Promise<typeof settlementsTable.$inferSelect> {
    const u = uniq();
    const customer = await createCustomer(harness.db, ctxA, { email: `t${u}@acme.test`, name: 'C' });
    const plan = await createPlan(harness.db, ctxA, { name: `Plan ${u}` });
    const price = await createPrice(harness.db, ctxA, {
      planRef: plan.id, unitAmount: unit, interval: 'month', intervalCount: 1, usageType: 'licensed', billingScheme: 'per_unit', trialPeriodDays: 0,
    });
    const [c] = await harness.db.select({ id: customersTable.id }).from(customersTable)
      .where(and(eq(customersTable.organizationId, ctxA.organizationId), eq(customersTable.reference, customer.id))).limit(1);
    const pmRef = mintReference('PMT');
    await harness.db.insert(paymentMethodsTable).values({
      reference: pmRef, organizationId: ctxA.organizationId, mode: 'sandbox', customerId: c!.id,
      kind: 'card', status: 'active', tokenKey: 'tok', brand: 'visa', last4: '4242', isDefault: true,
    });
    const res = await request(harness.app).post('/v1/subscriptions')
      .set('Authorization', `Bearer ${bearerA}`).set('Idempotency-Key', `s-${uniq()}`)
      .send({ customerId: customer.id, priceId: price.id, paymentMethodId: pmRef });
    const invRef = res.body.data.latestInvoiceId as string;
    const [stl] = await harness.db.select().from(settlementsTable)
      .where(eq(settlementsTable.merchantTxRef, invRef)).limit(1);
    return stl!;
  }

  const accountBalance = async (key: string): Promise<number> => {
    const [a] = await harness.db.select({ balance: ledgerAccountsTable.balance }).from(ledgerAccountsTable)
      .where(and(eq(ledgerAccountsTable.organizationId, ctxA.organizationId), eq(ledgerAccountsTable.key, key))).limit(1);
    return a?.balance ?? 0;
  };

  it('refund reverses ONLY the tenant leg (fee untouched), is idempotent, and 404s cross-tenant', async () => {
    const stl = await seedSettlement(500000);
    const net = stl.netToTenantKobo;
    const feeBefore = await accountBalance('platform_fees');
    const tenantBefore = await accountBalance('tenant_settlement:acct_A');
    expect(tenantBefore).toBe(net); // liability credited at settlement (positive)

    const key = `rf-${uniq()}`;
    const r = await asA(request(harness.app).post(`/v1/settlements/${stl.reference}/refund`)).set('Idempotency-Key', key).send({});
    expect([200, 201]).toContain(r.status);
    expect(r.body.data.amountInKobo).toBe(net);
    expect(r.body.data.status).toBe('ledger_only');

    // tenant leg reversed, platform fee NOT touched
    expect(await accountBalance('tenant_settlement:acct_A')).toBe(tenantBefore - net);
    expect(await accountBalance('platform_fees')).toBe(feeBefore);
    // settlement flagged refunded; exactly one refund row
    const [after] = await harness.db.select().from(settlementsTable).where(eq(settlementsTable.id, stl.id));
    expect(after!.status).toBe('refunded');
    const refunds = await harness.db.select().from(refundsTable).where(eq(refundsTable.settlementId, stl.id));
    expect(refunds).toHaveLength(1);

    // idempotent replay (same key) → same refund, no second reversal
    const replay = await asA(request(harness.app).post(`/v1/settlements/${stl.reference}/refund`)).set('Idempotency-Key', key).send({});
    expect(replay.status).toBe(200);
    expect(await accountBalance('tenant_settlement:acct_A')).toBe(tenantBefore - net); // unchanged

    // a second, different-key full refund is rejected (nothing left)
    const again = await asA(request(harness.app).post(`/v1/settlements/${stl.reference}/refund`)).set('Idempotency-Key', `rf-${uniq()}`).send({});
    expect(again.status).toBe(422);
    expect(again.body.error.code).toBe('REFUND_ALREADY_REFUNDED');

    // cross-tenant B cannot refund A's settlement
    const bResp = await request(harness.app).post(`/v1/settlements/${stl.reference}/refund`)
      .set('Authorization', `Bearer ${bearerB}`).set('Idempotency-Key', `rf-${uniq()}`).send({});
    expect(bResp.status).toBe(404);
  });

  it('refund over the tenant net is rejected (fee is never refundable)', async () => {
    const stl = await seedSettlement(300000);
    const r = await asA(request(harness.app).post(`/v1/settlements/${stl.reference}/refund`))
      .set('Idempotency-Key', `rf-${uniq()}`).send({ amountInKobo: stl.netToTenantKobo + 1 });
    expect(r.status).toBe(422);
    expect(r.body.error.code).toBe('REFUND_AMOUNT_EXCEEDS_NET');
  });

  it('GET /settlements/escrow locks recent net; a payout inside the window is ESCROW_LOCKED', async () => {
    const stl = await seedSettlement(400000);
    const net = stl.netToTenantKobo;

    // A fresh settlement is inside the 3h lock → fully locked, nothing available.
    const esc = await asA(request(harness.app).get('/v1/settlements/escrow'));
    expect(esc.status).toBe(200);
    expect(esc.body.data.lockedInKobo).toBeGreaterThanOrEqual(net);
    expect(esc.body.data.balanceInKobo).toBeGreaterThanOrEqual(net);
    expect(esc.body.data.availableInKobo).toBe(0);

    const locked = await asA(request(harness.app).post('/v1/settlements/payout'))
      .set('Idempotency-Key', `po-${uniq()}`).send({ amountInKobo: net, bankCode: '044', accountNumber: '0123456789' });
    expect(locked.status).toBe(422);
    expect(locked.body.error.code).toBe('ESCROW_LOCKED');
    expect(bankTransferCalls).toBe(0);
  });

  it('payout of unlocked funds posts the ledger debit (flag off ⇒ no bankTransfer) + is idempotent', async () => {
    const stl = await seedSettlement(600000);
    const net = stl.netToTenantKobo;
    // Age this settlement past the 3h lock window.
    await harness.db.update(settlementsTable).set({ createdAt: new Date(Date.now() - 4 * 3_600_000) }).where(eq(settlementsTable.id, stl.id));

    const balanceBefore = await accountBalance('tenant_settlement:acct_A');
    const key = `po-${uniq()}`;
    const r = await asA(request(harness.app).post('/v1/settlements/payout'))
      .set('Idempotency-Key', key).send({ amountInKobo: net, bankCode: '044', accountNumber: '0123456789' });
    expect([200, 201]).toContain(r.status);
    expect(r.body.data.status).toBe('ledger_posted'); // provider transfer flag off
    expect(r.body.data.resolvedAccountName).toBe('Ada Payer'); // bankLookup ran
    expect(bankTransferCalls).toBe(0); // bankTransfer NOT called with the flag off
    expect(await accountBalance('tenant_settlement:acct_A')).toBe(balanceBefore - net);

    // idempotent replay
    const replay = await asA(request(harness.app).post('/v1/settlements/payout'))
      .set('Idempotency-Key', key).send({ amountInKobo: net, bankCode: '044', accountNumber: '0123456789' });
    expect(replay.status).toBe(200);
    expect(await accountBalance('tenant_settlement:acct_A')).toBe(balanceBefore - net); // no double debit

    // exceeding the now-drained available balance is rejected
    const over = await asA(request(harness.app).post('/v1/settlements/payout'))
      .set('Idempotency-Key', `po-${uniq()}`).send({ amountInKobo: net, bankCode: '044', accountNumber: '0123456789' });
    expect(over.status).toBe(422);
    expect(['PAYOUT_EXCEEDS_AVAILABLE', 'ESCROW_LOCKED']).toContain(over.body.error.code);
  });
});
