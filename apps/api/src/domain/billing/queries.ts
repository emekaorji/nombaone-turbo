import { and, asc, eq, gt, inArray, isNotNull, isNull, lt, lte, or, sql } from 'drizzle-orm';

import {
  paymentMethodsTable,
  subscriptionsTable,
  type PaymentMethodRow,
  type SubscriptionRow,
} from '@nombaone/core-db/schema';

import type { InfraDb } from '@nombaone/sara/context';

/**
 * The states the renewal sweep bills: `active` (roll to the next paid period) and
 * `trialing` (trial end → the first real charge). `past_due` is owned by 06
 * (dunning retries), `paused`/`incomplete`/`canceled` are not billed here.
 */
const BILLABLE_STATES = ['active', 'trialing'] as const;

export interface DueCursor {
  nextBillingAt: string;
  id: string;
}

/**
 * Keyset-batched due-selection (B7/B11). A **cross-tenant operational read** — the
 * sweep runs platform-wide, so this is the documented exception that does NOT pin a
 * single `ctx`; every downstream write still stamps each row's own (org, env).
 * Ordered by `(next_billing_at, id)` ascending (oldest-due first) over the
 * `subscriptions_due_idx` index — bounded memory, no OFFSET.
 */
export async function findDueSubscriptions(
  db: InfraDb,
  input: { now: Date; cursor?: DueCursor; limit: number }
): Promise<{ rows: SubscriptionRow[]; nextCursor: DueCursor | null }> {
  const due = and(
    inArray(subscriptionsTable.status, [...BILLABLE_STATES]),
    isNotNull(subscriptionsTable.nextBillingAt),
    lte(subscriptionsTable.nextBillingAt, input.now)
  );

  const keyset = input.cursor
    ? or(
        gt(subscriptionsTable.nextBillingAt, new Date(input.cursor.nextBillingAt)),
        and(
          eq(subscriptionsTable.nextBillingAt, new Date(input.cursor.nextBillingAt)),
          gt(subscriptionsTable.id, input.cursor.id)
        )
      )
    : undefined;

  const rows = await db
    .select()
    .from(subscriptionsTable)
    .where(keyset ? and(due, keyset) : due)
    .orderBy(asc(subscriptionsTable.nextBillingAt), asc(subscriptionsTable.id))
    .limit(input.limit + 1);

  const hasMore = rows.length > input.limit;
  const page = hasMore ? rows.slice(0, input.limit) : rows;
  const last = page.at(-1);
  const nextCursor =
    hasMore && last?.nextBillingAt
      ? { nextBillingAt: new Date(last.nextBillingAt).toISOString(), id: last.id }
      : null;

  return { rows: page, nextCursor };
}

// ── Lifecycle-sweep selections (cross-tenant operational reads, D.10) ─────────
// Each is a simple LIMIT batch — the transition/stamp excludes processed rows on
// the next tick, so a single batch per tick converges without a cursor.

/** `incomplete` subscriptions past their expiry window (A6). */
export async function selectExpiredIncomplete(
  db: InfraDb,
  input: { cutoff: Date; limit: number }
): Promise<SubscriptionRow[]> {
  return db
    .select()
    .from(subscriptionsTable)
    .where(and(eq(subscriptionsTable.status, 'incomplete'), lt(subscriptionsTable.createdAt, input.cutoff)))
    .limit(input.limit);
}

/** `trialing` subscriptions whose trial ends within the notice window, not yet notified. */
export async function selectTrialEndingSoon(
  db: InfraDb,
  input: { before: Date; limit: number }
): Promise<SubscriptionRow[]> {
  return db
    .select()
    .from(subscriptionsTable)
    .where(
      and(
        eq(subscriptionsTable.status, 'trialing'),
        isNotNull(subscriptionsTable.trialEnd),
        lte(subscriptionsTable.trialEnd, input.before),
        isNull(subscriptionsTable.trialWillEndNotifiedAt)
      )
    )
    .limit(input.limit);
}

/** Active card methods expiring at/before `targetYearMonth` (yyyy*100+mm), not yet notified. */
export async function selectExpiringPaymentMethods(
  db: InfraDb,
  input: { targetYearMonth: number; limit: number }
): Promise<PaymentMethodRow[]> {
  return db
    .select()
    .from(paymentMethodsTable)
    .where(
      and(
        eq(paymentMethodsTable.kind, 'card'),
        eq(paymentMethodsTable.status, 'active'),
        isNotNull(paymentMethodsTable.expYear),
        isNotNull(paymentMethodsTable.expMonth),
        isNull(paymentMethodsTable.expiringNotifiedAt),
        sql`(${paymentMethodsTable.expYear} * 100 + ${paymentMethodsTable.expMonth}) <= ${input.targetYearMonth}`
      )
    )
    .limit(input.limit);
}
