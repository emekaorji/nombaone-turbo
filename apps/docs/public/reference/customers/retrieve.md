---
title: "Retrieve a customer · Customers"
type: reference
summary: "GET /v1/customers/{id} — Retrieve a customer."
canonical: https://docs.nombaone.xyz/reference/customers/retrieve
---

# Retrieve a customer · Customers

`GET /v1/customers/{id}`

Requires a secret API key.

## Path parameters

| Name | Type | Required | Description |
| --- | --- | --- | --- |
| `id` | string | yes |  |

## Responses

- `200` — Success
- `default` — Error (ApiError envelope)

All money fields are integer kobo (e.g. `250000` = ₦2,500.00).
