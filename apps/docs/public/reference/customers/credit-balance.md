---
title: "Retrieve credit balance · Customers"
type: reference
summary: "GET /v1/customers/{id}/credit — Retrieve credit balance."
canonical: https://docs.nombaone.xyz/reference/customers/credit-balance
---

# Retrieve credit balance · Customers

`GET /v1/customers/{id}/credit`

Requires a secret API key.

## Path parameters

| Name | Type | Required | Description |
| --- | --- | --- | --- |
| `id` | string | yes |  |

## Responses

- `200` — Success
- `default` — Error (ApiError envelope)

All money fields are integer kobo (e.g. `250000` = ₦2,500.00).
