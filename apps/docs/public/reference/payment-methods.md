---
title: "Payment methods"
type: reference
summary: "Cards, mandates, and virtual accounts: set up an instrument, mint a virtual account, list, delete, and set the default. Generated from the live schema."
canonical: https://docs.nombaone.xyz/reference/payment-methods
---

# Payment methods

A **payment method** is how a customer pays: a tokenized card, a direct-debit
[mandate](/reference/mandates), or a virtual account for bank transfers. The rail
determines whether a charge is *pulled* or *pushed*. See
[multi-rail: push and pull](/concepts/multi-rail-push-and-pull).

> **Interactive: `<ApiReference>`.** View and run it live at https://docs.nombaone.xyz/reference/payment-methods

> **Setting up vs charging**
>
> `setup` and `virtual-account` create the instrument (the customer authorizes at
> the returned link); a [subscription](/guides/start-a-subscription) then charges
> it each cycle. On the sandbox, `POST /v1/sandbox/payment-methods` mints a
> deterministic method for rehearsing outcomes.
