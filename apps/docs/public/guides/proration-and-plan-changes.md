---
title: "Proration and plan changes"
type: how-to
summary: "Upgrade, downgrade, or switch intervals mid-cycle — one call, with proration computed as balanced ledger legs so the customer is charged exactly the difference."
canonical: https://docs.nombaone.xyz/guides/proration-and-plan-changes
---

# Proration and plan changes

A customer rarely stays on one price forever. They upgrade, downgrade, add seats,
or switch from monthly to yearly — usually **mid-cycle**, when they've already
paid for part of the period. A plan change moves the subscription to a new price
and settles the difference, and because
[proration is a ledger problem](/concepts/hard-parts/proration-is-a-ledger-problem)
it's computed in balanced kobo legs, not floating-point guesses.

## Change the price

Point the subscription at a different price. One call handles the switch and the
proration:

```bash
curl -X POST https://sandbox.api.nombaone.xyz/v1/subscriptions/{id}/change \
  -H "Authorization: Bearer nbo_test_…" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: $(uuidgen)" \
  -d '{ "priceId": "{newPriceId}", "prorationBehavior": "create_prorations" }'
```

The engine credits the unused portion of the old price and charges the used
portion of the new one, to the exact kobo. On an **upgrade** the customer pays the
difference now; on a **downgrade** the credit applies to the next invoice.

## Preview before you commit

Show the customer the exact cost of a change before making it:

```bash
curl https://sandbox.api.nombaone.xyz/v1/subscriptions/{id}/upcoming-invoice \
  -H "Authorization: Bearer nbo_test_…"
```

The upcoming invoice reflects proration lines so there are no surprises on the
next bill.

## Switch intervals

Moving monthly → yearly is a change to a price with a different `interval` on the
same plan. Set `intervalSwitch: true` so the engine aligns the billing anchor:

```bash
curl -X POST https://sandbox.api.nombaone.xyz/v1/subscriptions/{id}/change \
  -H "Authorization: Bearer nbo_test_…" \
  -H "Content-Type: application/json" \
  -d '{ "priceId": "{yearlyPriceId}", "intervalSwitch": true }'
```

## Control the proration behavior

- **`create_prorations`** — compute and apply the difference (the default for
upgrades).
- **`none`** — switch the price with no proration; the new amount applies from the
next cycle.

> **Quantity changes prorate too**
>
> Adding or removing seats mid-cycle is the same mechanism — pass `quantity` to
> `change`, and the per-seat difference prorates exactly like a price switch.

> **Schedule a change for the next renewal**
>
> To avoid mid-cycle proration entirely, schedule the change to take effect at the
> next period boundary with `POST /v1/subscriptions/{id}/schedule` — the customer
> finishes the paid period, then renews on the new price.

- **[Why proration is a ledger problem](/concepts/hard-parts/proration-is-a-ledger-problem)** — 
How fractional kobo resolve so the legs always balance.
- **[Create plans and prices](/guides/create-plans-and-prices)** — 
Model the prices a customer moves between.
