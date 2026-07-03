# Idempotency

Billing is the one place a retry can cost real money. A subscription create that
times out on the wire — but actually succeeded on our side — must not become a
second charge when your client retries. An **idempotency key** is how you make a
mutating request safe to retry: send the same `Idempotency-Key` twice and you get
back the original result, with the side effect happening **exactly once**. Never a
double charge, never a duplicate subscription. This page is how to use it.

---

## How it works

Attach an `Idempotency-Key` header to a mutating request. The value is any unique,
hard-to-guess string — a UUID is the convention:

```
Idempotency-Key: 3f9c1e7a-8b2d-4c6e-9a1f-2d7e5c8b4a10
```

The first time we see a key on your organization, we run the request, store the
result against that key, and return it. Every replay of the **same key with the
same body** short-circuits to that stored result — we never run the side effect
again. It's the difference between "retry safely" and "hope it didn't go through."

Keys are scoped to your organization and never expire out from under an in-flight
retry. You choose the value; we recommend a v4 UUID per logical operation (one key
per "thing you're trying to make happen," reused across that operation's retries).

---

## Where it's required vs. optional

We changed the old policy where *every* mutation demanded a key. Creating a plan or
renaming a customer shouldn't hand you an `IDEMPOTENCY_KEY_MISSING` — those are cheap
to repeat and easy to reconcile. So we split the surface honestly:

### Required — the request 400s without a key

These endpoints move money, trigger a charge, or create/modify a money instrument.
A retry here can double-charge a customer, so we make the key **mandatory** and back
it with a durable database claim (a unique row, not just a cache) — it is fail-closed:

| Method | Path | Why it's guarded |
|---|---|---|
| POST | `/subscriptions` | Charges the first invoice |
| POST | `/subscriptions/{id}/change` | Proration can charge/credit |
| POST | `/subscriptions/{id}/resubscribe` | Restarts billing, charges |
| POST | `/subscriptions/{id}/cancel` | May settle a final invoice |
| POST | `/customers/{id}/credit` | Grants account credit (money) |
| DELETE | `/customers/{id}/credit/{grantId}` | Voids a credit grant (money) |
| POST | `/payment-methods/setup` | Creates a money instrument |
| POST | `/mandates` | Creates a direct-debit instrument |
| POST | `/settlements/{id}/refund` | Moves money back to a customer |
| POST | `/settlements/payout` | Withdraws funds to a bank |

### Optional but strongly encouraged — everything else

Every other mutation accepts an `Idempotency-Key` and honors it (same key + same
body → deduped), but doesn't require one. If you omit it, the request still works.
This covers create/update customer, plan, price, coupon, and webhook; pause/resume;
void invoice; rotate signing secret; replay a delivery; and the rest.

> **Send one anyway.** Optional isn't a suggestion to skip it. A network blip on
> `POST /coupons` without a key can leave you with two coupons and a support ticket.
> With a key, the retry is a no-op that returns the coupon you already made. The cost
> is one header. The payoff is that *every* retry in your integration is safe by
> default, and you never have to reason about which endpoints were "the risky ones."
> You'll thank yourself the first time a deploy retries a batch of writes.

---

## Error behaviors

All errors use the standard envelope: `{ success, statusCode, error, meta:{requestId} }`.

### Missing key on a required endpoint — `IDEMPOTENCY_KEY_MISSING`

You called a money-moving endpoint without the header.

```json
{
  "success": false,
  "statusCode": 400,
  "error": {
    "code": "IDEMPOTENCY_KEY_MISSING",
    "message": "This endpoint moves money and requires an Idempotency-Key header. Send a unique UUID and reuse it if you retry."
  },
  "meta": { "requestId": "req_9f2a71c4" }
}
```

Fix: add `Idempotency-Key: <uuid>` and retry with the **same** value.

### Same key, different body — `IDEMPOTENCY_KEY_REUSED`

You reused a key you'd already spent, but the request body doesn't match the original.
That's almost always a bug — a key represents one specific operation, so a different
payload under the same key is ambiguous and we refuse it rather than guess.

```json
{
  "success": false,
  "statusCode": 422,
  "error": {
    "code": "IDEMPOTENCY_KEY_REUSED",
    "message": "This Idempotency-Key was already used with a different request body. Use a fresh key for a new operation."
  },
  "meta": { "requestId": "req_1c8e40b3" }
}
```

Fix: use a new key for the new operation. Only reuse a key to retry the *identical*
request.

### A retry landed while the original is still running — `IDEMPOTENCY_IN_PROGRESS`

Two requests with the same key arrived close together and the first one hasn't
finished. We hold the lock so the side effect can't run twice concurrently.

```json
{
  "success": false,
  "statusCode": 409,
  "error": {
    "code": "IDEMPOTENCY_IN_PROGRESS",
    "message": "A request with this Idempotency-Key is still processing. Retry in a moment to get the original result."
  },
  "meta": { "requestId": "req_5b7d92af" }
}
```

Fix: wait a beat and retry with the same key. Once the original completes, the retry
returns its stored result.

---

## Copy & run

### curl

Create a subscription safely — reuse the exact same key if the call times out and you
retry. Amounts elsewhere are integer kobo; the environment (`test`/`live`) is baked
into your API key.

```bash
KEY=$(uuidgen)

curl -sS https://api.nombaone.com/v1/subscriptions \
  -H "Authorization: Bearer nbo_test_xxxxxxxxxxxxxxxx" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: $KEY" \
  -d '{
    "customerId": "nbo749201835566cus",
    "priceId": "nbo749201835566prc",
    "paymentMethodId": "nbo749201835566pmt",
    "quantity": 1
  }'
```

Ran the request, didn't see a response? Replay it with the **same** `$KEY` — you'll
get the original subscription back, not a second one:

```bash
# identical body, identical key → returns the same subscription, charges once
curl -sS https://api.nombaone.com/v1/subscriptions \
  -H "Authorization: Bearer nbo_test_xxxxxxxxxxxxxxxx" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: $KEY" \
  -d '{ "customerId":"nbo749201835566cus","priceId":"nbo749201835566prc","paymentMethodId":"nbo749201835566pmt","quantity":1 }'
```

### Node (fetch, with retry)

```js
import { randomUUID } from 'node:crypto';

async function createSubscription(body, { retries = 3 } = {}) {
  // One key for this operation, reused across every retry.
  const idempotencyKey = randomUUID();

  for (let attempt = 0; ; attempt++) {
    const res = await fetch('https://api.nombaone.com/v1/subscriptions', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer nbo_test_xxxxxxxxxxxxxxxx',
        'Content-Type': 'application/json',
        'Idempotency-Key': idempotencyKey,
      },
      body: JSON.stringify(body),
    });

    const json = await res.json();

    // Original still running — wait and retry the SAME key.
    if (json.error?.code === 'IDEMPOTENCY_IN_PROGRESS' && attempt < retries) {
      await new Promise((r) => setTimeout(r, 500 * 2 ** attempt));
      continue;
    }

    if (!json.success) throw new Error(`${json.error.code}: ${json.error.message}`);
    return json.data; // charged exactly once, no matter how many times we looped
  }
}

await createSubscription({
  customerId: 'nbo749201835566cus',
  priceId: 'nbo749201835566prc',
  paymentMethodId: 'nbo749201835566pmt',
  quantity: 1,
});
```

---

## Rules of thumb

- **One key per operation.** Not per session, not per customer — per "thing you want
  to happen once."
- **Reuse the key only to retry the identical request.** New payload → new key.
- **Required on money-moving endpoints** (listed above); optional everywhere else —
  but send it everywhere anyway.
- **Key with a natural id when you have one.** Deriving your key from your own order
  or invoice id makes retries safe even across a process restart (the SDKs do this for
  you — see the SDK idempotency guide).
