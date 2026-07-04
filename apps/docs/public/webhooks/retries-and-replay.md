---
title: "Retries & replay"
type: reference
summary: "A delivery that doesn't get a timely 2xx is retried on a backoff schedule; you can also replay any past delivery by hand. Both preserve the event id."
canonical: https://docs.nombaone.xyz/webhooks/retries-and-replay
---

# Retries & replay

Networks fail, servers restart, deploys happen mid-request. nombaone assumes your
endpoint will occasionally miss a delivery and is built to recover — automatically
with retries, and manually with replay. Both reuse the **same event id**, so a
correctly [deduped](/webhooks/delivery-guarantee) handler treats a recovered
delivery as already-seen.

## Automatic retries

A delivery succeeds when your endpoint returns a `2xx` promptly. Anything else — a
timeout, a `5xx`, a connection error — is retried on an increasing backoff, giving
a briefly-down endpoint time to come back without you doing anything.

> **Return 2xx first, work later**
>
> The fastest way to avoid retries is to acknowledge immediately and process
> asynchronously. A handler that does slow work inline looks like a failure and
> earns retries it didn't need. Verify, dedupe, enqueue, return `200`.

A delivery that keeps failing past the retry schedule is marked failed and stops
retrying — it does not retry forever. You can always see where a delivery stands
and re-drive it yourself.

## Inspect deliveries

Every attempt is recorded. List an endpoint's deliveries, or read one:

```bash
# All deliveries for an endpoint
curl https://sandbox.api.nombaone.xyz/v1/webhooks/{id}/deliveries \
  -H "Authorization: Bearer nbo_test_…"

# One delivery, with its attempts and your endpoint's responses
curl https://sandbox.api.nombaone.xyz/v1/webhooks/{id}/deliveries/{deliveryId} \
  -H "Authorization: Bearer nbo_test_…"
```

## Replay a delivery

Redeliver a past event on demand — after fixing a handler bug, or to backfill an
endpoint that was down:

```bash
curl -X POST \
  https://sandbox.api.nombaone.xyz/v1/webhooks/{id}/deliveries/{deliveryId}/replay \
  -H "Authorization: Bearer nbo_test_…"
```

> **Replay keeps the original event id**
>
> A replay is the same event, delivered again — not a new one. Your dedupe store
> should recognize it as already-processed. That is exactly what you want: replay
> is safe precisely because your handler is idempotent.

## Missed a window? Reconcile, don't reconstruct

If your endpoint was down and you're unsure what you missed, don't try to rebuild
state from a guessed event sequence. Read the resource directly (`GET
/v1/subscriptions/{id}`) or replay the specific deliveries — the API is the source
of truth, and events are notifications about it.

- **[Delivery guarantee](/webhooks/delivery-guarantee)** — 
Why the event id makes retries and replay safe.
- **[Handle webhooks](/guides/handle-webhooks)** — 
Build the idempotent handler that makes this work.
