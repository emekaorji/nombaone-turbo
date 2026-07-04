---
title: "Coupons and credits"
type: how-to
summary: "Two ways to reduce what a customer pays — a coupon discounts an invoice by a percentage or a fixed amount, a credit grant is a balance that draws down first."
canonical: https://docs.nombaone.xyz/guides/coupons-and-credits
---

# Coupons and credits

There are two distinct tools for charging a customer less, and they resolve
differently on an invoice. A **coupon** is a discount rule (percent or fixed) you
attach to a customer or subscription. A **credit** is a stored balance that draws
down before any charge. Both land in the [ledger](/concepts/the-ledger) as
explicit lines, so an invoice always shows exactly why the total is what it is.

## Create a coupon

A coupon has a `code`, an amount off (percentage **or** a fixed kobo amount), and
a `duration` that controls how long it applies:

```bash
# 20% off for the first 3 cycles
curl -X POST https://sandbox.api.nombaone.xyz/v1/coupons \
  -H "Authorization: Bearer nbo_test_…" \
  -H "Content-Type: application/json" \
  -d '{ "code": "LAUNCH20", "percentOff": 20, "duration": "repeating", "durationInCycles": 3 }'
```

```bash
# ₦500 off, once
curl -X POST https://sandbox.api.nombaone.xyz/v1/coupons \
  -H "Authorization: Bearer nbo_test_…" \
  -H "Content-Type: application/json" \
  -d '{ "code": "SAVE500", "amountOffInKobo": 50000, "duration": "once" }'
```

`duration` is `once` (next invoice only), `repeating` (for `durationInCycles`
cycles), or `forever`. Optionally cap it with `maxRedemptions` and `redeemBy`.

## Apply a coupon

Attach it to a whole customer or a single subscription:

```bash
# To a subscription
curl -X POST https://sandbox.api.nombaone.xyz/v1/subscriptions/{id}/discount \
  -H "Authorization: Bearer nbo_test_…" \
  -H "Content-Type: application/json" \
  -d '{ "coupon": "LAUNCH20" }'
```

```bash
# To a customer (applies to all their subscriptions)
curl -X POST https://sandbox.api.nombaone.xyz/v1/customers/{id}/discount \
  -H "Authorization: Bearer nbo_test_…" \
  -H "Content-Type: application/json" \
  -d '{ "coupon": "LAUNCH20" }'
```

`DELETE` the same path removes the discount.

## Grant a credit

A credit is money on the customer's account that draws down before any charge —
useful for refunds-as-credit, goodwill, or prepaid balances:

```bash
curl -X POST https://sandbox.api.nombaone.xyz/v1/customers/{id}/credit \
  -H "Authorization: Bearer nbo_test_…" \
  -H "Content-Type: application/json" \
  -d '{ "amountInKobo": 100000, "source": "goodwill" }'
```

> **Credits draw down oldest-first**
>
> When an invoice is collected, available credit is applied before the rail is
> charged, oldest grant first. The invoice shows the credit line and the reduced
> amount actually charged — every kobo accounted for in the ledger.

## Coupon vs credit — which to use

- **Coupon** — a *rule* that reduces the price (a promo, a discounted tier). It
recomputes each cycle for its duration.
- **Credit** — a *balance* that is spent once, then gone. Use it for refunds you
want kept on-platform, or prepaid top-ups.

> **They stack in a defined order**
>
> On one invoice, credits and coupons both apply — the discount reduces the
> amount due, then credit draws down the remainder. The order is fixed and shown
> on the invoice, so the result is never ambiguous.

- **[The ledger](/concepts/the-ledger)** — 
How discounts and credits post as auditable lines.
- **[Start a subscription](/guides/start-a-subscription)** — 
Where a discounted subscription begins.
