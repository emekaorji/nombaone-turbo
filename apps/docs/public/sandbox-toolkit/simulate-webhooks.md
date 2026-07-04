---
title: "Simulate webhooks"
type: reference
summary: "Emit and deliver any catalog event on demand — a real, signed payload to your endpoint, the honest substitute for a sandbox that sends no organic webhooks."
canonical: https://docs.nombaone.xyz/sandbox-toolkit/simulate-webhooks
---

# Simulate webhooks

The sandbox does not push webhooks on its own, so the toolkit lets you **fire any
event yourself** — a real, signed payload delivered through the real pipeline to
your registered endpoint. It is the same instrument the
[verify-in-your-devtools](/getting-started/verify-in-your-devtools) flow wraps in
one click.

## Fire an event

```bash
curl -X POST https://sandbox.api.nombaone.xyz/v1/sandbox/webhooks/simulate \
  -H "Authorization: Bearer nbo_sandbox_…" \
  -H "Content-Type: application/json" \
  -d '{ "type": "invoice.paid" }'
```

Pass any `type` from the [event catalog](/webhooks/event-catalog). Add a `payload`
to shape the body:

```bash
curl -X POST https://sandbox.api.nombaone.xyz/v1/sandbox/webhooks/simulate \
  -H "Authorization: Bearer nbo_sandbox_…" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "invoice.action_required",
    "payload": { "reference": "nbo749201835566inv", "reason": "otp_required" }
  }'
```

The event arrives signed with your endpoint's secret — verify it exactly as you
would a production delivery.

> **Real and signed, not mocked**
>
> A simulated event is a genuine signed payload, identical in shape and signature
> scheme to production. Your verification code passes against it unchanged. It is
> the honest substitute for organic delivery, not a stand-in.

> **At-least-once, even here**
>
> Simulated deliveries follow the same
> [delivery guarantee](/webhooks/delivery-guarantee) — dedupe on the event id.
> Firing the same event twice must be a no-op in your handler.

- **[Verify in your devtools](/getting-started/verify-in-your-devtools)** — 
The one-click fire-and-verify flow.
- **[Handle webhooks](/guides/handle-webhooks)** — 
Build the idempotent handler these events drive.
