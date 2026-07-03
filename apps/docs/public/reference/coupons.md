---
title: "Coupons"
type: reference
summary: "Discount definitions — percent or fixed amount off, with a duration. Create, read, update, and list. Generated from the live schema."
canonical: https://docs.nombaone.xyz/reference/coupons
---

# Coupons

A **coupon** is a reusable discount rule: a percentage or a fixed kobo amount off,
applied for a `once`, `repeating`, or `forever` duration. Apply one to a
[customer](/reference/customers) or a [subscription](/reference/subscriptions) —
see [coupons and credits](/guides/coupons-and-credits).

> **Interactive — `<ApiReference>`.** View and run it live at https://docs.nombaone.xyz/reference/coupons

> **A coupon is a rule; a credit is a balance**
>
> Coupons recompute a discount each cycle for their duration. For a spent-once
> balance, use a [credit grant](/reference/credits) instead.
