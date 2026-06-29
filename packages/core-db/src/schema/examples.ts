import { sql } from 'drizzle-orm';
import { bigint, check, index, integer, pgEnum, pgTable, uniqueIndex, uuid } from 'drizzle-orm/pg-core';

import { createdAt, environmentEnum, idPk, referenceCol } from './shared';
import { organizationsTable } from './organizations';

/**
 * ───────────────────────────────────────────────────────────────────────────
 * EXAMPLE TABLE — part of the deletable example slice (see DELETE-ME-EXAMPLE.md).
 * It exists to demonstrate EVERY db convention concretely; delete it (and the
 * rest of the slice) when you model your real domain.
 *
 * Conventions shown here:
 *  • `organization_id` on every tenant-scoped row (isolation is data-model deep)
 *  • first-class `environment` column (test|live)
 *  • a `kind` enum discriminator + bare typed columns + a CHECK constraint
 *    (instead of an opaque jsonb payload — keeps analytics queryable)
 *  • a public `reference` with a UNIQUE index, separate from the UUID PK
 *  • a composite KEYSET index leading with (org, env, created_at desc, id desc)
 *    for cursor pagination
 *  • append-only (no updated_at) — corrections are new rows / ledger entries
 *  • a MATERIALIZED counter (`attempt_count`) updated atomically
 *  • NO `status` column: status is DERIVED from the ledger, never a field that
 *    can drift (the domain computes it in the serializer)
 * ───────────────────────────────────────────────────────────────────────────
 */
export const exampleKindEnum = pgEnum('example_kind', ['standard', 'priority']);

export const examplesTable = pgTable(
  'examples',
  {
    id: idPk(),
    reference: referenceCol(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizationsTable.id, { onDelete: 'cascade' }),
    environment: environmentEnum('environment').notNull(),
    kind: exampleKindEnum('kind').notNull().default('standard'),
    amount: bigint('amount', { mode: 'number' }).notNull(),
    attemptCount: integer('attempt_count').notNull().default(0),
    createdAt: createdAt(),
  },
  (table) => ({
    referenceUnique: uniqueIndex('examples_reference_unique').on(table.reference),
    keysetIdx: index('examples_keyset_idx').on(
      table.organizationId,
      table.environment,
      table.createdAt.desc(),
      table.id.desc()
    ),
    amountPositive: check('examples_amount_positive', sql`${table.amount} > 0`),
  })
);

export type ExampleRow = typeof examplesTable.$inferSelect;
export type ExampleInsert = typeof examplesTable.$inferInsert;
