import { sql } from 'drizzle-orm';
import {
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

import { createdAt, environmentEnum, idPk, referenceCol, updatedAt } from './shared';
import { customersTable } from './customers';
import { organizationsTable } from './organizations';
import { paymentMethodsTable } from './payment-methods';
import { pricesTable } from './prices';

/**
 * Subscription = a customer's ongoing relationship to a price. `status` is a REAL
 * column (it is FSM event-state, not drift-prone money-state) but is kept
 * consistent with the ledger/latest-invoice; the single writer is the domain
 * `transition()` (no op writes it directly). `cancellation_reason` distinguishes
 * voluntary (user) from involuntary (dunning-exhausted) churn. `version` is the
 * optimistic-concurrency guard against a portal/scheduler race. `billing_cycle_anchor`
 * + `current_period_index` are the anchor the 04 scheduler reads (it adds
 * `next_billing_at` there).
 */
export const subscriptionStatusEnum = pgEnum('subscription_status', [
  'incomplete',
  'incomplete_expired',
  'trialing',
  'active',
  'past_due',
  'paused',
  'canceled',
]);
export const collectionMethodEnum = pgEnum('collection_method', [
  'charge_automatically',
  'send_invoice',
]);
export const cancellationReasonEnum = pgEnum('cancellation_reason', ['voluntary', 'involuntary']);

export const subscriptionsTable = pgTable(
  'subscriptions',
  {
    id: idPk(),
    reference: referenceCol(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizationsTable.id, { onDelete: 'cascade' }),
    environment: environmentEnum('environment').notNull(),
    customerId: uuid('customer_id')
      .notNull()
      .references(() => customersTable.id, { onDelete: 'restrict' }),
    priceId: uuid('price_id')
      .notNull()
      .references(() => pricesTable.id, { onDelete: 'restrict' }),
    defaultPaymentMethodId: uuid('default_payment_method_id').references(
      () => paymentMethodsTable.id,
      { onDelete: 'set null' }
    ),
    status: subscriptionStatusEnum('status').notNull(),
    collectionMethod: collectionMethodEnum('collection_method').notNull().default('charge_automatically'),
    currentPeriodIndex: integer('current_period_index').notNull().default(0),
    currentPeriodStart: timestamp('current_period_start', { withTimezone: true }),
    currentPeriodEnd: timestamp('current_period_end', { withTimezone: true }),
    billingCycleAnchor: timestamp('billing_cycle_anchor', { withTimezone: true }),
    // 04 scheduler: the due-selection cursor (mirrors current_period_end) + the
    // lifecycle sweep's trial-notice idempotency stamp.
    nextBillingAt: timestamp('next_billing_at', { withTimezone: true }),
    trialWillEndNotifiedAt: timestamp('trial_will_end_notified_at', { withTimezone: true }),
    trialStart: timestamp('trial_start', { withTimezone: true }),
    trialEnd: timestamp('trial_end', { withTimezone: true }),
    cancelAtPeriodEnd: boolean('cancel_at_period_end').notNull().default(false),
    canceledAt: timestamp('canceled_at', { withTimezone: true }),
    endedAt: timestamp('ended_at', { withTimezone: true }),
    pausedAt: timestamp('paused_at', { withTimezone: true }),
    pauseMaxDays: integer('pause_max_days'),
    cancellationReason: cancellationReasonEnum('cancellation_reason'),
    version: integer('version').notNull().default(0),
    metadata: jsonb('metadata').$type<Record<string, unknown>>().notNull().default({}),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => ({
    referenceUnique: uniqueIndex('subscriptions_reference_unique').on(table.reference),
    keysetIdx: index('subscriptions_keyset_idx').on(
      table.organizationId,
      table.environment,
      table.createdAt.desc(),
      table.id.desc()
    ),
    customerIdx: index('subscriptions_customer_idx').on(
      table.organizationId,
      table.environment,
      table.customerId
    ),
    statusIdx: index('subscriptions_status_idx').on(
      table.organizationId,
      table.environment,
      table.status
    ),
    // The 04 due-selection cursor index (B7/B11): find subscriptions whose
    // next_billing_at ≤ now without a seq scan.
    dueIdx: index('subscriptions_due_idx').on(
      table.organizationId,
      table.environment,
      table.nextBillingAt
    ),
    // The CROSS-TENANT sweep due query (findDueSubscriptions) does not pin org/env,
    // so it cannot use dueIdx. This partial index on (next_billing_at, id) matches
    // it exactly — keyset range-scan + order with no seq scan at scale (B11).
    dueSweepIdx: index('subscriptions_due_sweep_idx')
      .on(table.nextBillingAt, table.id)
      .where(sql`${table.status} in ('active', 'trialing') and ${table.nextBillingAt} is not null`),
  })
);

export type SubscriptionRow = typeof subscriptionsTable.$inferSelect;
export type SubscriptionInsert = typeof subscriptionsTable.$inferInsert;
