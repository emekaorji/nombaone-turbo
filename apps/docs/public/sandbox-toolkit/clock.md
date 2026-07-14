---
title: "The sandbox clock"
type: reference
summary: "Advance a subscription's next cycle on demand: rehearse a renewal, a proration, or a dunning retry in seconds instead of waiting a real billing period."
canonical: https://docs.nombaone.xyz/sandbox-toolkit/clock
---

# The sandbox clock

A subscription bills on a repeating cycle, and most of them are long: monthly,
yearly. You can't wait a month to test the second charge. The **sandbox clock**
advances a subscription's next
cycle immediately, running the same billing loop the scheduler would run on the
real billing date: open the cycle, finalize the invoice, collect it, post to the
ledger.

> **When you want the scheduler itself in the loop**
>
> The sandbox clock calls the billing loop directly, so it proves the *billing*
> math without waiting — but it bypasses the scheduler and the queue that would
> normally trigger it. When you want to watch the whole chain fire on its own, give
> the price a short wall-clock cadence instead (`interval: "minute"`,
> `intervalCount: 10`) and let the real sweep pick it up. Slower, but nothing is
> stubbed. See [create plans and prices](/guides/create-plans-and-prices).

## Advance a cycle

```bash
curl -X POST \
  https://sandbox.api.nombaone.xyz/v1/sandbox/subscriptions/{id}/advance-cycle \
  -H "Authorization: Bearer nbo_sandbox_…"
```

No body. It advances the target subscription by exactly one cycle and returns the
updated subscription with its new period and the invoice the cycle produced.

## What it lets you rehearse

- **A clean renewal**: with a `success` method, watch the next invoice collect and
the period advance.
- **A failed renewal → dunning**: with a `decline_insufficient_funds` method, watch
the cycle fail, the subscription move to `past_due`, and dunning begin.
- **A proration**: schedule a plan change, then advance to see the prorated invoice
the [change](/guides/proration-and-plan-changes) produces.
- **A trial ending**: advance a `trialing` subscription to its first real charge.

> **It runs the real loop, not a shortcut**
>
> Advancing the clock executes the exact cycle logic the production scheduler runs.
> It just triggers it now instead of on the calendar. What you see is what live
> will do. See [how billing works](/concepts/how-billing-works).

> **Sandbox mode only**
>
> `advance-cycle` exists only in sandbox mode. In live, cycles advance on their real
> billing dates, driven by the scheduler. There is no way to force a live charge
> early.

- **[Sandbox payment methods](/sandbox-toolkit/payment-methods)**: 
Choose the outcome the advanced cycle produces.
- **[Simulate webhooks](/sandbox-toolkit/simulate-webhooks)**: 
Fire the events a cycle would emit, directly.
