import { listApiKeys } from '@nombaone/sara/api-keys';
import { can, type OrgUserRole } from '@nombaone/sara/auth';
import { db } from '@nombaone/core-db/serverless';

import { getSession } from '@/lib/auth';

export type ApiKeyListItem = {
  reference: string;
  name: string;
  prefix: string;
  scopes: string[];
  lastUsed: string;
  created: string;
  revoked: boolean;
};

export type ApiKeysView = {
  items: ApiKeyListItem[];
  canManage: boolean;
  mode: 'sandbox' | 'live';
};

const fmtDate = (d: Date): string => new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' }).format(d);

function relTime(d: Date | null): string {
  if (!d) return '—';
  const s = Math.floor((Date.now() - d.getTime()) / 1000);
  if (s < 60) return 'just now';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const dd = Math.floor(h / 24);
  if (dd < 30) return `${dd}d ago`;
  return fmtDate(d);
}

/** API keys for the session's org + mode. Secrets are never returned — only display metadata. */
export async function listKeys(): Promise<ApiKeysView> {
  const session = await getSession();
  if (!session) return { items: [], canManage: false, mode: 'sandbox' };

  const rows = await listApiKeys(db, { organizationId: session.organizationId, mode: session.mode });
  const items: ApiKeyListItem[] = rows.map((k) => ({
    reference: k.reference,
    name: k.name,
    prefix: `${k.keyPrefix}••••`,
    scopes: k.scopes,
    lastUsed: relTime(k.lastUsedAt),
    created: fmtDate(k.createdAt),
    revoked: k.revokedAt != null,
  }));

  return {
    items,
    canManage: can(session.user.role as OrgUserRole, 'apiKeys:manage'),
    mode: session.mode,
  };
}
