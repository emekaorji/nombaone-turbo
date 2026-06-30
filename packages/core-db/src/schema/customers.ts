import { index, jsonb, pgTable, text, uniqueIndex, uuid } from 'drizzle-orm/pg-core';

import { createdAt, environmentEnum, idPk, referenceCol, updatedAt } from './shared';
import { organizationsTable } from './organizations';

/**
 * Customer = a tenant's end-payer (the subscriber), distinct from the org/tenant
 * itself. Tenant-scoped like every domain row (`organization_id` + `environment`).
 * Email uniqueness is per (org, environment), so two tenants — or the same
 * tenant's `test` vs `live` rings — can each hold the same address independently;
 * within one ring it is the natural key (a duplicate is a `409`, structurally
 * impossible via the unique index). Mutable contact fields carry an `updated_at`.
 */
export const customersTable = pgTable(
  'customers',
  {
    id: idPk(),
    reference: referenceCol(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizationsTable.id, { onDelete: 'cascade' }),
    environment: environmentEnum('environment').notNull(),
    email: text('email').notNull(),
    name: text('name').notNull(),
    phone: text('phone'),
    metadata: jsonb('metadata').$type<Record<string, unknown>>().notNull().default({}),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => ({
    referenceUnique: uniqueIndex('customers_reference_unique').on(table.reference),
    orgEnvEmailUnique: uniqueIndex('customers_org_env_email_unique').on(
      table.organizationId,
      table.environment,
      table.email
    ),
    keysetIdx: index('customers_keyset_idx').on(
      table.organizationId,
      table.environment,
      table.createdAt.desc(),
      table.id.desc()
    ),
  })
);

export type CustomerRow = typeof customersTable.$inferSelect;
export type CustomerInsert = typeof customersTable.$inferInsert;
