import { and, eq } from 'drizzle-orm';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { invoicesTable, subscriptionsTable } from '@nombaone/core-db/schema';
import { registerRail } from '@nombaone/sara/rails';

import { runCycle } from '@shared/services/billing';
import { env } from '@shared/config/env';
import { createCustomer } from '@shared/services/customers';
import { computeMrr } from '@shared/services/metrics';
import { createPlan } from '@shared/services/plans';
import { loadSubscriptionRow } from '@shared/services/subscriptions';

import { startHarness, type Harness } from '../helpers/harness';

import type { NombaClient } from '@nombaone/sara/nomba';

const MINUTE_MS = 60_000;
const TEN_MINUTES_MS = 10 * MINUTE_MS;

/**
 * Wall-clock cadence e2e (`interval: 'minute'`). Real Postgres + Redis, and the
 * deterministic sandbox payment methods, so a full renewal loop runs without Nomba.
 *
 * This is the suite that would have caught the two landmines a naive enum addition
 * walks into: `addIntervalFromAnchor`'s day/week-else-month fallthrough (which billed a
 * minute cadence in MONTHS) and the billing-hour anchor (which collapsed every boundary
 * onto 02:00, i.e. a zero-length period that bills until the catch-up guard trips).
 *
 * It also pins the two lifecycle bugs fixed alongside: cancel-at-period-end was written
 * and never read, and resume shifted `current_period_end` but not `next_billing_at`.
 */
describe('wall-clock cadence (minute) e2e', () => {
  let harness: Harness;
  let bearer: string;
  let ctx: { organizationId: string; mode: 'sandbox' };

  const scopes = [
    'customers:read',
    'customers:write',
    'plans:read',
    'plans:write',
    'prices:read',
    'prices:write',
    'subscriptions:read',
    'subscriptions:write',
    'invoices:read',
    'payment_methods:read',
    'payment_methods:write',
  ];

  const fakeNomba: NombaClient = {
    getToken: async () => 'tok',
    async request<T = unknown>() {
      return { status: 200, ok: true, pending: false, data: {} as T };
    },
    requeryTransaction: async () => ({ found: true, succeeded: true, amount: 0 }),
  };

  beforeAll(async () => {
    harness = await startHarness();
    harness.setNombaClient(fakeNomba);
    // Sandbox `test_*` methods short-circuit before the rail; if the real one runs, fail loudly.
    registerRail({
      key: 'card',
      direction: 'pull',
      collect: async () => {
        throw new Error('the real card rail must not run for a sandbox payment method');
      },
    });

    const org = await harness.seedOrg('Wall Clock');
    bearer = (await harness.mintApiKey(org.organizationId, 'sandbox', scopes)).secret;
    ctx = { organizationId: org.organizationId, mode: 'sandbox' };
  });

  afterAll(async () => {
    await harness?.stop();
  });

  const as = (r: request.Test): request.Test => r.set('Authorization', `Bearer ${bearer}`);
  let seq = 0;
  const uniq = (): string => `${Date.now()}-${seq++}`;

  /** Creates the price over REAL HTTP — that is the point: it proves the zod enum, the
   *  Postgres enum and the OpenAPI schema all accept the new unit, not just the types. */
  async function seedTenMinutePrice(
    unitAmountInKobo: number
  ): Promise<{ customerRef: string; priceRef: string }> {
    const u = uniq();
    const customer = await createCustomer(harness.db, ctx, { email: `c${u}@gym.test`, name: 'C' });
    const plan = await createPlan(harness.db, ctx, { name: `Gym ${u}` });

    const price = await as(request(harness.app).post(`/v1/plans/${plan.id}/prices`))
      .set('Idempotency-Key', `prc-${uniq()}`)
      .send({ unitAmountInKobo, interval: 'minute', intervalCount: 10 });

    expect(price.status).toBe(201);
    expect(price.body.data.interval).toBe('minute');
    expect(price.body.data.intervalCount).toBe(10);
    return { customerRef: customer.id, priceRef: price.body.data.id };
  }

  const createTestPM = (customerId: string, behavior = 'success'): request.Test =>
    as(request(harness.app).post('/v1/sandbox/payment-methods'))
      .set('Idempotency-Key', `pm-${uniq()}`)
      .send({ customerId, behavior });

  const newSub = (body: Record<string, unknown>): request.Test =>
    as(request(harness.app).post('/v1/subscriptions'))
      .set('Idempotency-Key', `s-${uniq()}`)
      .send(body);

  async function startTenMinuteSub(
    unitAmountInKobo = 10_000
  ): Promise<{ subRef: string; startedAt: Date }> {
    const { customerRef, priceRef } = await seedTenMinutePrice(unitAmountInKobo);
    const pm = await createTestPM(customerRef);
    const startedAt = new Date();
    const sub = await newSub({
      customerId: customerRef,
      priceId: priceRef,
      paymentMethodId: pm.body.data.id,
    });
    expect(sub.status).toBe(201);
    expect(sub.body.data.status).toBe('active');
    return { subRef: sub.body.data.id as string, startedAt };
  }

  const invoiceCount = async (subRef: string): Promise<number> => {
    const sub = await loadSubscriptionRow(harness.db, ctx, subRef);
    const rows = await harness.db
      .select({ id: invoicesTable.id })
      .from(invoicesTable)
      .where(
        and(
          eq(invoicesTable.organizationId, ctx.organizationId),
          eq(invoicesTable.subscriptionId, sub.id)
        )
      );
    return rows.length;
  };

  it('a 10-minute period is exactly 10 minutes — never zero-length, never billed as months', async () => {
    const { subRef, startedAt } = await startTenMinuteSub();
    const sub = await loadSubscriptionRow(harness.db, ctx, subRef);

    const start = sub.currentPeriodStart as Date;
    const end = sub.currentPeriodEnd as Date;
    expect(end.getTime() - start.getTime()).toBe(TEN_MINUTES_MS);

    // The anchor is the ACTIVATION INSTANT, not 02:00 Africa/Lagos (01:00 UTC). If the
    // billing hour had been applied, start === end and this period would be zero-length.
    const anchor = sub.billingCycleAnchor as Date;
    expect(Math.abs(anchor.getTime() - startedAt.getTime())).toBeLessThan(30_000);

    // The renewal cursor is the period end — 10 minutes out, not a month and not "now".
    expect((sub.nextBillingAt as Date).getTime()).toBe(end.getTime());
  });

  it('renewals are contiguous 10-minute windows and exactly-once per period', async () => {
    const { subRef } = await startTenMinuteSub();
    const first = await loadSubscriptionRow(harness.db, ctx, subRef);

    const renewed = await runCycle(harness.db, ctx, subRef);
    expect(renewed.outcome).toBe('paid');

    const second = await loadSubscriptionRow(harness.db, ctx, subRef);
    expect(second.currentPeriodIndex).toBe(first.currentPeriodIndex + 1);
    // Period N starts exactly where period N-1 ended — no gap, no overlap, no drift.
    expect((second.currentPeriodStart as Date).getTime()).toBe(
      (first.currentPeriodEnd as Date).getTime()
    );
    expect(
      (second.currentPeriodEnd as Date).getTime() - (second.currentPeriodStart as Date).getTime()
    ).toBe(TEN_MINUTES_MS);
    expect(await invoiceCount(subRef)).toBe(2);

    // Re-running the same period claims nothing new (K2): still two invoices.
    await runCycle(harness.db, ctx, subRef);
    expect(await invoiceCount(subRef)).toBe(3); // the NEXT period, not a second charge for the same one
    const third = await loadSubscriptionRow(harness.db, ctx, subRef);
    expect(third.currentPeriodIndex).toBe(second.currentPeriodIndex + 1);
  });

  it('MRR normalizes a minute cadence honestly instead of booking it as monthly', async () => {
    const org = await harness.seedOrg('MRR Isolation');
    const isolated = { organizationId: org.organizationId, mode: 'sandbox' as const };
    const isolatedBearer = (await harness.mintApiKey(org.organizationId, 'sandbox', scopes)).secret;

    const u = uniq();
    const customer = await createCustomer(harness.db, isolated, {
      email: `m${u}@gym.test`,
      name: 'M',
    });
    const plan = await createPlan(harness.db, isolated, { name: `MRR ${u}` });
    const price = await request(harness.app)
      .post(`/v1/plans/${plan.id}/prices`)
      .set('Authorization', `Bearer ${isolatedBearer}`)
      .set('Idempotency-Key', `prc-${uniq()}`)
      .send({ unitAmountInKobo: 10_000, interval: 'minute', intervalCount: 10 });
    expect(price.status).toBe(201);

    const pm = await request(harness.app)
      .post('/v1/sandbox/payment-methods')
      .set('Authorization', `Bearer ${isolatedBearer}`)
      .set('Idempotency-Key', `pm-${uniq()}`)
      .send({ customerId: customer.id, behavior: 'success' });
    await request(harness.app)
      .post('/v1/subscriptions')
      .set('Authorization', `Bearer ${isolatedBearer}`)
      .set('Idempotency-Key', `s-${uniq()}`)
      .send({ customerId: customer.id, priceId: price.body.data.id, paymentMethodId: pm.body.data.id });

    // ₦100 every ten minutes = 4,380 charges a month. The old ternary chain fell through
    // to the `month` branch and would have reported ₦100 — understated 4,380×.
    const mrr = await computeMrr(harness.db, isolated);
    expect(mrr).toBe(Math.round((10_000 * 525_600) / 12 / 10)); // 43,800,000 kobo = ₦438,000
  });

  /**
   * The bug this file was supposed to catch and didn't.
   *
   * `runCycle` used to take a `maxCatchUpPeriods` option, count the elapsed-but-unbilled
   * periods, and THROW `BILLING_CATCH_UP_LIMIT_EXCEEDED` *before billing anything* once
   * the count passed the cap. The worker caught that, logged "manual review required",
   * and returned WITHOUT advancing the period — so `next_billing_at` never moved and the
   * next sweep threw again, forever. The subscription was dead.
   *
   * The cap is cadence-blind: the default 36 is three YEARS of `month` but six HOURS of
   * `minute × 10`. Any downtime past that — a deploy, a Redis blip, a laptop shut for the
   * night — permanently killed the plan whose entire purpose is to renew while you watch.
   * Every other test in this file calls `runCycle` without the option, which disabled the
   * exact guard that broke. This one drives a subscription far past the cap on purpose.
   */
  it('a subscription far past the catch-up cap DRAINS and advances — it is never parked', async () => {
    const { subRef } = await startTenMinuteSub();
    const seeded = await loadSubscriptionRow(harness.db, ctx, subRef);

    // Backdate the anchor by 50 periods. Every boundary is `anchor + n·10min`, so the row
    // is now ~49 whole periods overdue — well past BILLING_MAX_CATCH_UP_PERIODS (36).
    const BEHIND = 50;
    const anchor = new Date((seeded.billingCycleAnchor as Date).getTime() - BEHIND * TEN_MINUTES_MS);
    await harness.db
      .update(subscriptionsTable)
      .set({ billingCycleAnchor: anchor })
      .where(eq(subscriptionsTable.id, seeded.id));

    const invoicesBefore = await invoiceCount(subRef);

    // The FIRST cycle is the whole point: it must report the backlog *and still bill*. The
    // old code raised here and the row never moved again.
    const first = await runCycle(harness.db, ctx, subRef);
    expect(first.outcome).toBe('paid');
    expect(first.periodsBehind).toBeGreaterThan(env.BILLING_MAX_CATCH_UP_PERIODS);
    const afterFirst = await loadSubscriptionRow(harness.db, ctx, subRef);
    expect(afterFirst.currentPeriodIndex).toBe(seeded.currentPeriodIndex + 1);

    // Now drain exactly as the billing worker does: keep cycling until nothing is behind.
    // Billing is in ADVANCE, so the loop must run down to `periodsBehind === 0` — stopping
    // at 1 leaves the in-flight period unbilled and the row due in the past.
    let behind = first.periodsBehind;
    let billed = 1;
    while (behind > 0 && billed < BEHIND + 5) {
      const result = await runCycle(harness.db, ctx, subRef);
      expect(result.outcome).toBe('paid');
      billed += 1;
      behind = result.periodsBehind;
    }

    // Caught up: the backlog is gone, every elapsed period was billed exactly once, and
    // the renewal cursor is in the FUTURE again (the definition of "not parked").
    expect(behind).toBe(0);
    const drained = await loadSubscriptionRow(harness.db, ctx, subRef);
    expect(drained.currentPeriodIndex).toBe(seeded.currentPeriodIndex + billed);
    expect(await invoiceCount(subRef)).toBe(invoicesBefore + billed);
    expect((drained.nextBillingAt as Date).getTime()).toBeGreaterThan(Date.now());
    expect(drained.status).toBe('active');
  });

  // ── the two lifecycle bugs fixed alongside ─────────────────────────────────
  it('cancel-at-period-end ENDS the subscription at the boundary instead of renewing forever', async () => {
    const { subRef } = await startTenMinuteSub();
    const before = await invoiceCount(subRef);

    const flagged = await as(request(harness.app).post(`/v1/subscriptions/${subRef}/cancel`))
      .set('Idempotency-Key', `cancel-${uniq()}`)
      .send({ mode: 'at_period_end' });
    expect(flagged.status).toBe(200);
    expect(flagged.body.data.cancelAtPeriodEnd).toBe(true);
    expect(flagged.body.data.status).toBe('active'); // still active — the coverage is paid for

    // The boundary arrives. Before the fix nothing read the flag, so this billed.
    const cycle = await runCycle(harness.db, ctx, subRef);
    expect(cycle.outcome).toBe('canceled');
    expect(cycle.invoice).toBeNull();

    const after = await loadSubscriptionRow(harness.db, ctx, subRef);
    expect(after.status).toBe('canceled');
    expect(after.endedAt).not.toBeNull();
    expect(after.cancellationReason).toBe('voluntary');
    expect(await invoiceCount(subRef)).toBe(before); // NOT billed
  });

  it('resume after a pause pushes the whole schedule out — the subscription is not instantly due', async () => {
    const { subRef } = await startTenMinuteSub();
    const before = await loadSubscriptionRow(harness.db, ctx, subRef);
    const dueBefore = (before.nextBillingAt as Date).getTime();

    await as(request(harness.app).post(`/v1/subscriptions/${subRef}/pause`))
      .set('Idempotency-Key', `pause-${uniq()}`)
      .send({});

    await new Promise((r) => setTimeout(r, 1_100));

    const resumed = await as(request(harness.app).post(`/v1/subscriptions/${subRef}/resume`))
      .set('Idempotency-Key', `resume-${uniq()}`)
      .send({});
    expect(resumed.status).toBe(200);
    expect(resumed.body.data.status).toBe('active');

    const after = await loadSubscriptionRow(harness.db, ctx, subRef);
    // The anchor moved by the paused duration, so every future boundary moved with it.
    // Before the fix only `current_period_end` was written — `next_billing_at` kept its
    // stale pre-pause value and runCycle recomputed the bounds from the untouched anchor.
    expect((after.billingCycleAnchor as Date).getTime()).toBeGreaterThan(
      (before.billingCycleAnchor as Date).getTime()
    );
    expect((after.nextBillingAt as Date).getTime()).toBeGreaterThan(dueBefore);
    expect((after.nextBillingAt as Date).getTime()).toBeGreaterThan(Date.now()); // not due yet
    expect((after.currentPeriodEnd as Date).getTime()).toBe((after.nextBillingAt as Date).getTime());
  });
});
