---
title: "Dunning and recovery"
type: how-to
summary: "Recover a failed charge on a thin balance the Nigerian way: retries tuned for \"not yet,\" a card-OTP checkout link, and the events that tell you when to restore access."
canonical: https://docs.nombaone.xyz/guides/dunning-and-recovery
---

# Dunning and recovery

When a charge fails, most billing systems assume "no." In Nigeria the honest read
is usually **"not yet"**: the balance is thin and will top up, or the card needs
a one-time OTP. Dunning is the engine's recovery loop for exactly this, and it is
tuned for recovery, not just blind retries. See
[dunning for thin balances](/concepts/hard-parts/dunning-for-thin-balances) for
the reasoning; this guide is how you operate it.

## What happens on a failed charge

When a cycle's collection fails, the subscription moves to `past_due` and dunning
takes over automatically:

1. `invoice.payment_failed` fires with a **real failure reason** to branch on
(insufficient funds, card expired, OTP required, not a generic "declined").
2. Dunning schedules retries on its own cadence, no action needed from you.
3. Each retry either recovers (→ `invoice.payment_recovered`, subscription
`active`) or exhausts the schedule (→ the subscription stays `past_due` or
cancels, per your policy).

> **Don't cut off access on the first failure**
>
> `past_due` is not `canceled`. On a thin balance the retry often succeeds within
> hours. Cutting access on `invoice.payment_failed` churns customers who would
> have paid. Wait for the dunning schedule to exhaust, or for
> `subscription.canceled`.

## The card-OTP branch

A recurring **card** charge in Nigeria often triggers a bank OTP/3-D Secure step
that can't complete headlessly. When that happens, dunning does not silently
retry forever. It emits `invoice.action_required` with a **fresh checkout link**.
Send the customer to it; when they complete OTP there, the invoice settles and
the subscription recovers. This is the product answer to a rail that can't be
pulled silently. See [card tokens expire](/concepts/hard-parts/card-tokens-expire).

## Push-rail dunning: `payment_reminder`

Not every subscription can be retried at all. On the `send_invoice` lane —
bank-transfer customers, and anyone hosted checkout flipped there — the money
is *pushed*, so there is no instrument to charge again. When such an invoice
passes its due date, the subscription still moves to `past_due`, but dunning
runs the **`payment_reminder`** branch: on the same retry ladder it **re-sends
the payment link and transfer details instead of charging**. The customer pays
when the balance lands; the recovery and exhaustion mechanics are otherwise
identical.

## What your customer sees

Dunning is not silent toward the person who owes the money. At each step the
engine emails the customer directly — a renewal heads-up before the charge
(the `renewalReminderLeadHours` billing setting), the OTP checkout link when a
card needs authentication, the payment link on a reminder, a confirmation on
recovery, and a final notice on churn. All of it is gated by the
`commsEnabled` billing setting (`GET /v1/organization/billing`), so if you run
your own messaging you can turn the engine's off — but a customer who never
learns their membership is stuck is a customer you lose, so make sure exactly
one of you is talking.

## Recovery is forgiving

When a `past_due` subscription recovers, the engine **re-anchors the cycle at
the recovery**: the next period starts when the customer actually paid, and the
unserved gap between failure and recovery is not back-billed. A customer who
comes back after a week owes one period, not one period plus arrears.

## Inspect the dunning state

Read where recovery stands for a subscription:

```bash
# Current dunning status
curl https://sandbox.api.nombaone.xyz/v1/subscriptions/{id}/dunning \
  -H "Authorization: Bearer nbo_sandbox_…"

# The full attempt history
curl https://sandbox.api.nombaone.xyz/v1/subscriptions/{id}/dunning/attempts \
  -H "Authorization: Bearer nbo_sandbox_…"
```

## Rehearse it in test

Attach a test method that fails, then watch the loop run:

```bash
curl -X POST https://sandbox.api.nombaone.xyz/v1/sandbox/payment-methods \
  -H "Authorization: Bearer nbo_sandbox_…" \
  -H "Content-Type: application/json" \
  -d '{ "customerId": "{customerId}", "behavior": "decline_insufficient_funds" }'
```

Use `requires_otp` to rehearse the checkout-link branch, and
[verify us in your devtools](/getting-started/verify-in-your-devtools) to fire the
`invoice.action_required` event at your own endpoint.

## The events to handle

- **`invoice.payment_failed`**: entered dunning. Log it; don't churn yet.
- **`invoice.action_required`**: send the customer the checkout link in the payload.
- **`invoice.payment_instructions`**: a push-rail invoice is waiting on the payer;
the payload carries this invoice's dedicated transfer details.
- **`invoice.payment_recovered`**: restore normal access.
- **`subscription.churned`**: dunning exhausted; involuntary churn. Now cut access.
(A deliberate cancellation fires `subscription.canceled` instead.)

- **[Why thin balances change dunning](/concepts/hard-parts/dunning-for-thin-balances)**: 
The reasoning behind the retry cadence.
- **[Handle webhooks](/guides/handle-webhooks)**: 
Receive and verify these events correctly.
