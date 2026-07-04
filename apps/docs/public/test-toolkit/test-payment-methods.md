---
title: "Test payment methods"
type: reference
summary: "Attach a deterministic payment method on the sandbox — its behavior decides the outcome, so you can rehearse success, decline, and card-OTP paths on demand."
canonical: https://docs.nombaone.xyz/test-toolkit/test-payment-methods
---

# Test payment methods

In live, whether a charge succeeds depends on the customer's real card and bank —
which you can't control while testing. On the sandbox, you attach a **deterministic**
payment method whose `behavior` decides the outcome every time. This is how you
rehearse the unhappy paths a happy demo skips.

## Create one

```bash
curl -X POST https://sandbox.api.nombaone.xyz/v1/test/payment-methods \
  -H "Authorization: Bearer nbo_test_…" \
  -H "Content-Type: application/json" \
  -d '{ "customerId": "{customerId}", "behavior": "success", "kind": "card" }'
```

The returned method attaches to the customer like any other; charge it by starting
a [subscription](/guides/start-a-subscription). Its behavior fires the same way
every cycle.

## The behaviors

| `behavior` | What happens | Rehearses |
|---|---|---|
| `success` | The charge is accepted. | The happy path. |
| `requires_otp` | The charge needs customer authentication (OTP/3DS). | The card-OTP → checkout-link branch. |
| `decline_insufficient_funds` | Declined for a thin balance. | [Dunning](/guides/dunning-and-recovery) on a "not yet." |
| `decline_expired_card` | Declined — the card expired. | A card-update prompt. |
| `decline_do_not_honor` | Declined by the issuer generically. | A hard decline. |

`kind` is `card` or `mandate` — use `mandate` to rehearse the silent direct-debit
rail, `card` for the OTP-prone one.

> **requires_otp is the one to rehearse most**
>
> A recurring card charge in Nigeria frequently hits OTP, and it can't complete
> headlessly. `requires_otp` lets you drive `invoice.action_required` and confirm
> your handler sends the customer the fresh checkout link — see
> [card tokens expire](/concepts/hard-parts/card-tokens-expire).

- **[The test clock](/test-toolkit/test-clock)** — 
Advance the cycle to see the method charged again.
- **[Dunning and recovery](/guides/dunning-and-recovery)** — 
What the decline behaviors let you rehearse.
