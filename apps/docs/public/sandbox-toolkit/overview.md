---
title: "Sandbox toolkit overview"
type: reference
summary: "Drive the engine deterministically on the sandbox — deterministic payment outcomes, a sandbox clock to skip the wait, and on-demand signed webhooks. No real card, no cron."
canonical: https://docs.nombaone.xyz/sandbox-toolkit/overview
---

# Sandbox toolkit overview

Testing a billing engine is hard for three reasons: you can't wait a month for the
next cycle, you can't reliably make a real card decline, and the sandbox sends no
organic webhooks. The **sandbox toolkit** solves all three — a set of `/v1/sandbox/*`
instruments, available only in sandbox mode, that make the engine behave
exactly how you need to rehearse a flow.

> **Sandbox mode only, live behavior identical**
>
> Every `/v1/sandbox/*` route exists only in sandbox mode — that is, when you
> authenticate with an `nbo_sandbox_` key. Live behaves byte-identically minus these
> shortcuts — the sandbox toolkit changes *how you trigger* a path, never *what the
> path does*.

## The three instruments

- **[Sandbox payment methods](/sandbox-toolkit/payment-methods)** — 
Attach a method that succeeds, declines, or demands OTP — on purpose.
- **[The sandbox clock](/sandbox-toolkit/clock)** — 
Advance a subscription's next cycle on demand — no month-long wait.
- **[Simulate webhooks](/sandbox-toolkit/simulate-webhooks)** — 
Fire a real, signed event to your endpoint whenever you want.
- **[Verify in your devtools](/getting-started/verify-in-your-devtools)** — 
The one-click flow that ties a simulate to in-browser verification.

## Rehearse the whole lifecycle

Together the three let you drive a complete billing story in seconds:

1. Attach a `requires_otp` method → start a subscription → get `invoice.action_required`.
2. Swap to a `success` method → advance the cycle → watch it collect and settle.
3. Simulate `invoice.payment_failed` → confirm your dunning handling fires.

Every step is a real sandbox call with a genuine `X-Request-Id`. Nothing is
mocked — see [agent-native docs](/agents) for the same honesty guarantee applied
to the docs themselves.
