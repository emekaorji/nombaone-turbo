import { index, jsonb, pgEnum, pgTable, text, uniqueIndex, uuid } from 'drizzle-orm/pg-core';

import { createdAt, modeEnum, idPk, referenceCol, updatedAt } from './shared';
import { organizationsTable } from './organizations';

/**
 * Plan = the durable product/offering a tenant names and a subscriber "is on".
 * A plan has many `prices` over its lifetime (versioning lives there, not here).
 * `status` is an explicit catalog lifecycle (`active | archived`), event-emitting
 * on every change — a plan is RETIRED by archiving, never hard-deleted (O1).
 */
export const planStatusEnum = pgEnum('plan_status', ['active', 'archived']);

export const plansTable = pgTable(
  'plans',
  {
    id: idPk(),
    reference: referenceCol(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizationsTable.id, { onDelete: 'cascade' }),
    mode: modeEnum('mode').notNull(),
    name: text('name').notNull(),
    description: text('description'),
    status: planStatusEnum('status').notNull().default('active'),
    metadata: jsonb('metadata').$type<Record<string, unknown>>().notNull().default({}),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => ({
    referenceUnique: uniqueIndex('plans_reference_unique').on(table.reference),
    orgEnvNameUnique: uniqueIndex('plans_org_env_name_unique').on(
      table.organizationId,
      table.mode,
      table.name
    ),
    keysetIdx: index('plans_keyset_idx').on(
      table.organizationId,
      table.mode,
      table.createdAt.desc(),
      table.id.desc()
    ),
  })
);

export type PlanRow = typeof plansTable.$inferSelect;
export type PlanInsert = typeof plansTable.$inferInsert;
