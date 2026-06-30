import { bigint, index, integer, pgEnum, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';

import { createdAt, environmentEnum, idPk, referenceCol } from './shared';
import { invoicesTable } from './invoices';
import { organizationsTable } from './organizations';
import { subscriptionItemsTable } from './subscription-items';

/**
 * A typed line on an invoice. `amount` is **signed** kobo — proration credits,
 * discounts, and credit applications are negative; this is the one place a
 * negative kobo is allowed (the invariant Σ lines === total is checked in the
 * domain, J4). Only `subscription` lines are produced in 03; `proration`/
 * `discount`/`credit` are 05.
 */
export const invoiceLineKindEnum = pgEnum('invoice_line_kind', [
  'subscription',
  'proration',
  'discount',
  'credit',
  'adjustment',
]);

export const invoiceLineItemsTable = pgTable(
  'invoice_line_items',
  {
    id: idPk(),
    reference: referenceCol(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizationsTable.id, { onDelete: 'cascade' }),
    environment: environmentEnum('environment').notNull(),
    invoiceId: uuid('invoice_id')
      .notNull()
      .references(() => invoicesTable.id, { onDelete: 'cascade' }),
    subscriptionItemId: uuid('subscription_item_id').references(() => subscriptionItemsTable.id, {
      onDelete: 'set null',
    }),
    kind: invoiceLineKindEnum('kind').notNull(),
    description: text('description').notNull(),
    amount: bigint('amount', { mode: 'number' }).notNull(), // signed kobo
    quantity: integer('quantity').notNull().default(1),
    periodStart: timestamp('period_start', { withTimezone: true }),
    periodEnd: timestamp('period_end', { withTimezone: true }),
    createdAt: createdAt(),
  },
  (table) => ({
    referenceUnique: uniqueIndex('invoice_line_items_reference_unique').on(table.reference),
    invoiceIdx: index('invoice_line_items_invoice_idx').on(
      table.organizationId,
      table.environment,
      table.invoiceId
    ),
  })
);

export type InvoiceLineItemRow = typeof invoiceLineItemsTable.$inferSelect;
export type InvoiceLineItemInsert = typeof invoiceLineItemsTable.$inferInsert;
