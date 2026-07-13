/**
 * Inbound webhook receiver.
 *
 * Verification rules that matter:
 *  - RAW body (`await req.text()`) — parsing/re-stringifying can reorder keys
 *    and change bytes, which breaks the signature.
 *  - `x-nombaone-signature: t=…,v1=…` — verified by the SDK's standalone
 *    `webhooks.constructEvent` with the PLAINTEXT `nbo_whsec_…` secret (the
 *    SDK hashes it internally; no API key needed here).
 *  - Delivery is at-least-once — dedupe on `event.event.id` (the ring buffer
 *    does).
 */
import { WebhookVerificationError, webhooks } from '@nombaone/node';

import { recordEvent } from '@/lib/event-log';

import type { WebhookEvent } from '@nombaone/node';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  const secret = process.env.GYM_WEBHOOK_SECRET;
  if (!secret) {
    console.error('[gym/webhooks] GYM_WEBHOOK_SECRET is not set — cannot verify deliveries');
    return Response.json({ error: 'webhook secret not configured' }, { status: 500 });
  }

  const rawBody = await req.text();
  const signature = req.headers.get('x-nombaone-signature') ?? '';

  let event: WebhookEvent;
  try {
    event = webhooks.constructEvent(rawBody, signature, secret);
  } catch (error) {
    const reason = error instanceof WebhookVerificationError ? error.message : String(error);
    console.warn('[gym/webhooks] rejected delivery: signature verification failed', { reason });
    return Response.json({ error: 'invalid signature' }, { status: 400 });
  }

  const data = event.data as Record<string, unknown>;
  const fresh = recordEvent(event);
  console.log(
    `[gym/webhooks] ${event.type}${fresh ? '' : ' (replay, deduped)'}`,
    JSON.stringify({
      eventId: event.event.id,
      deliveryId: event.id,
      reference: typeof data.reference === 'string' ? data.reference : null,
    }),
  );

  // Respond 2xx fast; a real merchant would enqueue heavy work here.
  return Response.json({ received: true });
}
