---
title: "Events"
type: reference
summary: "The domain-event stream and its catalog: list events, read one, and fetch the machine-readable catalog. Generated from the live schema."
canonical: https://docs.nombaone.xyz/reference/events
---

# Events

An **event** is a record of something that happened: the same events delivered by
[webhooks](/webhooks/overview), also readable as a stream. Use this to reconcile
after downtime, or to pull the machine-readable catalog for code generation. For
the human catalog, see the [event catalog](/webhooks/event-catalog).

> **Interactive: `<ApiReference>`.** View and run it live at https://docs.nombaone.xyz/reference/events

> **Events are the reconciliation backstop**
>
> If your endpoint missed deliveries, list events rather than reconstructing state
> from guesses. Every event carries the resource `reference` so you can re-fetch
> the source of truth. Delivery is
> [at-least-once](/webhooks/delivery-guarantee).
