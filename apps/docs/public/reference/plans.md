---
title: "Plans"
type: reference
summary: "Product plans and their lifecycle: create, update, archive, and the prices that hang off them. Generated from the live schema."
canonical: https://docs.nombaone.xyz/reference/plans
---

# Plans

A **plan** is the product a customer subscribes to. It carries a name and holds
one or more [prices](/reference/prices): the money lives on the price, so one
plan can offer monthly and yearly at once. See
[create plans and prices](/guides/create-plans-and-prices) for the workflow.

> **Interactive: `<ApiReference>`.** View and run it live at https://docs.nombaone.xyz/reference/plans

> **Prices are created under a plan**
>
> A plan's prices are managed at `/v1/plans/{id}/prices` (create and list). The
> operations above include them. Reading or deactivating an individual price is on
> the [prices](/reference/prices) resource.
