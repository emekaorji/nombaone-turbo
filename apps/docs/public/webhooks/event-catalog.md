---
title: "Event catalog"
type: reference
summary: "Every event nombaone can emit, when it fires, and its payload — rendered directly from the API's canonical catalog, so it can never drift."
canonical: https://docs.nombaone.xyz/webhooks/event-catalog
---

# Event catalog

This is the complete list of events nombaone emits. It is generated from the
API's own event catalog, so it is provably complete — every event the API can
send has an entry here, and none can ship undocumented. Deep-link any event by
its type, e.g. [`/webhooks#invoice.paid`](/webhooks/event-catalog#invoice.paid).

Every event shares one shape: a `type`, a stable `reference` (the `nbo…` id of
the resource it's about), and a small typed payload. Subscribe to only the
events you need with `enabledEvents` when you
[register an endpoint](/guides/handle-webhooks).

> **Interactive — `<EventCatalog>`.** View and run it live at https://docs.nombaone.xyz/webhooks/event-catalog

> **One reference, everywhere**
>
> The `reference` on an event is the same public id the resource carries in the
> API and in the [ledger](/concepts/the-ledger). Given an `invoice.paid` event
> you can `GET` that invoice, find its settlement, and trace its postings — one
> name across the whole system.
