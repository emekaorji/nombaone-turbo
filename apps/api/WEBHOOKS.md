# Outbound Webhooks — the delivery contract

This is the canonical, human-readable outbound webhook reference. The
machine-readable source of truth is `WEBHOOK_EVENT_CATALOG` in
`@nombaone/core-contracts` (`types/webhook-events.ts`); the docs app (09) renders
both. Nothing here re-specs the machinery in `sara/webhooks` — it states the
contract that machinery already implements.

## Signed body (frozen shape)

Every delivery is a `POST` with a JSON body of exactly this shape:

```jsonc
{
  "id":   "nbo…whd",              // the DELIVERY reference (per attempt-target)
  "type": "invoice.paid",          // the event type
  "event": {                       // the event envelope
    "id":   "nbo…evt",             // ← the DEDUPE KEY (stable across redeliveries + replays)
    "type": "invoice.paid",
    "createdAt": "2026-07-01T02:00:00.000Z"
  },
  "data": { /* the typed payload for this event type (see the catalog) */ }
}
```

`event.id` (the `EVT` reference) lives **inside** the signed body, so it cannot be
spoofed apart from the signature. **Dedupe on `event.id`.**

## Headers

| Header | Meaning |
|---|---|
| `x-nombaone-signature` | `t=<unix>,v1=<hex>` — `v1 = HMAC-SHA256(key, `` `${t}.${rawBody}` ``)` in lowercase hex; multiple `v1` entries are legal during rotation |
| `x-nombaone-event-type` | the event type (also in the body) |
| `x-nombaone-delivery` | the delivery reference (also in the body `id`) |
| `x-nombaone-delivery-guarantee` | `at-least-once` |

## Verifying a delivery (the exact recipe)

The signing **key is the sha256 of your plaintext signing secret** (we store only
that hash; the plaintext is shown once at endpoint creation / rotation). Recompute
it once, then verify every delivery's `t=<unix>,v1=<hex>` header against the
**exact raw bytes** you received — the timestamp is bound into the signed message,
so also reject stale `t` (replay protection). The Node SDK
(`nombaone.webhooks.constructEvent`) does all of this from the plaintext secret:

```ts
import { createHash, createHmac, timingSafeEqual } from 'node:crypto';

const [, t, v1] = /^t=(\d+),v1=([0-9a-f]{64})/.exec(signatureHeader)!; // multiple v1 legal on rotation
if (Math.abs(Date.now() / 1000 - Number(t)) > 300) throw new Error('stale timestamp');

const key = createHash('sha256').update(plaintextSecret).digest('hex');
const expected = createHmac('sha256', key).update(`${t}.${rawBody}`, 'utf8').digest('hex');
const ok =
  expected.length === v1.length &&
  timingSafeEqual(Buffer.from(expected), Buffer.from(v1));
```

On **rotation** you receive a new plaintext once; keep the prior key briefly (or
rotate during a quiet window) since in-flight deliveries re-sign with the new key.

## Delivery guarantee — at-least-once

We mark a delivery's outcome only **after** the POST resolves, so a crash mid-flight
re-drains the row and you may see a **duplicate**. This is **at-least-once**;
**dedupe on `event.id`.** There is no exactly-once mode.

## Retries — exponential backoff on non-2XX

A non-2XX (or transport error) schedules a retry with backoff `[10s, 1m, 5m, 30m,
2h]` (indexed by the failed attempt). After **6** attempts the delivery is parked
`dead` (the dead-letter store). `attempts` / `nextAttemptAt` / `responseStatus` are
visible on `GET /v1/webhook-deliveries`.

## Dead-letter + replay

- **List** dead-letters: `GET /v1/webhook-deliveries?status=dead`.
- **Manual replay**: `POST /v1/webhook-deliveries/:reference/replay` re-arms the
  **same** row (no new `whd`/`evt` reference — `event.id` is unchanged, so your
  dedupe still holds). Idempotent (replaying a live/succeeded row is a no-op).
- **Automatic replay**: a bounded maintenance tick re-arms `dead` deliveries whose
  endpoint has recovered, capped by a `replayCount` ceiling so a permanently-dead
  endpoint is not retried forever.

## Event catalog

Every documented event `type` fires on the transition below; `data` carries the
listed keys. Subscribe an endpoint to `*` (all) or to specific types.

| Type | Fires when | `data` keys |
|---|---|---|
| `customer.created` | a customer is created | `reference` |
| `plan.created` / `plan.updated` | a plan is created / updated or archived | `reference` |
| `subscription.created` | a subscription is created | `reference`, `status` |
| `subscription.updated` | plan/quantity/metadata/proration/past_due change | `reference` |
| `subscription.trial_will_end` | a trial nears its end | `reference` |
| `subscription.activated` | first charge / recovery / resume | `reference` |
| `subscription.paused` / `subscription.resumed` | pause / resume | `reference` |
| `subscription.canceled` | voluntary cancel | `reference` |
| `subscription.churned` | involuntary cancel (dunning exhausted) | `reference` |
| `invoice.created` / `invoice.finalized` | invoice created / finalized | `reference` |
| `invoice.paid` | invoice fully paid | `reference` |
| `invoice.payment_failed` | a collection attempt failed (dunning begins) | `reference`, `reason` |
| `invoice.payment_partially_collected` | a short collection banked part of it | `reference`, `amountPaid`, `amountRemaining` |
| `invoice.payment_recovered` | a dunning retry recovered a past_due invoice | `reference` |
| `invoice.voided` | invoice voided | `reference` |
| `payment_method.attached` | a card/mandate/virtual-account attached | `reference`, `kind`, `status` |
| `payment_method.updated` | subscription card swapped | `reference`, `subscription` |
| `payment_method.expiring` | card expiring / card update required | `reference`, `reason` |
| `settlement.created` | funds settled to the tenant sub-account (08) | `reference` |
