import { and, eq } from 'drizzle-orm';

import { nombaWebhookEventsTable } from '@nombaone/core-db/schema';

import { mintReference } from '../reference';

import type { Environment, InfraTxDb } from '../context';

/**
 * The DURABLE inbound-dedup primitive (F2). Inserts a `nomba_webhook_events` row;
 * the `unique(provider, request_id)` makes a duplicate impossible, so a conflict
 * (no row returned) means "already seen → ack, no-op". `organization_id` is left
 * null at ingest and resolved during settle.
 */
export interface RecordInboundEventInput {
  environment: Environment;
  provider?: string;
  requestId: string;
  eventType: string;
  payload: Record<string, unknown>;
  organizationId?: string;
}

export async function recordInboundEvent(
  txDb: InfraTxDb,
  input: RecordInboundEventInput
): Promise<{ firstSeen: boolean; reference: string }> {
  const reference = mintReference('NWE');
  const inserted = await txDb
    .insert(nombaWebhookEventsTable)
    .values({
      reference,
      environment: input.environment,
      provider: input.provider ?? 'nomba',
      requestId: input.requestId,
      eventType: input.eventType,
      payload: input.payload,
      organizationId: input.organizationId ?? null,
      status: 'received',
    })
    .onConflictDoNothing({
      target: [nombaWebhookEventsTable.provider, nombaWebhookEventsTable.requestId],
    })
    .returning({ reference: nombaWebhookEventsTable.reference });

  const row = inserted[0];
  return { firstSeen: Boolean(row), reference: row?.reference ?? reference };
}

/** Mark a recorded inbound event's terminal status after processing. */
export async function markInboundEvent(
  txDb: InfraTxDb,
  input: { provider?: string; requestId: string; status: 'processed' | 'ignored' | 'failed' }
): Promise<void> {
  await txDb
    .update(nombaWebhookEventsTable)
    .set({ status: input.status, processedAt: new Date() })
    .where(
      and(
        eq(nombaWebhookEventsTable.provider, input.provider ?? 'nomba'),
        eq(nombaWebhookEventsTable.requestId, input.requestId)
      )
    );
}
