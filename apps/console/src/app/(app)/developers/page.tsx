import type { Metadata } from 'next';

import { listApiKeys } from '@nombaone/sara/api-keys';
import type { ApiKeyScope } from '@nombaone/core-contracts/types';

import { PageHeader } from '@/components/common/PageHeader';
import { db } from '@/lib/db';
import { getOrgDomainCtx, requireUser } from '@/lib/auth-context';
import { can } from '@/lib/rbac';
import { ApiKeysClient, type ApiKeyView } from '@/components/developers/ApiKeysClient';

export const metadata: Metadata = { title: 'API keys · Nombaone Console' };

/**
 * Developers → API keys. RSC reads the tenant's keys for the active ring via
 * `listApiKeys` (session-pinned scope), serialises each row to the wire-safe
 * view, and hands it to the client island. The `canManage` flag (from the RBAC
 * matrix) decides whether the create/revoke affordances render — the server
 * action re-checks the same capability regardless.
 */
export default async function DevelopersPage() {
  const [ctx, user] = await Promise.all([getOrgDomainCtx(), requireUser()]);
  const rows = await listApiKeys(db, ctx);

  const keys: ApiKeyView[] = rows.map((row) => ({
    reference: row.reference,
    name: row.name,
    keyPrefix: row.keyPrefix,
    scopes: (row.scopes ?? []) as ApiKeyScope[],
    mode: row.mode,
    lastUsedAt: row.lastUsedAt ? row.lastUsedAt.toISOString() : null,
    revokedAt: row.revokedAt ? row.revokedAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="API keys"
        description={`Secret keys for the ${ctx.mode} environment. Each key is shown once at creation.`}
      />
      <ApiKeysClient keys={keys} canManage={can(user.role, 'apiKeys:manage')} />
    </div>
  );
}
