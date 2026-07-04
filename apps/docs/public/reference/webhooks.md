---
title: "Webhook endpoints"
type: reference
summary: "Register, rotate, and inspect webhook endpoints and their deliveries. Generated from the live schema."
canonical: https://docs.nombaone.xyz/reference/webhooks
---

# Webhook endpoints

A **webhook endpoint** is a URL nombaone delivers signed events to. This resource
manages endpoints and their delivery history: create, list, update, delete, rotate
the signing secret, inspect deliveries, and replay one. For how deliveries work
and how to handle them, see the [Webhooks](/webhooks/overview) section.

> **Interactive — `<ApiReference>`.** View and run it live at https://docs.nombaone.xyz/reference/webhooks

> **One secret per endpoint**
>
> Each endpoint has its own `whsec_…` signing secret, shown once at creation and
> rotatable without downtime. Verify every delivery against it —
> [signing & verification](/webhooks/signing-and-verification).
