import type { Metadata } from 'next';

import { listWebhookEndpoints } from '@nombaone/sara/webhooks';

import { PageHeader } from '@/components/common/PageHeader';
import { db } from '@/lib/db';
import { getOrgDomainCtx, requireUser } from '@/lib/auth-context';
import { can } from '@/lib/rbac';
import { WebhooksClient, type WebhookView } from '@/components/developers/WebhooksClient';

export const metadata: Metadata = { title: 'Webhooks · Nombaone Console' };

/**
 * Developers → Webhooks. RSC reads the tenant's endpoints for the active ring
 * via `listWebhookEndpoints` (session-pinned scope) and hands the wire-safe view
 * to the client island. Create/disable affordances are gated by the RBAC matrix;
 * the actions re-check the capability server-side.
 */
export default async function WebhooksPage() {
  const [ctx, user] = await Promise.all([getOrgDomainCtx(), requireUser()]);
  const rows = await listWebhookEndpoints(db, ctx);

  const endpoints: WebhookView[] = rows.map((row) => ({
    reference: row.reference,
    url: row.url,
    enabledEvents: row.enabledEvents ?? [],
    signingSecretPrefix: row.signingSecretPrefix,
    disabledAt: row.disabledAt ? row.disabledAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Webhooks"
        description={`Endpoints receiving HMAC-signed event deliveries for the ${ctx.mode} environment.`}
      />
      <WebhooksClient endpoints={endpoints} canManage={can(user.role, 'webhooks:manage')} />
    </div>
  );
}
