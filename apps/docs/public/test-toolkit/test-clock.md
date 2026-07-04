---
title: "The test clock"
type: reference
summary: "Advance a subscription's next cycle on demand — rehearse a renewal, a proration, or a dunning retry in seconds instead of waiting a real billing period."
canonical: https://docs.nombaone.xyz/test-toolkit/test-clock
---

# The test clock

A subscription bills on a repeating cycle — monthly, yearly. You can't wait a
month to test the second charge. The **test clock** advances a subscription's next
cycle immediately, running the same billing loop the scheduler would run on the
real billing date: open the cycle, finalize the invoice, collect it, post to the
ledger.

## Advance a cycle

```bash
curl -X POST \
  https://sandbox.api.nombaone.xyz/v1/test/subscriptions/{id}/advance-cycle \
  -H "Authorization: Bearer nbo_test_…"
```

No body — it advances the target subscription by exactly one cycle and returns the
updated subscription with its new period and the invoice the cycle produced.

## What it lets you rehearse

- **A clean renewal** — with a `success` method, watch the next invoice collect and
the period advance.
- **A failed renewal → dunning** — with a `decline_insufficient_funds` method, watch
the cycle fail, the subscription move to `past_due`, and dunning begin.
- **A proration** — schedule a plan change, then advance to see the prorated invoice
the [change](/guides/proration-and-plan-changes) produces.
- **A trial ending** — advance a `trialing` subscription to its first real charge.

> **It runs the real loop, not a shortcut**
>
> Advancing the clock executes the exact cycle logic the production scheduler runs
> — it just triggers it now instead of on the calendar. What you see is what live
> will do. See [how billing works](/concepts/how-billing-works).

> **Test deployment only**
>
> `advance-cycle` exists only on the sandbox. In live, cycles advance on their real
> billing dates, driven by the scheduler — there is no way to force a live charge
> early.

- **[Test payment methods](/test-toolkit/test-payment-methods)** — 
Choose the outcome the advanced cycle produces.
- **[Simulate webhooks](/test-toolkit/simulate-webhooks)** — 
Fire the events a cycle would emit, directly.
