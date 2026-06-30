import { orgNombaAccountsTable } from '@nombaone/core-db/schema';

import { mintReference } from '../reference';

import type { DomainContext, InfraTxDb } from '../context';

/**
 * Idempotently map a tenant (org) to its Nomba account. Phase 02 records the
 * mapping only (parent / sub-account); Phase 08 extends the row with the
 * settlement split columns. One row per (org, environment, kind).
 */
export async function ensureOrgNombaAccount(
  txDb: InfraTxDb,
  ctx: DomainContext,
  input: { nombaAccountId: string; accountRef: string; kind: 'parent' | 'subaccount' }
): Promise<void> {
  await txDb
    .insert(orgNombaAccountsTable)
    .values({
      reference: mintReference('NMA'),
      organizationId: ctx.organizationId,
      environment: ctx.environment,
      nombaAccountId: input.nombaAccountId,
      accountRef: input.accountRef,
      kind: input.kind,
    })
    .onConflictDoNothing({
      target: [
        orgNombaAccountsTable.organizationId,
        orgNombaAccountsTable.environment,
        orgNombaAccountsTable.kind,
      ],
    });
}
