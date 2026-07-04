---
title: "Start a subscription"
type: how-to
summary: "Subscribe a customer to a price over any rail — card, direct debit, or bank transfer. The subscription is the same; only how the money arrives differs."
canonical: https://docs.nombaone.xyz/guides/start-a-subscription
---

# Start a subscription

A subscription puts a **customer** on a **price** and bills it every cycle. The
subscription resource is rail-agnostic — the same `POST /v1/subscriptions` starts
a card subscription, a direct-debit subscription, or a transfer subscription. What
differs is the **payment method** you attach, because rails collect differently:
card and mandate are *pulled*, a bank transfer is *pushed*. See
[multi-rail: push and pull](/concepts/multi-rail-push-and-pull) for why that
asymmetry matters.

## Set up a payment method

Pull rails need an authorized instrument on file. Start a setup — the customer
authorizes (and, for a card, may complete a bank OTP step) at the returned link:

```bash
curl -X POST https://sandbox.api.nombaone.xyz/v1/payment-methods/setup \
  -H "Authorization: Bearer nbo_sandbox_…" \
  -H "Content-Type: application/json" \
  -d '{
    "customerRef": "{customerId}",
    "amountInKobo": 250000,
    "callbackUrl": "https://yourapp.com/billing/return"
  }'
```

The customer is sent to complete authorization, then returned to your
`callbackUrl`. The resulting payment method is what you charge each cycle.

For a **bank transfer** subscription, mint a virtual account instead — the
customer pushes money to it on each billing date:

```bash
curl -X POST https://sandbox.api.nombaone.xyz/v1/payment-methods/virtual-account \
  -H "Authorization: Bearer nbo_sandbox_…" \
  -H "Content-Type: application/json" \
  -d '{ "customerRef": "{customerId}", "expectedAmount": 250000 }'
```

> **Rehearse deterministically in test**
>
> On the sandbox, skip the hosted step: `POST /v1/sandbox/payment-methods` with a
> `behavior` (`success`, `requires_otp`, `decline_insufficient_funds`)
> gives you a method with a known outcome, so you can rehearse both the happy and
> the unhappy paths before real money is involved.

## Start the subscription

Subscribe the customer to the price with the method:

```bash
curl -X POST https://sandbox.api.nombaone.xyz/v1/subscriptions \
  -H "Authorization: Bearer nbo_sandbox_…" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: $(uuidgen)" \
  -d '{
    "customerId": "{customerId}",
    "priceId": "{priceId}",
    "paymentMethodId": "{paymentMethodId}",
    "collectionMethod": "charge_automatically"
  }'
```

The response `status` tells you where the first cycle landed:

- **`active`** — the first invoice was collected. You're billing.
- **`trialing`** — the price has a trial; no charge yet.
- **`past_due`** — the first charge failed; [dunning](/guides/dunning-and-recovery)
now owns recovery. On a thin balance this usually means "not yet," not "no."
- **`incomplete`** — the charge needs the customer to act (a card OTP step); an
`invoice.action_required` event carries a fresh checkout link.

> **Don't assume the first charge succeeds**
>
> In Nigeria the first pull can need OTP, or land on a thin balance. Handle
> `past_due` and `incomplete` from day one — branch on the webhook, not just the
> `201`. This is the difference between a toy and a billing system.

## Optional: trials and quantity

- **`trialDays`** on the create call starts a trial even if the price has none.
- **`quantity`** multiplies a per-seat price.
- **`Idempotency-Key`** makes the create safe to retry — a repeat with the same
key returns the same subscription, never a second one.

## After it's live

- **[Handle webhooks](/guides/handle-webhooks)** — 
Every state change fires an event. Receive and verify them for one correct
balance.
- **[Change the payment method](/guides/refunds-payouts-settlement)** — 
Swap a card, retry a failed rail, or move a customer to direct debit.
