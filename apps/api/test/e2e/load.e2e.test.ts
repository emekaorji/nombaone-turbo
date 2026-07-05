import { randomUUID } from 'node:crypto';
import { and, eq, sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  customersTable,
  invoicesTable,
  paymentMethodsTable,
  pricesTable,
  subscriptionItemsTable,
  subscriptionsTable,
} from '@nombaone/core-db/schema';
import { runCycle, runBillingSweep, type BillingSweepEnqueueJob } from '@/domain/billing';
import { createCustomer } from '@/domain/customers';
import { createPlan } from '@/domain/plans';
import { createPrice } from '@/domain/prices';
import { registerRail } from '@nombaone/sara/rails';
import { mintReference } from '@nombaone/sara/reference';

import { startHarness, type Harness } from '../helpers/harness';

import type { NombaClient } from '@nombaone/sara/nomba';

/**
 * Item 2 — the 10k billing load test. OPT-IN: gated on `RUN_LOAD_E2E=1` so normal CI
 * stays fast. It seeds N (default 10,000) `active` subscriptions due NOW by DIRECT
 * bulk insert (not via HTTP — that would run N inline charges), then runs the real
 * sweep → per-subscription `runCycle` charge path and asserts:
 *   • the keyset sweep finds every due sub (fans out N jobs, O(batches), fast);
 *   • every due sub is billed EXACTLY once (invoice count == N, the unique(sub,period)
 *     + claim guards mean no duplicate invoice/charge even under concurrency);
 *   • a second sweep finds nothing (all advanced past due — no double-bill);
 *   • the whole run completes within a wall-clock budget.
 *
 * Run: `RUN_LOAD_E2E=1 pnpm --filter @nombaone/api test -- load.e2e`
 * Tune: `LOAD_N=2000`, `LOAD_CONCURRENCY=25`.
 */
const RUN = process.env.RUN_LOAD_E2E === '1';
const N = Number(process.env.LOAD_N ?? 10_000);
const CONCURRENCY = Number(process.env.LOAD_CONCURRENCY ?? 20);
const UNIT = 500_000; // ₦5,000/mo

const fakeNomba: NombaClient = {
  getToken: async () => 'tok',
  async request<T = unknown>() {
    return { status: 200, ok: true, data: {} as T };
  },
  requeryTransaction: async () => ({ found: true, succeeded: true, amount: UNIT }),
};

/** Bounded-concurrency map over items. */
async function pool<T>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<void>
): Promise<void> {
  let idx = 0;
  const worker = async (): Promise<void> => {
    while (idx < items.length) {
      const i = idx++;
      await fn(items[i]!);
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker));
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

describe.skipIf(!RUN)('billing load — 10k due subscriptions (item 2)', () => {
  let harness: Harness;
  let ctx: { organizationId: string; mode: 'sandbox' };
  let customerId: string;
  let pmId: string;
  let priceUuid: string;

  beforeAll(async () => {
    harness = await startHarness();
    harness.setNombaClient(fakeNomba);
    registerRail({
      key: 'card',
      direction: 'pull',
      collect: async () => ({ status: 'succeeded' }),
    });
    const org = await harness.seedOrg('Load');
    ctx = { organizationId: org.organizationId, mode: 'sandbox' };

    const customer = await createCustomer(harness.db, ctx, {
      email: 'load@acme.test',
      name: 'Load',
    });
    const [c] = await harness.db
      .select({ id: customersTable.id })
      .from(customersTable)
      .where(
        and(
          eq(customersTable.organizationId, ctx.organizationId),
          eq(customersTable.reference, customer.id)
        )
      )
      .limit(1);
    customerId = c!.id;

    pmId = randomUUID();
    await harness.db.insert(paymentMethodsTable).values({
      id: pmId,
      reference: mintReference('PMT'),
      organizationId: ctx.organizationId,
      mode: 'sandbox',
      customerId,
      kind: 'card',
      status: 'active',
      tokenKey: 'tok',
      brand: 'visa',
      last4: '4242',
      isDefault: true,
    });

    const plan = await createPlan(harness.db, ctx, { name: 'Load Plan' });
    const price = await createPrice(harness.db, ctx, {
      planRef: plan.id,
      unitAmount: UNIT,
      interval: 'month',
      intervalCount: 1,
      usageType: 'licensed',
      billingScheme: 'per_unit',
      trialPeriodDays: 0,
    });
    // resolve the price UUID (createPrice returns the public reference).
    const [p] = await harness.db
      .select({ id: pricesTable.id })
      .from(pricesTable)
      .where(
        and(eq(pricesTable.organizationId, ctx.organizationId), eq(pricesTable.reference, price.id))
      )
      .limit(1);
    priceUuid = p!.id;
  });

  afterAll(async () => {
    await harness?.stop();
  });

  it(`seeds ${N} due subs, bills each exactly once, no duplicates, within budget`, async () => {
    // ── Seed: N active subs due now (+ one priced item each), bulk-inserted ──────
    const now = Date.now();
    const anchor = new Date(now - 5 * 86_400_000); // period 0 started 5d ago…
    const periodEnd = new Date(now + 25 * 86_400_000); // …and ends in the future (no catch-up)
    const subs: (typeof subscriptionsTable.$inferInsert)[] = [];
    const items: (typeof subscriptionItemsTable.$inferInsert)[] = [];
    for (let i = 0; i < N; i++) {
      const id = randomUUID();
      subs.push({
        id,
        reference: mintReference('SUB'),
        organizationId: ctx.organizationId,
        mode: 'sandbox',
        customerId,
        priceId: priceUuid,
        defaultPaymentMethodId: pmId,
        status: 'active',
        collectionMethod: 'charge_automatically',
        currentPeriodIndex: 0,
        currentPeriodStart: anchor,
        currentPeriodEnd: periodEnd,
        billingCycleAnchor: anchor,
        nextBillingAt: anchor,
      });
      items.push({
        id: randomUUID(),
        reference: mintReference('SBI'),
        organizationId: ctx.organizationId,
        mode: 'sandbox',
        subscriptionId: id,
        priceId: priceUuid,
        quantity: 1,
        unitAmount: UNIT,
      });
    }
    const seedStart = Date.now();
    for (const batch of chunk(subs, 1000))
      await harness.db.insert(subscriptionsTable).values(batch);
    for (const batch of chunk(items, 1000))
      await harness.db.insert(subscriptionItemsTable).values(batch);

    console.log(`[load] seeded ${N} subs in ${Date.now() - seedStart}ms`);

    // ── Sweep: the keyset scan must fan out one job per due sub (fast, O(batches)) ─
    const jobs: BillingSweepEnqueueJob[] = [];
    const sweepStart = Date.now();
    await runBillingSweep({
      db: harness.db,
      now: new Date(),
      batchSize: 1000,
      enqueue: async (job) => {
        jobs.push(job);
      },
    });

    console.log(`[load] sweep enqueued ${jobs.length} in ${Date.now() - sweepStart}ms`);
    expect(jobs.length).toBe(N);

    // ── Charge: drive runCycle per job (bounded concurrency) — the real money path ─
    const billStart = Date.now();
    let paid = 0;
    await pool(jobs, CONCURRENCY, async (job) => {
      const res = await runCycle(
        harness.db,
        { organizationId: job.organizationId, mode: 'sandbox' },
        job.subscriptionReference,
        { maxCatchUpPeriods: 36 }
      );
      if (res.outcome === 'paid') paid += 1;
    });
    const elapsed = Date.now() - billStart;

    console.log(`[load] billed ${paid}/${N} in ${elapsed}ms (${(elapsed / N).toFixed(2)}ms/sub)`);

    // ── Assert: exactly one paid invoice per sub, no duplicates ──────────────────
    expect(paid).toBe(N);
    const [invRow] = await harness.db
      .select({ invoices: sql<number>`count(*)::int` })
      .from(invoicesTable)
      .where(
        and(
          eq(invoicesTable.organizationId, ctx.organizationId),
          eq(invoicesTable.mode, 'sandbox')
        )
      );
    expect(invRow!.invoices).toBe(N); // one invoice per sub (unique(sub,period) makes dupes impossible)
    const [paidRow] = await harness.db
      .select({ paidInvoices: sql<number>`count(*)::int` })
      .from(invoicesTable)
      .where(
        and(
          eq(invoicesTable.organizationId, ctx.organizationId),
          eq(invoicesTable.mode, 'sandbox'),
          sql`${invoicesTable.paidAt} is not null`
        )
      );
    expect(paidRow!.paidInvoices).toBe(N);

    // ── Idempotency: a second sweep finds nothing (every sub advanced past due) ───
    const jobs2: BillingSweepEnqueueJob[] = [];
    await runBillingSweep({
      db: harness.db,
      now: new Date(),
      batchSize: 1000,
      enqueue: async (job) => {
        jobs2.push(job);
      },
    });
    expect(jobs2.length).toBe(0);

    // ── Budget: fail on pathological (e.g. O(N²)) slowdown; generous to avoid flake ─
    expect(elapsed).toBeLessThan(N * 50); // < 50ms/sub average
  }, 600_000);
});
