import { enqueueOutboundWebhook } from '@nombaone/queue';
import { setDeliveryNotifier } from '@nombaone/sara/events';

import { logger } from '@shared/observability/logger';

/**
 * ── THE OUTBOX POSTMAN ───────────────────────────────────────────────────────
 *
 * `emitEvent` writes the delivery INTENT (a `pending` row per subscribed endpoint) in the
 * same transaction as the state change. This turns that intent into an actual HTTP POST
 * promptly, by nudging the outbound-webhook worker the moment an event fans out.
 *
 * Without this, the ONLY thing that ever drained the outbox was the maintenance cron —
 * so a merchant learned that a customer had paid up to a full cron interval after it
 * happened. For a billing engine that is not a latency nit: an integration that reacts to
 * `invoice.paid` (unlock the gym door, send the receipt, ship the goods) looks broken.
 *
 * Registered at boot in every entrypoint that emits. It is deliberately best-effort:
 * the rows are already durable, so a Redis failure costs promptness and nothing else —
 * the cron remains the backstop, and it is also what fires the backoff retries.
 */
export function registerWebhookDispatch(): void {
  setDeliveryNotifier(({ organizationId, eventType, deliveryReferences }) => {
    for (const deliveryReference of deliveryReferences) {
      // Fire-and-forget: emitEvent is on the request path and often inside a transaction,
      // so we must not await Redis here. A rejection is logged, never thrown — the write
      // that produced the event has already succeeded and must not be undone by it.
      void enqueueOutboundWebhook({ deliveryReference, eventType, organizationId }).catch(
        (error: unknown) => {
          logger.warn('[webhooks] could not enqueue delivery; the cron will pick it up', {
            deliveryReference,
            eventType,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      );
    }
  });
}
