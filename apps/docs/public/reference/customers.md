---
title: "Customers"
type: reference
summary: "Create and manage the people you bill — plus their credit grants and discounts. Every operation the API serves for customers, generated from the live schema."
canonical: https://docs.nombaone.xyz/reference/customers
---

# Customers

A **customer** is who you bill. A customer holds contact details, an optional
discount, and a credit balance that draws down before any charge. Customer ids
are the `nbo…` references that join a person to their subscriptions, invoices, and
[ledger](/concepts/the-ledger) postings.

Every operation below is generated from the API's own OpenAPI schema, so it always
matches what the API actually serves.

> **Interactive — `<ApiReference>`.** View and run it live at https://docs.nombaone.xyz/reference/customers

> **Credit and discount live here**
>
> A customer's credit grants (`/customers/{id}/credit`) and applied discount
> (`/customers/{id}/discount`) are sub-resources of the customer — see
> [coupons and credits](/guides/coupons-and-credits) for how they resolve on an
> invoice.
