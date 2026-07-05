import { and, eq, isNull } from 'drizzle-orm';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  customersTable,
  domainEventsTable,
  dunningAttemptsTable,
  invoicesTable,
  paymentMethodsTable,
  subscriptionsTable,
} from '@nombaone/core-db/schema';
import { processInboundInvoiceEvent, runCycle } from '@/domain/billing';
import { createCustomer } from '@/domain/customers';
import { runDunningSweep } from '@/domain/dunning';
import { createPlan } from '@/domain/plans';
import { createPrice } from '@/domain/prices';
import { registerRail } from '@nombaone/sara/rails';
import { mintReference } from '@nombaone/sara/reference';
import { loadSubscriptionRow } from '@/domain/subscriptions';

import { startHarness, type Harness } from '../helpers/harness';

import type { NombaClient, NombaRequest } from '@nombaone/sara/nomba';

let railMode: 'succeeded' | 'requires_action' = 'succeeded';
let requeryAmount = 0;

// checkout/order returns a fresh link (for the OTP-completion mint); requery confirms settle.
const fakeNomba: NombaClient = {
  getToken: async () => 'tok',
  async request<T = unknown>(req: NombaRequest) {
    if (req.endpoint.includes('/checkout/order')) {
      return { status: 200, ok: true, data: { data: { checkoutLink: 'https://pay.nomba.com/otp-link' } } as T };
    }
    return { status: 200, ok: true, data: {} as T };
  },
  requeryTransaction: async () => ({ found: true, succeeded: true, amount: requeryAmount }),
};

describe('card OTP/3DS → dunning → fresh-checkout-link e2e (Area 1)', () => {
  let harness: Harness;
  let bearerA: string;
  let ctxA: { organizationId: string; mode: 'sandbox' };
  const scopes = ['customers:read', 'customers:write', 'subscriptions:read', 'subscriptions:write'];
  let seq = 0;
  const uniq = (): string => `${Date.now()}-${seq++}`;

  beforeAll(async () => {
    harness = await startHarness();
    harness.setNombaClient(fakeNomba);
    registerRail({
      key: 'card',
      direction: 'pull',
      collect: async () =>
        railMode === 'requires_action'
          ? { status: 'requires_action', failureReason: 'otp_required', action: { type: 'otp_3ds', message: 'Kindly enter the OTP sent to ****1958' } }
          : { status: 'succeeded' },
    });
    registerRail({ key: 'mandate', direction: 'pull', collect: async () => ({ status: 'succeeded' }) });
    registerRail({ key: 'transfer', direction: 'push', collect: async () => ({ status: 'pending', payInstructions: {} }) });

    const orgA = await harness.seedOrg('OTP A');
    bearerA = (await harness.mintApiKey(orgA.organizationId, 'sandbox', scopes)).secret;
    ctxA = { organizationId: orgA.organizationId, mode: 'sandbox' };
  });

  afterAll(async () => {
    await harness?.stop();
  });

  const asA = (r: request.Test): request.Test => r.set('Authorization', `Bearer ${bearerA}`);

  async function seedActiveCardSub(): Promise<{ subRef: string; subId: string }> {
    const u = uniq();
    const customer = await createCustomer(harness.db, ctxA, { email: `o${u}@acme.test`, name: 'C' });
    const plan = await createPlan(harness.db, ctxA, { name: `Plan ${u}` });
    const price = await createPrice(harness.db, ctxA, {
      planRef: plan.id, unitAmount: 500000, interval: 'month', intervalCount: 1, usageType: 'licensed', billingScheme: 'per_unit', trialPeriodDays: 0,
    });
    const [c] = await harness.db.select({ id: customersTable.id }).from(customersTable)
      .where(and(eq(customersTable.organizationId, ctxA.organizationId), eq(customersTable.reference, customer.id))).limit(1);
    const pmRef = mintReference('PMT');
    await harness.db.insert(paymentMethodsTable).values({
      reference: pmRef, organizationId: ctxA.organizationId, mode: 'sandbox', customerId: c!.id,
      kind: 'card', status: 'active', tokenKey: 'tok', brand: 'visa', last4: '4242', isDefault: true,
    });
    railMode = 'succeeded';
    const res = await asA(request(harness.app).post('/v1/subscriptions')).set('Idempotency-Key', `s-${uniq()}`)
      .send({ customerId: customer.id, priceId: price.id, paymentMethodId: pmRef });
    const subRef = res.body.data.id as string;
    const subId = (await loadSubscriptionRow(harness.db, ctxA, subRef)).id;
    return { subRef, subId };
  }

  const eventsFor = async (reference: string) => {
    const rows = await harness.db.select({ type: domainEventsTable.type, payload: domainEventsTable.payload })
      .from(domainEventsTable).where(eq(domainEventsTable.organizationId, ctxA.organizationId));
    return rows.filter((r) => (r.payload as { reference?: string }).reference === reference);
  };

  it('a renewal that returns requires_action holds (no payment_failed), emits ONE action_required with a link, and the completion webhook settles + recovers', async () => {
    const { subRef, subId } = await seedActiveCardSub();

    // Renewal charge → the bank forces OTP.
    railMode = 'requires_action';
    await harness.db.update(subscriptionsTable).set({ nextBillingAt: new Date(Date.now() - 60_000) }).where(eq(subscriptionsTable.id, subId));
    await runCycle(harness.db, ctxA, subRef);

    // The open renewal invoice (period 2).
    const [inv] = await harness.db.select().from(invoicesTable)
      .where(and(eq(invoicesTable.subscriptionId, subId), isNull(invoicesTable.paidAt))).limit(1);
    expect(inv).toBeTruthy();
    const invRef = inv!.reference;

    // Sub past_due, invoice still open, action signal persisted (NOT a payment_failed).
    expect((await loadSubscriptionRow(harness.db, ctxA, subRef)).status).toBe('past_due');
    expect(inv!.paidAt).toBeNull();
    expect(inv!.lastFailureReason).toBe('otp_required');

    let evs = await eventsFor(invRef);
    const action = evs.filter((e) => e.type === 'invoice.action_required');
    expect(action).toHaveLength(1);
    expect((action[0]!.payload as { checkoutLink?: string }).checkoutLink).toBe('https://pay.nomba.com/otp-link');
    expect(evs.some((e) => e.type === 'invoice.payment_failed')).toBe(false);

    // Dunning sweep detects the past_due invoice → holds attempt #1 (no re-charge, no 2nd event).
    await runDunningSweep({ db: harness.db, mode: 'sandbox', now: new Date(), batchSize: 100 });
    const [held] = await harness.db.select().from(dunningAttemptsTable).where(eq(dunningAttemptsTable.invoiceId, inv!.id));
    expect(held!.status).toBe('card_update_required');
    expect(held!.outcome).toBe(null); // scheduleFirstAttempt sets no outcome; only the hold status
    evs = await eventsFor(invRef);
    expect(evs.filter((e) => e.type === 'invoice.action_required')).toHaveLength(1); // still exactly one

    // The customer completes the fresh checkout — Nomba posts a payment_success carrying
    // the `${invRef}-otp` order reference. It settles the SAME invoice + closes the hold.
    requeryAmount = inv!.amountDue;
    const result = await processInboundInvoiceEvent(harness.db, () => fakeNomba, {
      requestId: `req-${uniq()}`,
      eventType: 'payment_success',
      payload: { data: { orderReference: `${invRef}-otp`, transaction: { transactionId: 'WEB-ONLINE_C-otp' } } },
    });
    expect(result.matched).toBe(true);
    expect(result.settled).toBe(true);

    // Invoice paid, sub recovered, held attempt closed, recovery event emitted.
    const [paid] = await harness.db.select().from(invoicesTable).where(eq(invoicesTable.id, inv!.id));
    expect(paid!.paidAt).not.toBeNull();
    expect((await loadSubscriptionRow(harness.db, ctxA, subRef)).status).toBe('active');
    const [closed] = await harness.db.select().from(dunningAttemptsTable).where(eq(dunningAttemptsTable.id, held!.id));
    expect(closed!.status).toBe('succeeded');
    expect(closed!.outcome).toBe('recovered');
    expect((await eventsFor(invRef)).some((e) => e.type === 'invoice.payment_recovered')).toBe(true);

    // Idempotent replay of the completion → no second settle.
    const replay = await processInboundInvoiceEvent(harness.db, () => fakeNomba, {
      requestId: `req-${uniq()}`,
      eventType: 'payment_success',
      payload: { data: { orderReference: `${invRef}-otp`, transaction: { transactionId: 'WEB-ONLINE_C-otp' } } },
    });
    expect(replay.settled).toBe(false);
  });
});
