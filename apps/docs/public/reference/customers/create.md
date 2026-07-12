---
title: "Create a customer · Customers"
type: reference
summary: "POST /v1/customers — Create a customer."
canonical: https://docs.nombaone.xyz/reference/customers/create
---

# Create a customer · Customers

`POST /v1/customers`

Requires a secret API key.

## Request body

| Name | Type | Required | Description |
| --- | --- | --- | --- |
| `email` | string | yes |  |
| `name` | string | yes |  |
| `phone` | string | no |  |
| `metadata` | object | no |  |

## Responses

- `200` — Success
- `default` — Error (ApiError envelope)

All money fields are integer kobo (e.g. `250000` = ₦2,500.00).
