import { webhookDeliveriesTable, webhookEndpointsTable } from '@nombaone/core-db';
import { db } from '@nombaone/core-db/serverless';
import { can, type OrgUserRole } from '@nombaone/sara/auth';
import { listWebhookEndpoints } from '@nombaone/sara/webhooks';
import { and, desc, eq } from 'drizzle-orm';

import { getSession } from '@/lib/auth';

export type EndpointItem = {
  reference: string;
  url: string;
  secretPrefix: string;
  events: string;
  active: boolean;
  created: string;
};

export type DeliveryStatus = 'pending' | 'succeeded' | 'failed' | 'dead';
export type DeliveryItem = {
  reference: string;
  endpointReference: string;
  eventType: string;
  status: DeliveryStatus;
  responseStatus: number | null;
  attempts: number;
  replayed: boolean;
  time: string;
};

export type WebhooksView = { endpoints: EndpointItem[]; canManage: boolean; mode: 'sandbox' | 'live' };

const fmtDate = (d: Date): string => new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' }).format(d);

function relTime(d: Date): string {
  const s = Math.max(0, Math.round((Date.now() - d.getTime()) / 1000));
  if (s < 60) return `${s}s`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.round(h / 24)}d`;
}

/** Recent webhook deliveries (org+mode), newest first, joined to their endpoint reference for replay. */
export async function listDeliveries(limit = 20): Promise<DeliveryItem[]> {
  const session = await getSession();
  if (!session) return [];
  const rows = await db
    .select({
      reference: webhookDeliveriesTable.reference,
      eventType: webhookDeliveriesTable.eventType,
      status: webhookDeliveriesTable.status,
      responseStatus: webhookDeliveriesTable.responseStatus,
      attempts: webhookDeliveriesTable.attempts,
      replayedAt: webhookDeliveriesTable.replayedAt,
      createdAt: webhookDeliveriesTable.createdAt,
      endpointReference: webhookEndpointsTable.reference,
    })
    .from(webhookDeliveriesTable)
    .innerJoin(webhookEndpointsTable, eq(webhookDeliveriesTable.endpointId, webhookEndpointsTable.id))
    .where(and(eq(webhookDeliveriesTable.organizationId, session.organizationId), eq(webhookEndpointsTable.mode, session.mode)))
    .orderBy(desc(webhookDeliveriesTable.createdAt))
    .limit(limit);
  return rows.map((r) => ({
    reference: r.reference,
    endpointReference: r.endpointReference,
    eventType: r.eventType,
    status: r.status as DeliveryStatus,
    responseStatus: r.responseStatus,
    attempts: r.attempts,
    replayed: r.replayedAt != null,
    time: relTime(r.createdAt),
  }));
}

export async function listEndpoints(): Promise<WebhooksView> {
  const session = await getSession();
  if (!session) return { endpoints: [], canManage: false, mode: 'sandbox' };

  const rows = await listWebhookEndpoints(db, { organizationId: session.organizationId, mode: session.mode });
  return {
    endpoints: rows.map((e) => ({
      reference: e.reference,
      url: e.url,
      secretPrefix: `${e.signingSecretPrefix}••••`,
      events: e.enabledEvents.includes('*') ? 'All events' : `${e.enabledEvents.length} events`,
      active: e.disabledAt == null,
      created: fmtDate(e.createdAt),
    })),
    canManage: can(session.user.role as OrgUserRole, 'webhooks:manage'),
    mode: session.mode,
  };
}
