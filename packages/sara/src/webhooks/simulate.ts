import { AppError, NOMBAONE_ERROR_CODES } from '@nombaone/errors';

import { WEBHOOK_EVENT_CATALOG, emitEvent, isCatalogEventType } from '../events';

import { deliverPending } from './deliver';

import type { WebhookEventType } from '../events';
import type { DomainContext, InfraDb } from '../context';

export interface SimulateWebhookInput {
  type: string;
  payload?: Record<string, unknown>;
}

export interface WebhookSimulationResult {
  event: string;
  type: string;
  deliveredCount: number;
}

/**
 * TEST-MODE ONLY. Mint a REAL catalog event of `type` (writing the same
 * `domain_events` row + fanning out `webhook_deliveries` to the tenant's matching
 * endpoints), then flush it through the real signing + POST path so the delivery
 * the tenant receives is byte-for-byte indistinguishable from a production one.
 * If no endpoint subscribes to `type`, the event is still recorded and
 * `deliveredCount` is 0 — the caller can tell.
 */
export async function simulateWebhookEvent(
  db: InfraDb,
  ctx: DomainContext,
  input: SimulateWebhookInput
): Promise<WebhookSimulationResult> {
  if (ctx.mode !== 'sandbox') {
    throw AppError.Forbidden(
      'Webhook simulation is only available in sandbox mode',
      undefined,
      NOMBAONE_ERROR_CODES.CLIENT_FORBIDDEN
    );
  }
  if (!isCatalogEventType(input.type)) {
    throw AppError.BadRequest(
      `Unknown event type: ${input.type}. Simulate only catalogued event types.`,
      { type: input.type },
      NOMBAONE_ERROR_CODES.WEBHOOK_EVENT_NOT_FOUND
    );
  }

  const payload = input.payload ?? sampleForType(input.type);
  const emitted = await emitEvent(db, { ...ctx, type: input.type, payload });
  // deliverPending drains due deliveries platform-wide (test deployment) — the
  // just-emitted delivery is included, going out through the real signed path.
  const result = await deliverPending(db, { limit: 100 });

  return { event: emitted.reference, type: input.type, deliveredCount: result.attempted };
}

/** A minimal illustrative payload from the catalog's declared keys, when none given. */
function sampleForType(type: WebhookEventType): Record<string, unknown> {
  const keys = WEBHOOK_EVENT_CATALOG[type]?.payload ?? [];
  return Object.fromEntries(keys.map((key) => [key, `sample_${key}`]));
}
