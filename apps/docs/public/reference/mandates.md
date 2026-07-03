---
title: "Mandates"
type: reference
summary: "Direct-debit consent and status — the authorization that lets the engine pull from a customer's bank account silently. Generated from the live schema."
canonical: https://docs.nombaone.xyz/reference/mandates
---

# Mandates

A **mandate** is a customer's standing authorization to debit their bank account
— the direct-debit rail. Once active, it is the most reliable silent rail in
Nigeria: no OTP per charge, no thin-balance card decline. See
[mandates and consent](/concepts/hard-parts/mandates-and-consent) for the
lifecycle (create → consent → active → debit).

> **Interactive — `<ApiReference>`.** View and run it live at https://docs.nombaone.xyz/reference/mandates

> **Activation is asynchronous**
>
> A mandate created today is `consent_pending` until the bank confirms it. The
> engine sweeps pending mandates to `active` and fires `payment_method.updated`
> when one activates — you don't poll.
