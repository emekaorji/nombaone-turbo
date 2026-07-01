import { sql } from 'drizzle-orm';
import {
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

import { invoicesTable } from './invoices';
import { organizationsTable } from './organizations';
import { createdAt, environmentEnum, idPk, referenceCol } from './shared';
import { subscriptionsTable } from './subscriptions';

/** The dunning machine's per-attempt status (C.3). Terminal: `succeeded`, `exhausted`. */
export const dunningAttemptStatusEnum = pgEnum('dunning_attempt_status', [
  'scheduled',
  'attempting',
  'succeeded',
  'rescheduled',
  'card_update_required',
  'exhausted',
]);

/** The branch a failure reason resolves to (the heart of D3/D4). */
export const dunningBranchEnum = pgEnum('dunning_branch', [
  'reschedule',
  'card_update_required',
  'short_path',
]);

/**
 * `dunning_attempts` — one APPEND-ONLY row per retry of a `past_due` invoice (D11).
 * It is the audit log AND the concurrency spine: `unique(invoice_id, attempt_number)`
 * makes a duplicate attempt for the same step structurally impossible (K4/J6), and
 * the partial `WHERE status = 'scheduled'` index on `(environment, next_attempt_at)`
 * is the dunning sweep's due-selection. Like `ledger_transactions`, there is **no
 * `updated_at`** — status/outcome transitions are recorded on the row in place but
 * the row is a fact, not a mutable entity; comms are guarded by `comms_sent_at`.
 */
export const dunningAttemptsTable = pgTable(
  'dunning_attempts',
  {
    id: idPk(),
    reference: referenceCol(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizationsTable.id, { onDelete: 'cascade' }),
    environment: environmentEnum('environment').notNull(),
    subscriptionId: uuid('subscription_id')
      .notNull()
      .references(() => subscriptionsTable.id, { onDelete: 'cascade' }),
    invoiceId: uuid('invoice_id')
      .notNull()
      .references(() => invoicesTable.id, { onDelete: 'cascade' }),
    attemptNumber: integer('attempt_number').notNull(),
    status: dunningAttemptStatusEnum('status').notNull(),
    branch: dunningBranchEnum('branch').notNull(),
    railKey: text('rail_key'),
    failureReason: text('failure_reason'), // the 02 taxonomy bucket
    gatewayMessage: text('gateway_message'), // raw provider text, for audit only
    outcome: text('outcome'),
    scheduledAt: timestamp('scheduled_at', { withTimezone: true }).notNull(),
    executedAt: timestamp('executed_at', { withTimezone: true }),
    nextAttemptAt: timestamp('next_attempt_at', { withTimezone: true }),
    commsSentAt: timestamp('comms_sent_at', { withTimezone: true }),
    commsEventType: text('comms_event_type'),
    createdAt: createdAt(),
  },
  (table) => ({
    referenceUnique: uniqueIndex('dunning_attempts_reference_unique').on(table.reference),
    invoiceAttemptUnique: uniqueIndex('dunning_attempts_invoice_attempt_unique').on(
      table.invoiceId,
      table.attemptNumber
    ),
    dueIdx: index('dunning_attempts_due_idx')
      .on(table.environment, table.nextAttemptAt)
      .where(sql`${table.status} = 'scheduled'`),
    keysetIdx: index('dunning_attempts_keyset_idx').on(
      table.organizationId,
      table.environment,
      table.createdAt.desc(),
      table.id.desc()
    ),
  })
);

export type DunningAttemptRow = typeof dunningAttemptsTable.$inferSelect;
export type DunningAttemptInsert = typeof dunningAttemptsTable.$inferInsert;
