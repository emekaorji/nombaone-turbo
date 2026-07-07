---
title: "Prices"
type: reference
summary: "Recurring prices: amount in integer kobo, interval, trials. Read and deactivate individual prices. Generated from the live schema."
canonical: https://docs.nombaone.xyz/reference/prices
---

# Prices

A **price** sets how much and how often. It belongs to a [plan](/reference/plans),
carries an amount in **integer kobo**, a billing `interval`, and optional trial.
A [subscription](/reference/subscriptions) references a price, not a plan.

> **Prices are created under a plan**
>
> To create or list prices, use `/v1/plans/{id}/prices` on the
> [plans](/reference/plans#post-plans-id-prices) resource. The operations here read
> and deactivate an individual price by id.

> **Interactive: `<ApiReference>`.** View and run it live at https://docs.nombaone.xyz/reference/prices
