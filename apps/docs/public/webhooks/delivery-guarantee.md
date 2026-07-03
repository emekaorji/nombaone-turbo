---
title: "Delivery guarantee"
type: reference
summary: "Delivery is at-least-once, never exactly-once. The same event can arrive twice — dedupe on the event id and make every handler idempotent."
canonical: https://docs.nombaone.xyz/webhooks/delivery-guarantee
---

# Delivery guarantee

nombaone guarantees **at-least-once** delivery, and says so on every delivery in
the `X-Nombaone-Delivery-Guarantee` header. That is a deliberate, honest choice:
exactly-once delivery over an unreliable network is not achievable, and any API
that claims it is lying. What we give you instead is a guarantee you can build on
— plus the one tool that makes it safe: a stable event id to dedupe on.

## What at-least-once means for you

The same event **can** arrive more than once — a retry after a slow response, a
network hiccup, a redelivery. Your handler must treat a repeat as a no-op.

> **Dedupe on the event id, after verifying**
>
> Record every `event.id` you've processed and skip repeats. Do this **after**
> signature verification, so an unverified body can never poison your dedupe
> store.

```ts
if (await seen(event.id)) return respond(200); // already handled — no-op
await markSeen(event.id);
await handle(event);
```

## Why idempotency has to go all the way down

Deduping at the edge is not enough on its own — the work the handler triggers
must itself be idempotent, because
[retrying the webhook is not retrying the charge](/concepts/hard-parts/retry-the-webhook-is-not-retry-the-charge).
If a duplicate `invoice.paid` slips through, crediting a balance twice is a real
bug. The [ledger](/concepts/the-ledger) enforces this at the bottom: a money
movement is claimed once, so even a double-processed event resolves to one
posting.

## Retries and ordering

- **Retries.** A delivery that doesn't get a timely `2xx` is retried on a backoff
schedule. Return `2xx` quickly and do the work async so a slow handler doesn't
trigger avoidable retries.
- **Ordering is not guaranteed.** Events can arrive out of order. Don't assume
`invoice.paid` lands before `subscription.activated` — reconcile against the
resource (`GET`) when order matters, rather than inferring state from event
sequence.
- **Replay.** You can re-request a past delivery with
`POST /v1/webhooks/{id}/deliveries/{deliveryId}/replay` — the same event id,
so your dedupe correctly treats it as already-seen.

- **[Handle webhooks](/guides/handle-webhooks)** — 
The full receive → verify → dedupe → act pattern.
- **[Retrying ≠ re-charging](/concepts/hard-parts/retry-the-webhook-is-not-retry-the-charge)** — 
Why idempotency lives in the ledger, not just the edge.
