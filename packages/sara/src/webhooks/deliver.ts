import { and, eq, inArray, lte, or, isNull } from 'drizzle-orm';

import {
  domainEventsTable,
  webhookDeliveriesTable,
  webhookEndpointsTable,
  type WebhookDeliveryRow,
  type WebhookEndpointRow,
  type DomainEventRow,
} from '@nombaone/core-db/schema';
import {
  WEBHOOK_DELIVERY_GUARANTEE,
  WEBHOOK_DELIVERY_GUARANTEE_HEADER,
} from '@nombaone/core-contracts/types';

import { buildSignatureHeader } from './sign';

import type { InfraDb } from '../context';

/**
 * PARADIGM — the at-least-once delivery drain with exponential backoff and a
 * dead-letter terminal state.
 *
 * `emitEvent` writes delivery INTENT (`pending` rows, due immediately). This
 * function is the OUT-OF-BAND worker that turns intent into HTTP: a scheduler
 * (cron / queue consumer) calls it repeatedly. Each pass:
 *
 *   1. Selects deliveries that are DUE — status `pending` or `failed` with
 *      `nextAttemptAt <= now` — to a non-disabled endpoint, capped by `limit`.
 *   2. POSTs the canonical JSON body, signed with the endpoint's signing key
 *      (the stored sha256, see `./endpoints`) in the timestamped
 *      `t=<unix>,v1=<hex>` scheme (see `./sign`), carrying the signature header
 *      + event metadata as headers.
 *   3. On a 2xx: marks `succeeded`. On anything else (non-2xx, network error,
 *      timeout): increments `attempts`, and either schedules the next retry with
 *      EXPONENTIAL BACKOFF (`failed` + future `nextAttemptAt`) or, once
 *      `MAX_ATTEMPTS` is exhausted, parks it in the `dead` terminal state for a
 *      human / dead-letter alarm.
 *
 * Delivery is at-least-once by construction: we mark the outcome only AFTER the
 * POST resolves, so a crash mid-flight simply leaves the row due and it is
 * retried. Receivers must therefore dedupe on the event id we send.
 */

/** Retries after the first attempt; on the (MAX_ATTEMPTS)-th failure → `dead`. */
export const MAX_ATTEMPTS = 6;
/** Per-request HTTP timeout — a hung receiver must not stall the whole drain. */
const REQUEST_TIMEOUT_MS = 10_000;
const DEFAULT_BATCH_LIMIT = 50;

/**
 * Backoff schedule (ms) indexed by the attempt that just FAILED (1-based):
 * ~10s, 1m, 5m, 30m, 2h. Capped/extended by the last entry. A retry overdue by
 * more than its slot fires on the next drain regardless.
 */
export const BACKOFF_MS = [10_000, 60_000, 300_000, 1_800_000, 7_200_000] as const;

export const backoffFor = (attempts: number): number => {
  const idx = Math.min(Math.max(attempts - 1, 0), BACKOFF_MS.length - 1);
  return BACKOFF_MS[idx] ?? BACKOFF_MS[BACKOFF_MS.length - 1]!;
};

interface DeliverResult {
  attempted: number;
  succeeded: number;
  failed: number;
}

/**
 * Drain due deliveries once. Returns a count summary for the caller's metrics.
 * NOTE: not tenant-scoped — this is platform infrastructure that drains across
 * all organizations; the per-row `organizationId` stays intact for audit.
 */
export const deliverPending = async (
  db: InfraDb,
  opts?: { limit?: number }
): Promise<DeliverResult> => {
  const limit = opts?.limit && opts.limit > 0 ? opts.limit : DEFAULT_BATCH_LIMIT;
  const now = new Date();

  const due: WebhookDeliveryRow[] = await db
    .select()
    .from(webhookDeliveriesTable)
    .where(
      and(
        inArray(webhookDeliveriesTable.status, ['pending', 'failed']),
        or(
          isNull(webhookDeliveriesTable.nextAttemptAt),
          lte(webhookDeliveriesTable.nextAttemptAt, now)
        )
      )
    )
    .orderBy(webhookDeliveriesTable.nextAttemptAt)
    .limit(limit);

  let succeeded = 0;
  let failed = 0;

  for (const delivery of due) {
    const endpoint = await loadEndpoint(db, delivery.endpointId);
    // Endpoint vanished or was disabled after the delivery was queued: there is
    // nowhere to send it, so retire the row to `dead` rather than spin forever.
    if (!endpoint || endpoint.disabledAt) {
      await db
        .update(webhookDeliveriesTable)
        .set({ status: 'dead', lastAttemptAt: now })
        .where(eq(webhookDeliveriesTable.id, delivery.id));
      failed += 1;
      continue;
    }

    const event = await loadEvent(db, delivery.eventId);
    const rawBody = buildBody(delivery, event);
    // `t=<unix>,v1=<hex>` — v1 = HMAC-SHA256(signingSecretHash, `${t}.${rawBody}`).
    const signatureHeader = buildSignatureHeader(endpoint.signingSecretHash, rawBody);

    const responseStatus = await attemptPost(endpoint.url, rawBody, signatureHeader, delivery);
    const attempts = delivery.attempts + 1;
    const attemptedAt = new Date();

    if (responseStatus !== null && responseStatus >= 200 && responseStatus < 300) {
      await db
        .update(webhookDeliveriesTable)
        .set({
          status: 'succeeded',
          attempts,
          lastAttemptAt: attemptedAt,
          responseStatus,
          nextAttemptAt: null,
        })
        .where(eq(webhookDeliveriesTable.id, delivery.id));
      succeeded += 1;
      continue;
    }

    const exhausted = attempts >= MAX_ATTEMPTS;
    await db
      .update(webhookDeliveriesTable)
      .set({
        status: exhausted ? 'dead' : 'failed',
        attempts,
        lastAttemptAt: attemptedAt,
        responseStatus: responseStatus ?? null,
        nextAttemptAt: exhausted ? null : new Date(attemptedAt.getTime() + backoffFor(attempts)),
      })
      .where(eq(webhookDeliveriesTable.id, delivery.id));
    failed += 1;
  }

  return { attempted: due.length, succeeded, failed };
};

const loadEndpoint = async (
  db: InfraDb,
  endpointId: string
): Promise<WebhookEndpointRow | undefined> => {
  const [row] = await db
    .select()
    .from(webhookEndpointsTable)
    .where(eq(webhookEndpointsTable.id, endpointId))
    .limit(1);
  return row;
};

const loadEvent = async (db: InfraDb, eventId: string): Promise<DomainEventRow | undefined> => {
  const [row] = await db
    .select()
    .from(domainEventsTable)
    .where(eq(domainEventsTable.id, eventId))
    .limit(1);
  return row;
};

/**
 * The canonical signed envelope. The event id is the dedupe key receivers MUST
 * use; including it INSIDE the signed body (not just a header) means it cannot
 * be spoofed independently of the signature.
 */
const buildBody = (delivery: WebhookDeliveryRow, event: DomainEventRow | undefined): string =>
  JSON.stringify({
    id: delivery.reference,
    type: delivery.eventType,
    event: event
      ? { id: event.reference, type: event.type, createdAt: event.createdAt }
      : { id: null, type: delivery.eventType, createdAt: null },
    data: event?.payload ?? {},
  });

/**
 * Fire one POST. Returns the HTTP status, or `null` for a transport-level
 * failure (DNS / connection / timeout / abort) — both are non-2xx outcomes that
 * trigger a retry, but the distinction is preserved in `responseStatus`.
 */
const attemptPost = async (
  url: string,
  rawBody: string,
  signatureHeader: string,
  delivery: WebhookDeliveryRow
): Promise<number | null> => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'user-agent': 'nombaone-webhooks/1',
        'x-nombaone-signature': signatureHeader,
        'x-nombaone-event-type': delivery.eventType,
        'x-nombaone-delivery': delivery.reference,
        // G5: the stated delivery guarantee — consumers dedupe on the body's event.id.
        [WEBHOOK_DELIVERY_GUARANTEE_HEADER]: WEBHOOK_DELIVERY_GUARANTEE,
      },
      body: rawBody,
      signal: controller.signal,
    });
    return res.status;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
};
