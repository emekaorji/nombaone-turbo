---
title: "Simulate an event"
type: reference
summary: "Fire a real, signed event to your endpoint on demand: the honest substitute for a sandbox that sends no organic webhooks. Sandbox mode only."
canonical: https://docs.nombaone.xyz/webhooks/simulate
---

# Simulate an event

The Nomba sandbox does not push webhooks on its own. Rather than pretend it does,
nombaone gives you a way to **fire a real, signed event whenever you want**, so you
can build and test your handler against genuine traffic: the same shape, the same
signature scheme, the same delivery pipeline as production. This is the honest
substitute, and it is clearly sandbox-only.

> **Real, not mocked, and sandbox-only**
>
> A simulated event is signed with your endpoint's real secret and delivered
> through the real pipeline. It is **not** a fake payload or a `setTimeout`. Your
> verification code will pass against it exactly as it will in production.
> `simulate` exists only in sandbox mode; it is not available in live.

## Fire an event

Ask the instrument to emit any catalog event to your registered endpoints:

```bash
curl -X POST https://sandbox.api.nombaone.xyz/v1/sandbox/webhooks/simulate \
  -H "Authorization: Bearer nbo_sandbox_…" \
  -H "Content-Type: application/json" \
  -d '{ "type": "invoice.paid" }'
```

Pass any type from the [event catalog](/webhooks/event-catalog). To shape the
body, include a `payload`:

```bash
curl -X POST https://sandbox.api.nombaone.xyz/v1/sandbox/webhooks/simulate \
  -H "Authorization: Bearer nbo_sandbox_…" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "invoice.action_required",
    "payload": { "reference": "nbo749201835566inv", "reason": "otp_required" }
  }'
```

The event arrives at your endpoint signed and complete. Verify it exactly as you
would a production delivery.

## Test both halves of a flow

Simulate is how you rehearse the paths a happy demo skips:

- **`invoice.paid`**: the success path; grant access.
- **`invoice.payment_failed`**: dunning begins; don't churn yet.
- **`invoice.action_required`**: send the customer the checkout link.
- **`invoice.payment_recovered`**: restore state after recovery.

> **At-least-once, even here**
>
> Simulated deliveries follow the same [delivery
> guarantee](/webhooks/delivery-guarantee). Dedupe on the event id. Firing the
> same event twice must be a no-op in your handler.

## Do it interactively

The [verify us in your devtools](/getting-started/verify-in-your-devtools) page
wraps this call in a one-click flow and shows the signature verifying in your
browser, the fastest way to prove your endpoint works before you write a line of
handler code.

- **[Event catalog](/webhooks/event-catalog)**: 
Every type you can simulate.
- **[Verify us in your devtools](/getting-started/verify-in-your-devtools)**: 
The interactive fire-and-verify flow.
