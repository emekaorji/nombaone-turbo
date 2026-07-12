---
title: "Retrieve a payment method · Payment methods"
type: reference
summary: "GET /v1/payment-methods/{id} — Retrieve a payment method."
canonical: https://docs.nombaone.xyz/reference/payment-methods/retrieve
---

# Retrieve a payment method · Payment methods

`GET /v1/payment-methods/{id}`

Requires a secret API key.

## Path parameters

| Name | Type | Required | Description |
| --- | --- | --- | --- |
| `id` | string | yes |  |

## Responses

- `200` — Success
- `default` — Error (ApiError envelope)

All money fields are integer kobo (e.g. `250000` = ₦2,500.00).
