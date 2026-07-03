import { sql } from 'drizzle-orm';
import {
  bigint,
  check,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

import { organizationsTable } from './organizations';
import { createdAt, environmentEnum, idPk, referenceCol, updatedAt } from './shared';

export const couponDurationEnum = pgEnum('coupon_duration', ['once', 'repeating', 'forever']);

/**
 * A reusable discount DEFINITION. Exactly one of `amount_off` / `percent_off` is
 * set (CHECK). `duration` drives how many invoices a derived discount carries:
 * `once` (next invoice), `repeating` (`duration_in_cycles`), `forever`.
 * Over-redemption is made structurally impossible by the atomic
 * `UPDATE … WHERE times_redeemed < max_redemptions` at redeem time (K2).
 */
export const couponsTable = pgTable(
  'coupons',
  {
    id: idPk(),
    reference: referenceCol(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizationsTable.id, { onDelete: 'cascade' }),
    environment: environmentEnum('environment').notNull(),
    code: text('code').notNull(),
    duration: couponDurationEnum('duration').notNull(),
    amountOff: bigint('amount_off', { mode: 'number' }), // kobo
    percentOff: smallint('percent_off'),
    durationInCycles: smallint('duration_in_cycles'),
    redeemBy: timestamp('redeem_by', { withTimezone: true }),
    maxRedemptions: integer('max_redemptions'),
    timesRedeemed: integer('times_redeemed').notNull().default(0),
    metadata: jsonb('metadata').$type<Record<string, unknown>>().notNull().default({}),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => ({
    referenceUnique: uniqueIndex('coupons_reference_unique').on(table.reference),
    codeUnique: uniqueIndex('coupons_code_unique').on(
      table.organizationId,
      table.environment,
      table.code
    ),
    keysetIdx: index('coupons_keyset_idx').on(
      table.organizationId,
      table.environment,
      table.createdAt.desc(),
      table.id.desc()
    ),
    exactlyOneKind: check(
      'coupons_exactly_one_kind',
      sql`(${table.amountOff} is not null)::int + (${table.percentOff} is not null)::int = 1`
    ),
    percentRange: check(
      'coupons_percent_range',
      sql`${table.percentOff} is null or (${table.percentOff} between 1 and 100)`
    ),
  })
);

export type CouponRow = typeof couponsTable.$inferSelect;
export type CouponInsert = typeof couponsTable.$inferInsert;
