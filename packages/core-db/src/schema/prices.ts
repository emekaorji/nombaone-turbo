import { sql } from 'drizzle-orm';
import {
  bigint,
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

import { createdAt, modeEnum, idPk, referenceCol } from './shared';
import { organizationsTable } from './organizations';
import { plansTable } from './plans';

/**
 * Price = an IMMUTABLE, versioned way to charge for a plan. "Versioning" is not a
 * mutable counter — each price IS a version: a distinct row with its own
 * reference. "Raising the price" = a NEW row (`active=true`) + deactivating the
 * old one; the old row's money fields (`unit_amount`/`interval`) are NEVER
 * rewritten. That immutability is what makes the 03 invariant — a subscription
 * pins a `price_id`, so a new price can't retroactively change what a subscriber
 * pays — hold by construction. APPEND-ONLY (no `updated_at`); the only permitted
 * mutation is the `active` flip.
 *
 * `plan_id` FK is `onDelete: restrict` — you cannot drop a plan out from under
 * its prices (the structural anti-orphan rule, O1). The interval/usage/scheme
 * columns are persisted here and READ later: 04's scheduler reads
 * `interval`/`interval_count`; 05's tiered path builds on `billing_scheme`.
 */
export const priceIntervalEnum = pgEnum('price_interval', ['day', 'week', 'month', 'year']);
export const priceUsageTypeEnum = pgEnum('price_usage_type', ['licensed', 'metered']);
export const priceBillingSchemeEnum = pgEnum('price_billing_scheme', ['per_unit', 'tiered']);

export const pricesTable = pgTable(
  'prices',
  {
    id: idPk(),
    reference: referenceCol(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizationsTable.id, { onDelete: 'cascade' }),
    mode: modeEnum('mode').notNull(),
    planId: uuid('plan_id')
      .notNull()
      .references(() => plansTable.id, { onDelete: 'restrict' }),
    unitAmount: bigint('unit_amount', { mode: 'number' }).notNull(),
    currency: text('currency').notNull().default('NGN'),
    interval: priceIntervalEnum('interval').notNull(),
    intervalCount: integer('interval_count').notNull().default(1),
    usageType: priceUsageTypeEnum('usage_type').notNull().default('licensed'),
    billingScheme: priceBillingSchemeEnum('billing_scheme').notNull().default('per_unit'),
    trialPeriodDays: integer('trial_period_days').notNull().default(0),
    active: boolean('active').notNull().default(true),
    metadata: jsonb('metadata').$type<Record<string, unknown>>().notNull().default({}),
    createdAt: createdAt(),
  },
  (table) => ({
    referenceUnique: uniqueIndex('prices_reference_unique').on(table.reference),
    planActiveIdx: index('prices_plan_active_idx').on(table.planId, table.active),
    keysetIdx: index('prices_keyset_idx').on(
      table.organizationId,
      table.mode,
      table.createdAt.desc(),
      table.id.desc()
    ),
    unitAmountPositive: check('prices_unit_amount_positive', sql`${table.unitAmount} > 0`),
    intervalCountPositive: check('prices_interval_count_positive', sql`${table.intervalCount} > 0`),
    trialDaysNonNeg: check('prices_trial_days_nonneg', sql`${table.trialPeriodDays} >= 0`),
    currencyNgn: check('prices_currency_ngn', sql`${table.currency} = 'NGN'`),
  })
);

export type PriceRow = typeof pricesTable.$inferSelect;
export type PriceInsert = typeof pricesTable.$inferInsert;
