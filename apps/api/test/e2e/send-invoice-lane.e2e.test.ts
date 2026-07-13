import { and, eq } from 'drizzle-orm';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { dunningAttemptsTable, invoicesTable } from '@nombaone/core-db/schema';

import { runCycle } from '@shared/services/billing';
import { __setMailTransport, type MailMessage } from '@shared/services/comms';
import { createCustomer } from '@shared/services/customers';
import { runDunningSweep } from '@shared/services/dunning';
import { createPlan } from '@shared/services/plans';
import { createPrice } from '@shared/services/prices';
import { loadSubscriptionRow } from '@shared/services/subscriptions';

import { startHarness, type Harness } from '../helpers/harness';

import type { NombaClient, NombaRequest } from '@nombaone/sara/nomba';

/**
 * The send_invoice (push/transfer) lane — the user's line 11, end to end:
 * issue an invoice with a DUE DATE and a payment link; when it sails past due,
 * enter past_due and run `payment_reminder` dunning (re-send the link, no rail
 * call — there is nothing to charge); churn when the ladder is spent.
 *
 * Before this lane existed a send_invoice subscription could NEVER churn: its
 * unpaid invoices sat `open` forever while it read `active`.
 */
describe('send_invoice lane + push dunning e2e', () => {
  let harness: Harness;
  let bearer: string;
  let ctx: { organizationId: string; mode: 'sandbox' };

  const fakeNomba: NombaClient = {
    getToken: async () => 'tok',
    async request<T = unknown>(req: NombaRequest) {
      if (req.endpoint.includes('/checkout/order')) {
        return {
          status: 200,
          ok: true,
          pending: false, data: { data: { checkoutLink: `https://pay.nomba.com/sandbox/${req.idempotencyRef}` } } as T,
        };
      }
      return { status: 200, ok: true, pending: false, data: {} as T };
    },
    requeryTransaction: async () => ({ found: true, succeeded: true, amount: 0 }),
  };

  beforeAll(async () => {
    harness = await startHarness();
    harness.setNombaClient(fakeNomba);
    const org = await harness.seedOrg('Push Lane Gym');
    bearer = (
      await harness.mintApiKey(org.organizationId, 'sandbox', [
        'customers:write',
        'plans:write',
        'prices:write',
        'subscriptions:read',
        'subscriptions:write',
        'billing_settings:write',
      ])
    ).secret;
    ctx = { organizationId: org.organizationId, mode: 'sandbox' };
  });

  afterAll(async () => {
    __setMailTransport(null);
    await harness?.stop();
  });

  const as = (r: request.Test): request.Test => r.set('Authorization', `Bearer ${bearer}`);
  let seq = 0;
  const uniq = (): string => `${Date.now()}-${seq++}`;

  it('a send_invoice cycle issues: due date, checkout link, and the payment email — then overdue → payment_reminder dunning → churn', async () => {
    const sent: MailMessage[] = [];
    __setMailTransport({
      kind: 'log',
      send: async (m) => {
        sent.push(m);
        return { delivered: true };
      },
    });

    // ⚠ The cron handler uses the `db`/`env` SINGLETONS (not injected) — it must
    // be imported AFTER startHarness() set the container env, or it binds to the
    // real .env and this whole suite silently runs against the live database.
    const { handleOverdueInvoiceSweep } = await import(
      '../../src/services/worker/modules/cron/jobs-handlers/overdue-invoice-sweep'
    );

    const u = uniq();
    const customer = await createCustomer(harness.db, ctx, { email: `push${u}@gym.test`, name: 'Push Payer' });
    const plan = await createPlan(harness.db, ctx, { name: `Gym ${u}` });
    const price = await createPrice(harness.db, ctx, {
      planRef: plan.id,
      unitAmount: 50_000,
      interval: 'minute',
      intervalCount: 10,
      usageType: 'licensed',
      billingScheme: 'per_unit',
      trialPeriodDays: 0,
    });

    const res = await as(request(harness.app).post('/v1/subscriptions'))
      .set('Idempotency-Key', `s-${uniq()}`)
      .send({ customerId: customer.id, priceId: price.id, collectionMethod: 'send_invoice' });
    expect(res.status).toBe(201);
    expect(res.body.data.status).toBe('active'); // accrual model: service starts, invoice follows

    // A send_invoice sub is created `active` with no inline first cycle — the
    // sweep issues it at nextBillingAt (= now). Drive that cycle explicitly.
    await runCycle(harness.db, ctx, res.body.data.id as string);

    const sub = await loadSubscriptionRow(harness.db, ctx, res.body.data.id as string);
    const [inv] = await harness.db
      .select()
      .from(invoicesTable)
      .where(and(eq(invoicesTable.subscriptionId, sub.id), eq(invoicesTable.periodIndex, 0)));

    // ISSUED for real: due date (capped at one period — 10 minutes, not 72h),
    // a stamped hosted-checkout link, and the customer email.
    expect(inv).toBeDefined();
    expect(inv!.dueDate).not.toBeNull();
    const dueInMs = new Date(inv!.dueDate!).getTime() - Date.now();
    expect(dueInMs).toBeLessThanOrEqual(10 * 60_000 + 5_000);
    expect((inv!.metadata as Record<string, unknown>).checkoutLink).toMatch(/^https:\/\/pay\.nomba\.com\//);

    // OVERDUE: force the due date into the past and sweep.
    await harness.db
      .update(invoicesTable)
      .set({ dueDate: new Date(Date.now() - 60_000) })
      .where(eq(invoicesTable.id, inv!.id));
    const swept = await handleOverdueInvoiceSweep();
    expect(swept.entered).toBeGreaterThanOrEqual(1);

    const pastDue = await loadSubscriptionRow(harness.db, ctx, sub.reference);
    expect(pastDue.status).toBe('past_due');

    const [a1] = await harness.db
      .select()
      .from(dunningAttemptsTable)
      .where(eq(dunningAttemptsTable.subscriptionId, sub.id))
      .orderBy(dunningAttemptsTable.attemptNumber);
    expect(a1!.branch).toBe('payment_reminder');
    expect(a1!.failureReason).toBe('invoice_overdue');
    expect(a1!.nextAttemptAt).not.toBeNull(); // scheduled, never parked

    // Drive the ladder to exhaustion: each due attempt re-sends the link
    // (no rail call) and reschedules; the last one churns.
    for (let i = 0; i < 6; i += 1) {
      await harness.db
        .update(dunningAttemptsTable)
        .set({ nextAttemptAt: new Date(Date.now() - 60_000) })
        .where(and(eq(dunningAttemptsTable.subscriptionId, sub.id), eq(dunningAttemptsTable.status, 'scheduled')));
      await runDunningSweep({ db: harness.db, mode: 'sandbox', now: new Date(), batchSize: 100 });
      const s = await loadSubscriptionRow(harness.db, ctx, sub.reference);
      if (s.status === 'canceled') break;
    }

    const churned = await loadSubscriptionRow(harness.db, ctx, sub.reference);
    expect(churned.status).toBe('canceled');
    expect(churned.cancellationReason).toBe('involuntary');

    const [terminal] = await harness.db
      .select()
      .from(invoicesTable)
      .where(eq(invoicesTable.id, inv!.id));
    expect(terminal!.uncollectibleAt).not.toBeNull();
  });
});
