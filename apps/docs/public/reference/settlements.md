---
title: "Settlements"
type: reference
summary: "Refunds, payouts, and escrow — read settlements, refund the tenant leg, check the escrow lock, and pay out to a bank. Generated from the live schema."
canonical: https://docs.nombaone.xyz/reference/settlements
---

# Settlements

A **settlement** records collected funds splitting into your platform fee and an
organization's net, landing in its sub-account. This resource is how money moves
back out: refund a settlement's tenant leg, read the escrow lock, and pay out an
available balance. See [refunds, payouts & settlement](/guides/refunds-payouts-settlement).

> **Interactive — `<ApiReference>`.** View and run it live at https://docs.nombaone.xyz/reference/settlements

> **The platform fee is non-refundable**
>
> A refund reverses only the organization's leg; the platform fee is never
> touched. Payouts respect the escrow lock and reject
> `PAYOUT_EXCEEDS_AVAILABLE` — see the [settlement concept](/concepts/settlement-and-sub-accounts).
