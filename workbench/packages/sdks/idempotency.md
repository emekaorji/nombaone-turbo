# Idempotency in the SDKs

The raw API requires an `Idempotency-Key` on every money-moving call and honors one on
everything else. Our official SDKs make that free: **every mutating call auto-generates
a stable idempotency key and reuses it across the SDK's own retries**, so a POST that
times out and gets retried under the hood never double-charges. You don't have to think
about it. When you *want* to think about it — to survive a process restart or a job
that runs twice — you pass your own key, ideally derived from something you already own
like an order id. This page shows both.

---

## The default: safe retries, zero config

Call a mutating method and the SDK does the right thing. It mints one key for the call,
attaches it as `Idempotency-Key`, and if a retry fires (timeout, connection reset, `429`,
`IDEMPOTENCY_IN_PROGRESS`), it retries with the **same** key. One logical call → one
charge, however many times the wire hiccups.

```ts
import { NombaOne } from '@nombaone/sdk';

const nomba = new NombaOne({ apiKey: process.env.NOMBA_API_KEY }); // nbo_test_… / nbo_live_…

// No key in sight. The SDK generates one and reuses it across its retries.
const sub = await nomba.subscriptions.create({
  customerId: 'nbo749201835566cus',
  priceId: 'nbo749201835566prc',
  paymentMethodId: 'nbo749201835566pmt',
  quantity: 1,
});
// If this call was retried internally, the customer was still charged exactly once.
```

That covers the common failure mode — a flaky network between your server and ours. What
it *can't* cover on its own is your process crashing and a job re-running from scratch:
the SDK's in-memory key is gone, so the re-run mints a fresh key and looks like a new
operation. That's what your own key is for.

---

## Your own key: safe across restarts and re-runs

Pass `idempotencyKey` per call. Derive it from a natural id — an order, an invoice, a job
id — so the *same* business event always produces the *same* key. Now even a worker that
retries the whole job after a crash lands on the original result instead of charging
again.

```ts
// Keyed on YOUR order id → same order can never create two subscriptions,
// even if the worker restarts and replays the job from the top.
const sub = await nomba.subscriptions.create(
  {
    customerId: 'nbo749201835566cus',
    priceId: 'nbo749201835566prc',
    paymentMethodId: 'nbo749201835566pmt',
    quantity: 1,
  },
  { idempotencyKey: `order:${order.id}:subscribe` },
);
```

Rules that make this reliable:

- **One key per logical operation.** `order:1234:subscribe` for the subscribe,
  `order:1234:refund` for the refund. Don't share a key across different operations.
- **Same operation, same key.** A re-run must recompute the identical key from the same
  natural id — that's the whole point.
- **Keep the body identical on replay.** Same key + different body → `IDEMPOTENCY_KEY_REUSED`.
  If the inputs genuinely changed, it's a new operation and needs a new key.

You can pass your own key on any mutating call — including the optional-key endpoints
(create customer, plan, coupon, void invoice, rotate secret…). The SDK sends it through;
the API dedupes on it. Money-moving calls (`subscriptions.create`, `customers.credit`,
`paymentMethods.setup`, `mandates.create`, `settlements.refund`, `settlements.payout`,
and the rest of the required set) always carry a key whether you supply one or not.

---

## Same behavior in every language SDK

This is a platform contract, not a Node quirk. Every official SDK auto-generates and
reuses a key across its retries, and every one takes a per-call override. Only the option
name follows each language's convention:

**Python** — `idempotency_key`

```python
from nombaone import NombaOne

nomba = NombaOne(api_key=os.environ["NOMBA_API_KEY"])

sub = nomba.subscriptions.create(
    customer_id="nbo749201835566cus",
    price_id="nbo749201835566prc",
    payment_method_id="nbo749201835566pmt",
    quantity=1,
    idempotency_key=f"order:{order.id}:subscribe",  # optional; auto-generated if omitted
)
```

**Go** — `IdempotencyKey`

```go
sub, err := client.Subscriptions.Create(ctx, &nombaone.SubscriptionCreateParams{
    CustomerID:      "nbo749201835566cus",
    PriceID:         "nbo749201835566prc",
    PaymentMethodID: "nbo749201835566pmt",
    Quantity:        1,
    IdempotencyKey:  nombaone.String("order:" + order.ID + ":subscribe"), // optional
})
```

The same holds for PHP, Ruby, and the rest: omit it and retries are safe within the call;
pass it (`idempotencyKey` / `idempotency_key` / `IdempotencyKey`) to make them safe across
restarts too.

---

## What the SDK handles for you

- **Generates a key** for every mutation so money-moving calls never 400 with
  `IDEMPOTENCY_KEY_MISSING`.
- **Reuses that key across internal retries** — timeouts, resets, `429`, and
  `IDEMPOTENCY_IN_PROGRESS` all retry the original key rather than starting over.
- **Backs off and re-polls on `IDEMPOTENCY_IN_PROGRESS`** so a racing retry resolves to
  the original result instead of erroring out to you.
- **Passes your `idempotencyKey` straight through** when you supply one, so your natural
  id — not a random UUID — is the dedup boundary.

Reach for your own key whenever the operation can be replayed by something outside a
single function call: a queue worker, a cron, a webhook handler, a user who double-clicks.
Everywhere else, the default already has you covered.
