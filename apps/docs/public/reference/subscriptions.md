---
title: "Subscriptions"
type: reference
summary: "Subscriptions — every operation on the resource."
canonical: https://docs.nombaone.xyz/reference/subscriptions
---

# Subscriptions

Every operation on the subscriptions resource.

- [`POST /v1/subscriptions`](https://docs.nombaone.xyz/reference/subscriptions/create.md) — Create a subscription
- [`GET /v1/subscriptions`](https://docs.nombaone.xyz/reference/subscriptions/list.md) — List subscriptions
- [`GET /v1/subscriptions/{id}`](https://docs.nombaone.xyz/reference/subscriptions/retrieve.md) — Retrieve a subscription
- [`PATCH /v1/subscriptions/{id}`](https://docs.nombaone.xyz/reference/subscriptions/update.md) — Update a subscription
- [`POST /v1/subscriptions/{id}/pause`](https://docs.nombaone.xyz/reference/subscriptions/pause.md) — Pause a subscription
- [`GET /v1/subscriptions/{id}/events`](https://docs.nombaone.xyz/reference/subscriptions/list-events.md) — List subscription events
- [`POST /v1/subscriptions/{id}/cancel`](https://docs.nombaone.xyz/reference/subscriptions/cancel.md) — Cancel a subscription
- [`POST /v1/subscriptions/{id}/change`](https://docs.nombaone.xyz/reference/subscriptions/change.md) — Change the plan or price
- [`POST /v1/subscriptions/{id}/resume`](https://docs.nombaone.xyz/reference/subscriptions/resume.md) — Resume a subscription
- [`GET /v1/subscriptions/{id}/dunning`](https://docs.nombaone.xyz/reference/subscriptions/dunning.md) — Retrieve dunning state
- [`DELETE /v1/subscriptions/{id}/discount`](https://docs.nombaone.xyz/reference/subscriptions/remove-discount.md) — Remove a discount
- [`DELETE /v1/subscriptions/{id}/schedule`](https://docs.nombaone.xyz/reference/subscriptions/cancel-schedule.md) — Cancel the schedule
- [`GET /v1/subscriptions/{id}/schedule`](https://docs.nombaone.xyz/reference/subscriptions/retrieve-schedule.md) — Retrieve the schedule
- [`POST /v1/subscriptions/{id}/discount`](https://docs.nombaone.xyz/reference/subscriptions/apply-discount.md) — Apply a discount
- [`POST /v1/subscriptions/{id}/schedule`](https://docs.nombaone.xyz/reference/subscriptions/create-schedule.md) — Schedule a change
- [`POST /v1/subscriptions/{id}/resubscribe`](https://docs.nombaone.xyz/reference/subscriptions/resubscribe.md) — Resubscribe a customer
- [`POST /v1/subscriptions/{id}/payment-method`](https://docs.nombaone.xyz/reference/subscriptions/update-payment-method.md) — Update the payment method
- [`GET /v1/subscriptions/{id}/dunning/attempts`](https://docs.nombaone.xyz/reference/subscriptions/dunning-attempts.md) — List dunning attempts
- [`GET /v1/subscriptions/{id}/upcoming-invoice`](https://docs.nombaone.xyz/reference/subscriptions/upcoming-invoice.md) — Preview the upcoming invoice
