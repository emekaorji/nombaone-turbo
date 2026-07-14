---
title: "Create plans and prices"
type: how-to
summary: "Model your pricing: plans hold the product, prices hold the money. Set intervals, trials, and multiple prices on one plan."
canonical: https://docs.nombaone.xyz/guides/create-plans-and-prices
---

# Create plans and prices

Pricing in nombaone is two resources: a **plan** is the product a customer
subscribes to, and a **price** is how much and how often. Keeping them separate
means one plan (say, "Pro") can carry a monthly price and a yearly price at once,
and a customer moves between them without you re-modelling the product.

## Create a plan and its prices in one call

Send the plan with a `prices` array and you get the whole catalog entry in one
request — the product and every cadence it sells on:

```bash
curl -X POST https://sandbox.api.nombaone.xyz/v1/plans \
  -H "Authorization: Bearer nbo_sandbox_…" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: $(uuidgen)" \
  -d '{
    "name": "Pro",
    "description": "Everything in the Pro tier",
    "prices": [
      { "unitAmountInKobo": 500000, "interval": "month" },
      { "unitAmountInKobo": 5000000, "interval": "year" }
    ]
  }'
```

That is ₦5,000 a month or ₦50,000 a year — two months free on the annual price.
The response carries `data.prices` in the order you sent them.

The call is **atomic**: either the plan and every price land, or nothing does. A
rejected price never creates a half-built plan, so you cannot end up with a plan
that has no price and cannot be billed.

> **Embedding prices needs `prices:write`**
>
> A key with only `plans:write` can still create a bare plan, but embedding
> `prices` also requires `prices:write` — otherwise the call is rejected with
> `API_KEY_SCOPE_FORBIDDEN`. Ship at most 10 prices, and no two on the same
> cadence (`interval` + `intervalCount`).

## Add a price later

Prices are immutable and a plan collects them over its lifetime, so you add a new
cadence — or a new amount — by posting to the plan. `data.id` from the create
above is the plan's reference:

```bash
curl -X POST https://sandbox.api.nombaone.xyz/v1/plans/{planId}/prices \
  -H "Authorization: Bearer nbo_sandbox_…" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: $(uuidgen)" \
  -d '{
    "unitAmountInKobo": 250000,
    "interval": "month",
    "intervalCount": 1
  }'
```

`250000` is ₦2,500.00.

A cadence is a **unit times a count**. `interval` is one of `minute`, `day`,
`week`, `month` or `year`; `intervalCount` multiplies it. So `interval: "month"`
with `intervalCount: 3` bills quarterly, and `interval: "minute"` with
`intervalCount: 10` bills every ten minutes. There is no separate `quarterly` or
`ten_minutely` — the count covers every multiple of a unit we already have.

> **Money is integer kobo**
>
> Every money field ends in `InKobo`. Send `250000` for ₦2,500, never `2500`.
> This is the [100× trap](/concepts/money-is-integer-kobo).

> **Sub-day cadences bill on the wall clock**
>
> `day`, `week`, `month` and `year` are **calendar** cadences: a boundary lands on
> a calendar date at 02:00 (Africa/Lagos), and month and year snap the end of the
> month against your anchor day — a Jan-31 anchor bills Feb-28, then Mar-31.
> `minute` is a **wall-clock** cadence: it bills at an exact offset from the
> instant the subscription activated, so a ten-minute subscription started at
> 14:37 renews at 14:47. It is mostly useful for watching a real renewal loop run
> in the time you have, rather than [advancing the clock](/sandbox-toolkit/clock)
> by hand — but it is a real cadence, valid in both sandbox and live.

## Change what a plan costs

Raising the monthly price is an edit to the **plan** — not a scavenger hunt
through its price rows. `PATCH /v1/plans/{id}` takes the same `prices` array the
create call takes, and reconciles it against what the plan already costs. Send
what you want the plan to cost:

```bash
curl -X PATCH https://sandbox.api.nombaone.xyz/v1/plans/{planId} \
  -H "Authorization: Bearer nbo_sandbox_…" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: $(uuidgen)" \
  -d '{
    "prices": [
      { "unitAmountInKobo": 600000, "interval": "month" },
      { "unitAmountInKobo": 5000000, "interval": "year" }
    ]
  }'
```

Per cadence (`interval` + `intervalCount`), the engine works out what changed:

- **Nothing priced on that cadence yet** → the price is **created**, and
`price.created` fires.
- **The amount is the same** → **nothing happens**. No row is written, no event is
emitted. Resending your current catalog is a no-op, which is what makes a "save"
button on a pricing form safe to press twice.
- **The amount is different** → a **new price is created**, and every other active
price on that cadence is **deactivated**. You get a `price.created` and a
`price.deactivated`.

The canonical price for a cadence is the **newest active** one. If a plan somehow
carries two active prices on the same cadence — an older plan built one price at a
time can — then editing that cadence settles it: the newest stays, the rest are
deactivated, and you get a `price.deactivated` for each. Otherwise row order would
be deciding what a new subscriber pays.

A cadence you **don't** send is left completely alone. In the call above the yearly
price was resent unchanged, so it keeps its `id`; the monthly one moved from ₦5,000
to ₦6,000, so it comes back with a new one:

```json
{
  "success": true,
  "statusCode": 200,
  "data": {
    "domain": "plan",
    "id": "nbo481920374615pln",
    "name": "Pro",
    "status": "active",
    "prices": [
      {
        "domain": "price",
        "id": "nbo903117254480prc",
        "planId": "nbo481920374615pln",
        "unitAmountInKobo": 600000,
        "currency": "NGN",
        "interval": "month",
        "intervalCount": 1,
        "active": true
      },
      {
        "domain": "price",
        "id": "nbo225864019773prc",
        "planId": "nbo481920374615pln",
        "unitAmountInKobo": 5000000,
        "currency": "NGN",
        "interval": "year",
        "intervalCount": 1,
        "active": true
      }
    ]
  },
  "meta": { "requestId": "req_4f9c2a7e1b0d8c3a5e6f10a2" }
}
```

`data.prices` is the plan's **active** prices after the update, and it is always
there — the shape doesn't depend on whether you sent any. Omitting `prices`
entirely still edits only `name`, `description` and `metadata`, exactly as before.

### Why a change is a new price, not an edit

A price is **immutable**: its `unitAmountInKobo` is never rewritten in place. A
subscription pins a `priceId`, and that pinned row is the only reason an existing
subscriber's bill cannot move under them. Rewriting the amount on the row would
re-price every subscriber holding it — retroactively, including invoices already
issued against it. So a change mints a **new** row and retires the old one, which
stays exactly as it was, still saying what your existing subscribers agreed to pay.

Grandfathering is a property of the data model, not a feature someone remembered to
build. New subscribers reach the new price; the ones already billing keep theirs
until you deliberately move them, which is a
[plan change](/guides/proration-and-plan-changes).

> **Sending `prices` needs `prices:write`**
>
> Same guard as `POST /v1/plans`. A `plans:write` key can rename a plan or edit its
> description, but the moment `prices` is present the key must **also** hold
> `prices:write` — that array mints and retires price rows. Without it the call is
> rejected with `API_KEY_SCOPE_FORBIDDEN`, before any write.

## Watch a subscription bill

A monthly subscription takes a month to prove it renews. `interval: "minute"` with
`intervalCount: 10` proves it over lunch:

```bash
curl -X POST https://sandbox.api.nombaone.xyz/v1/plans/{planId}/prices \
  -H "Authorization: Bearer nbo_sandbox_…" \
  -H "Content-Type: application/json" \
  -d '{ "unitAmountInKobo": 50000, "interval": "minute", "intervalCount": 10 }'
```

Put a customer on that price and ten minutes later the renewal happens on its own,
with nothing stubbed: `invoice.created`, `invoice.finalized`, the charge, then
`invoice.paid`, ledger postings, and the subscription's period rolls forward. It
runs through the **same** engine `month` runs through — the cadence is the only
thing that differs, and nothing in the billing path special-cases it. So what you
watch work in ten minutes is what will work in thirty days.

It is a first-class cadence: valid in live, not just sandbox. Sell a ten-minute
subscription if you have a use for one.

> **It needs a per-minute billing sweep**
>
> Renewals land when the billing sweep runs, so a minute cadence only bills on time
> if the sweep ticks every minute — `BILLING_SWEEP_CRON=* * * * *`, which is now the
> default. A subscription is never **parked**: what it owes stays due, and every tick
> bills the periods it is behind, oldest first. But a single tick works off at most
> `BILLING_MAX_CATCH_UP_PERIODS` (36) of them, so a sweep slower than the cadence
> loses ground — a daily sweep against a ten-minute price sees 144 periods fall due
> each day and clears 36, and the subscription drifts further behind every day it
> runs. Keep the sweep ticking faster than the shortest cadence you sell.

## Add a trial

Set `trialPeriodDays` on the price. A subscription started on it enters
`trialing`: no charge until the trial ends, then the first invoice is collected.

```bash
curl -X POST https://sandbox.api.nombaone.xyz/v1/plans/{planId}/prices \
  -H "Authorization: Bearer nbo_sandbox_…" \
  -H "Content-Type: application/json" \
  -d '{ "unitAmountInKobo": 250000, "interval": "month", "trialPeriodDays": 14 }'
```

## Multiple prices on one plan

Create as many prices on a plan as you sell it: monthly and yearly, NGN tiers,
a promotional rate. A subscription references a **price**, not a plan, so
switching a customer from monthly to yearly is a
[plan change](/guides/proration-and-plan-changes) to a different price on the
same plan, proration handled for you.

## Archiving

Plans archive (`POST /v1/plans/{id}/archive`) and prices deactivate
(`POST /v1/prices/{id}/deactivate`) so you stop new subscriptions on them without
touching the ones already billing. Existing subscriptions keep their price;
archiving only prevents new use.

- **[Start a subscription](/guides/start-a-subscription)**: 
Put a customer on a price, over any rail.
- **[Proration and plan changes](/guides/proration-and-plan-changes)**: 
Move a customer between prices mid-cycle, correctly.
