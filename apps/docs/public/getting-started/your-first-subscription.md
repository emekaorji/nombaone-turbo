---
title: "Your first subscription"
type: tutorial
summary: "Create a plan, a price, a customer, and a subscription that bills: five real calls to a live 201, end to end."
canonical: https://docs.nombaone.xyz/getting-started/your-first-subscription
---

# Your first subscription

By the end of this page you will have a **real subscription** billing in sandbox
mode, created with five calls, in about ten minutes, with no mocks. Each
call below is the genuine request your server will make in production; only the
key (`nbo_sandbox_…`) and the host (`sandbox.api.nombaone.xyz`) change when you go
live.

The minimal path is four resources and one deterministic test card:

1. a **plan**, the thing customers subscribe to,
2. a **price** on that plan, how much, how often,
3. a **customer**,
4. a **test payment method** that succeeds on cue,
5. the **subscription**, which produces the first invoice and collects it.

> **Get a sandbox key first**
>
> Every call authenticates with `Authorization: Bearer nbo_sandbox_…`. If you don't
> have a key yet, see [authentication](/getting-started/authentication). It
> takes one step. Keep the key server-side.

### Create a plan

A **plan** is the product a customer subscribes to. It carries a name; the
money lives on its prices (next step), so one plan can hold monthly and
yearly prices at once.

**cURL**

```bash
curl -X POST https://sandbox.api.nombaone.xyz/v1/plans \
  -H "Authorization: Bearer nbo_sandbox_…" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: $(uuidgen)" \
  -d '{ "name": "Pro" }'
```

**TypeScript**

```ts
const plan = await nbo("/v1/plans", {
  method: "POST",
  idempotencyKey: crypto.randomUUID(),
  body: { name: "Pro" },
});
// plan.data.id → "nbo…pln"
```

The response `data.id` is the plan's **reference**. Save it; the next call
needs it.

### Add a price

A **price** sets the amount and the cadence — a unit (`minute`, `day`, `week`,
`month`, `year`) times an `intervalCount` that defaults to 1. Amounts are
**integer kobo**: `250000` is ₦2,500.00. Post it to the plan you just made.

**cURL**

```bash
curl -X POST https://sandbox.api.nombaone.xyz/v1/plans/{planId}/prices \
  -H "Authorization: Bearer nbo_sandbox_…" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: $(uuidgen)" \
  -d '{ "unitAmountInKobo": 250000, "interval": "month" }'
```

**TypeScript**

```ts
const price = await nbo(`/v1/plans/${plan.data.id}/prices`, {
  method: "POST",
  idempotencyKey: crypto.randomUUID(),
  body: { unitAmountInKobo: 250_000, interval: "month" },
});
// price.data.id → "nbo…prc"
```

> **Money is integer kobo: the 100× trap**
>
> Send `250000`, not `2500`. Every money field ends in `InKobo` so the unit
> is never in doubt. Sending naira where kobo is expected overcharges by
> 100×. See [money is integer kobo](/concepts/money-is-integer-kobo).

### Create a customer

A **customer** is who you bill. Email and name are all you need to start.

**cURL**

```bash
curl -X POST https://sandbox.api.nombaone.xyz/v1/customers \
  -H "Authorization: Bearer nbo_sandbox_…" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: $(uuidgen)" \
  -d '{ "email": "ada@example.com", "name": "Ada Lovelace" }'
```

**TypeScript**

```ts
const customer = await nbo("/v1/customers", {
  method: "POST",
  idempotencyKey: crypto.randomUUID(),
  body: { email: "ada@example.com", name: "Ada Lovelace" },
});
// customer.data.id → "nbo…cus"
```

### Attach a test payment method that succeeds

In sandbox mode you attach a **deterministic** payment method: the
`behavior` decides the outcome, so your first pass succeeds on purpose. Use
`success` here; the other behaviors (decline, OTP required, thin
balance) let you rehearse the unhappy paths later.

**cURL**

```bash
curl -X POST https://sandbox.api.nombaone.xyz/v1/sandbox/payment-methods \
  -H "Authorization: Bearer nbo_sandbox_…" \
  -H "Content-Type: application/json" \
  -d '{ "customerId": "{customerId}", "behavior": "success" }'
```

**TypeScript**

```ts
const method = await nbo("/v1/sandbox/payment-methods", {
  method: "POST",
  body: { customerId: customer.data.id, behavior: "success" },
});
// method.data.id → "nbo…pm"
```

> **Sandbox mode only**
>
> `POST /v1/sandbox/payment-methods` exists only in sandbox mode. In live, a
> customer attaches a real card, mandate, or transfer instruction. See
> [multi-rail: push and pull](/concepts/multi-rail-push-and-pull).

### Start the subscription

Put it together: subscribe the customer to the price, paying with the test
method. This produces the **first invoice** and collects it, and because
the method is `success`, it comes back **active** with a paid invoice.

**cURL**

```bash
curl -X POST https://sandbox.api.nombaone.xyz/v1/subscriptions \
  -H "Authorization: Bearer nbo_sandbox_…" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: $(uuidgen)" \
  -d '{
    "customerId": "{customerId}",
    "priceId": "{priceId}",
    "paymentMethodId": "{paymentMethodId}"
  }'
```

**TypeScript**

```ts
const sub = await nbo("/v1/subscriptions", {
  method: "POST",
  idempotencyKey: crypto.randomUUID(),
  body: {
    customerId: customer.data.id,
    priceId: price.data.id,
    paymentMethodId: method.data.id,
  },
});
// sub.data.status → "active"
```

A `201` with the standard envelope confirms it:

```json
{
  "success": true,
  "statusCode": 201,
  "data": {
    "id": "nbo749201835566sub",
    "status": "active",
    "customerId": "nbo…cus",
    "priceId": "nbo…prc",
    "currentPeriodEnd": "2026-08-03T10:14:52.004Z",
    "mode": "sandbox"
  },
  "meta": { "requestId": "req_4f9c2a7e1b0d8c3a5e6f10a2" }
}
```

That's a real subscription. `data.id` is its public reference: the same id
joins its invoices, its [ledger](/concepts/the-ledger) postings, and its
webhooks.

## What just happened

The subscription opened a cycle, finalized an invoice for ₦2,500, collected it
over the test method, and posted the movement to the ledger: the whole
[billing loop](/concepts/how-billing-works), once. Next period it runs again on
its own.

## Going further

The four calls above are the happy path. The parts that make billing real in
Nigeria are one link away:

- **[When the charge fails](/concepts/hard-parts/dunning-for-thin-balances)**: 
Thin balances mean a failed charge is usually "not yet," not "no." Dunning
owns recovery.
- **[Cards need OTP](/concepts/hard-parts/card-tokens-expire)**: 
A recurring card charge in Nigeria often hits a bank OTP step. See how the
engine recovers with a fresh checkout link.
- **[Pick a rail](/concepts/multi-rail-push-and-pull)**: 
Card, direct debit, and bank transfer bill differently. One is pushed, not
pulled.
- **[Handle webhooks](/guides/handle-webhooks)**: 
Everything above fires an event. Receive, verify, and dedupe them to keep one
correct balance.

> **Trials, proration, and idempotency**
>
> `POST /v1/subscriptions` also takes `trialDays`, `quantity`, and
> `collectionMethod`; every money-moving call takes an `Idempotency-Key` so a
> retry never double-charges. These are covered in
> [start a subscription](/guides/start-a-subscription) and
> [the ledger](/concepts/the-ledger#idempotency-lives-here-too).
