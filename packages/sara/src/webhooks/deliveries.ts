import { and, desc, eq, lt, lte, or, isNull } from 'drizzle-orm';

import {
  domainEventsTable,
  webhookDeliveriesTable,
  webhookEndpointsTable,
  type WebhookDeliveryRow,
} from '@nombaone/core-db/schema';
import { AppError, NOMBAONE_ERROR_CODES } from '@nombaone/errors';

import { buildPage, clampLimit, decodeCursor } from '../pagination';
import { serializeWebhookDelivery } from './serialize';

import type { DomainContext, InfraDb } from '../context';
import type { Page } from '../pagination';
import type {
  WebhookDeliveryResponseData,
  WebhookDeliveryStatus,
} from '@nombaone/core-contracts/types';

/** Auto-replay stops after this many re-arms so a permanently-dead endpoint is not retried forever. */
const AUTO_REPLAY_CEILING = 3;

export interface ListWebhookDeliveriesOptions {
  limit?: number;
  cursor?: string;
  status?: WebhookDeliveryStatus;
  eventType?: string;
  endpoint?: string; // endpoint reference
}

interface JoinedRow {
  delivery: WebhookDeliveryRow;
  endpointRef: string;
  eventRef: string;
}

/**
 * Cursor list of a tenant's webhook deliveries (newest first). Tenant + env scope
 * is enforced by the inner join to the endpoint (deliveries carry `organization_id`
 * but not `environment`). `status = 'dead'` is the dead-letter view (G6).
 */
export async function listWebhookDeliveries(
  db: InfraDb,
  ctx: DomainContext,
  opts: ListWebhookDeliveriesOptions = {}
): Promise<Page<WebhookDeliveryResponseData>> {
  const limit = clampLimit(opts.limit);
  const cursor = decodeCursor(opts.cursor);
  const scope = and(
    eq(webhookDeliveriesTable.organizationId, ctx.organizationId),
    eq(webhookEndpointsTable.mode, ctx.mode),
    opts.status ? eq(webhookDeliveriesTable.status, opts.status) : undefined,
    opts.eventType ? eq(webhookDeliveriesTable.eventType, opts.eventType) : undefined,
    opts.endpoint ? eq(webhookEndpointsTable.reference, opts.endpoint) : undefined
  );
  const keyset = cursor
    ? or(
        lt(webhookDeliveriesTable.createdAt, new Date(cursor.createdAt)),
        and(
          eq(webhookDeliveriesTable.createdAt, new Date(cursor.createdAt)),
          lt(webhookDeliveriesTable.id, cursor.id)
        )
      )
    : undefined;

  const rows = await db
    .select({
      delivery: webhookDeliveriesTable,
      endpointRef: webhookEndpointsTable.reference,
      eventRef: domainEventsTable.reference,
    })
    .from(webhookDeliveriesTable)
    .innerJoin(webhookEndpointsTable, eq(webhookEndpointsTable.id, webhookDeliveriesTable.endpointId))
    .innerJoin(domainEventsTable, eq(domainEventsTable.id, webhookDeliveriesTable.eventId))
    .where(keyset ? and(scope, keyset) : scope)
    .orderBy(desc(webhookDeliveriesTable.createdAt), desc(webhookDeliveriesTable.id))
    .limit(limit + 1);

  const page = buildPage(rows, limit, (r) => ({
    createdAt: r.delivery.createdAt.toISOString(),
    id: r.delivery.id,
  }));
  return {
    ...page,
    data: page.data.map((r) => serializeWebhookDelivery(r.delivery, r.endpointRef, r.eventRef)),
  };
}

async function loadJoinedDelivery(
  db: InfraDb,
  ctx: DomainContext,
  reference: string
): Promise<JoinedRow> {
  const [row] = await db
    .select({
      delivery: webhookDeliveriesTable,
      endpointRef: webhookEndpointsTable.reference,
      eventRef: domainEventsTable.reference,
    })
    .from(webhookDeliveriesTable)
    .innerJoin(webhookEndpointsTable, eq(webhookEndpointsTable.id, webhookDeliveriesTable.endpointId))
    .innerJoin(domainEventsTable, eq(domainEventsTable.id, webhookDeliveriesTable.eventId))
    .where(
      and(
        eq(webhookDeliveriesTable.reference, reference),
        eq(webhookDeliveriesTable.organizationId, ctx.organizationId),
        eq(webhookEndpointsTable.mode, ctx.mode)
      )
    )
    .limit(1);
  if (!row) {
    throw AppError.NotFound(
      'Webhook delivery not found',
      { reference },
      NOMBAONE_ERROR_CODES.WEBHOOK_ENDPOINT_NOT_FOUND
    );
  }
  return row;
}

export async function getWebhookDelivery(
  db: InfraDb,
  ctx: DomainContext,
  reference: string
): Promise<WebhookDeliveryResponseData> {
  const { delivery, endpointRef, eventRef } = await loadJoinedDelivery(db, ctx, reference);
  return serializeWebhookDelivery(delivery, endpointRef, eventRef);
}

/**
 * Manually replay a delivery (G6 ★): re-arm the SAME row (no new WHD/EVT reference,
 * so consumers still dedupe on the unchanged `event.id`). Guarded on
 * `status ∈ {dead, failed}` — replaying a `pending`/`succeeded` row is an idempotent
 * no-op success. Resets status/attempts/nextAttemptAt, stamps `replayedAt`, bumps
 * `replayCount`. The next drain (or the maintenance tick) delivers it.
 */
export async function replayDelivery(
  db: InfraDb,
  ctx: DomainContext,
  reference: string
): Promise<WebhookDeliveryResponseData> {
  const { delivery, endpointRef, eventRef } = await loadJoinedDelivery(db, ctx, reference);
  if (delivery.status !== 'dead' && delivery.status !== 'failed') {
    return serializeWebhookDelivery(delivery, endpointRef, eventRef); // idempotent no-op
  }
  const [rearmed] = await db
    .update(webhookDeliveriesTable)
    .set({
      status: 'pending',
      attempts: 0,
      nextAttemptAt: new Date(),
      replayedAt: new Date(),
      replayCount: delivery.replayCount + 1,
    })
    .where(and(eq(webhookDeliveriesTable.id, delivery.id), eq(webhookDeliveriesTable.reference, reference)))
    .returning();
  return serializeWebhookDelivery(rearmed ?? delivery, endpointRef, eventRef);
}

export interface AutoReplayResult {
  rearmed: number;
}

/**
 * Automatic dead-letter replay (G6, platform-wide like `deliverPending`): re-arm
 * `dead` deliveries to NON-disabled endpoints whose `replayCount` is under the
 * ceiling. Bounded by `limit` and the ceiling so a permanently-dead endpoint is not
 * retried forever. Idempotent (only `dead` rows are touched).
 */
export async function autoReplayDeadLetters(
  db: InfraDb,
  opts?: { limit?: number }
): Promise<AutoReplayResult> {
  const limit = opts?.limit && opts.limit > 0 ? opts.limit : 100;
  const dead = await db
    .select({ id: webhookDeliveriesTable.id, replayCount: webhookDeliveriesTable.replayCount })
    .from(webhookDeliveriesTable)
    .innerJoin(webhookEndpointsTable, eq(webhookEndpointsTable.id, webhookDeliveriesTable.endpointId))
    .where(
      and(
        eq(webhookDeliveriesTable.status, 'dead'),
        isNull(webhookEndpointsTable.disabledAt),
        lte(webhookDeliveriesTable.replayCount, AUTO_REPLAY_CEILING - 1)
      )
    )
    .limit(limit);

  let rearmed = 0;
  const now = new Date();
  for (const row of dead) {
    const [updated] = await db
      .update(webhookDeliveriesTable)
      .set({
        status: 'pending',
        attempts: 0,
        nextAttemptAt: now,
        replayedAt: now,
        replayCount: row.replayCount + 1,
      })
      .where(and(eq(webhookDeliveriesTable.id, row.id), eq(webhookDeliveriesTable.status, 'dead')))
      .returning();
    if (updated) rearmed += 1;
  }
  return { rearmed };
}
