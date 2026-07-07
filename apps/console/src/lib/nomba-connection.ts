import { orgNombaAccountsTable } from '@nombaone/core-db';
import { db } from '@nombaone/core-db/serverless';
import { and, eq } from 'drizzle-orm';

import { getSession } from '@/lib/auth';

export type NombaConnection = {
  status: 'not_connected' | 'pending' | 'active' | 'suspended';
  parentAccountId: string | null;
  subAccountId: string | null;
};

const NOT_CONNECTED: NombaConnection = { status: 'not_connected', parentAccountId: null, subAccountId: null };

export async function getNombaConnection(): Promise<NombaConnection> {
  const session = await getSession();
  if (!session) return NOT_CONNECTED;

  const rows = await db
    .select()
    .from(orgNombaAccountsTable)
    .where(
      and(eq(orgNombaAccountsTable.organizationId, session.organizationId), eq(orgNombaAccountsTable.mode, session.mode)),
    );
  if (rows.length === 0) return NOT_CONNECTED;

  const parent = rows.find((r) => r.kind === 'parent') ?? rows[0];
  const sub = rows.find((r) => r.kind === 'subaccount');
  return {
    status: parent.status,
    parentAccountId: parent.accountRef ?? parent.nombaAccountId,
    subAccountId: sub?.subAccountId ?? sub?.nombaAccountId ?? null,
  };
}
