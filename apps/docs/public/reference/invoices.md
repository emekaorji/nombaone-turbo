---
title: "Invoices"
type: reference
summary: "Each cycle's invoice and its state: line items, amounts locked at finalization, and the collection result. Generated from the live schema."
canonical: https://docs.nombaone.xyz/reference/invoices
---

# Invoices

An **invoice** is what a subscription produces each cycle: line items, discounts,
credits, and a total, locked at finalization. Its state (`draft`, `open`, `paid`,
`past_due`, `void`) tracks collection. The invoice, its
[ledger](/concepts/the-ledger) postings, and its webhooks all share one reference.

> **Interactive: `<ApiReference>`.** View and run it live at https://docs.nombaone.xyz/reference/invoices

> **Invoices are produced, not created by you**
>
> You don't create invoices directly. A [subscription](/reference/subscriptions)
> cycle produces them. These operations read and act on the invoices the engine
> generates. See [how billing works](/concepts/how-billing-works).
