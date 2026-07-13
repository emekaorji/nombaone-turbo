import { orgNombaAccountsTable } from '@nombaone/core-db/schema';

import { mintReference } from '../reference';

import type { DomainContext, InfraTxDb } from '../context';

/**
 * Idempotently map a tenant (org) to its Nomba account — one row per
 * (org, mode, kind). UPSERT semantics: a re-connect (a new provisioning attempt,
 * a manual paste correcting a wrong id) REFRESHES the identifiers and status
 * rather than being silently swallowed. The original version wrote neither
 * `subAccountId` nor `status` and DO-NOTHING'd on conflict — which is one reason
 * no merchant could ever become provisioned.
 */
export async function ensureOrgNombaAccount(
  txDb: InfraTxDb,
  ctx: DomainContext,
  input: {
    nombaAccountId: string;
    accountRef: string;
    kind: 'parent' | 'subaccount';
    subAccountId?: string | null;
    status?: 'pending' | 'active' | 'suspended';
  }
): Promise<void> {
  await txDb
    .insert(orgNombaAccountsTable)
    .values({
      reference: mintReference('NMA'),
      organizationId: ctx.organizationId,
      mode: ctx.mode,
      nombaAccountId: input.nombaAccountId,
      accountRef: input.accountRef,
      kind: input.kind,
      subAccountId: input.subAccountId ?? null,
      status: input.status ?? 'pending',
    })
    .onConflictDoUpdate({
      target: [
        orgNombaAccountsTable.organizationId,
        orgNombaAccountsTable.mode,
        orgNombaAccountsTable.kind,
      ],
      set: {
        nombaAccountId: input.nombaAccountId,
        accountRef: input.accountRef,
        subAccountId: input.subAccountId ?? null,
        status: input.status ?? 'pending',
      },
    });
}
