import { index, pgTable, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';

import { createdAt, idPk, referenceCol } from './shared';

/**
 * Organization = TENANT: the unit of isolation and settlement. Every
 * tenant-scoped table carries `organization_id`; isolation is a property of the
 * data model, not a check bolted on. (Each tenant maps to its own provider
 * sub-account for fund attribution — that mapping is a seam you add at settlement.)
 */
export const organizationsTable = pgTable(
  'organizations',
  {
    id: idPk(),
    reference: referenceCol(),
    name: text('name').notNull(),
    // Getting-started onboarding UI state (console). `started` when the merchant
    // commits to the guided flow (so the companion rail follows them into the app);
    // `dismissed` when they skip or finish it. Both null = not yet engaged.
    onboardingStartedAt: timestamp('onboarding_started_at', { withTimezone: true }),
    onboardingDismissedAt: timestamp('onboarding_dismissed_at', { withTimezone: true }),
    createdAt: createdAt(),
  },
  (table) => ({
    referenceUnique: uniqueIndex('organizations_reference_unique').on(table.reference),
    createdIdx: index('organizations_created_idx').on(table.createdAt),
  })
);

export type OrganizationRow = typeof organizationsTable.$inferSelect;
export type OrganizationInsert = typeof organizationsTable.$inferInsert;
