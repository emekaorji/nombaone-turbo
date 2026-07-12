---
title: "List customers · Customers"
type: reference
summary: "GET /v1/customers — List customers."
canonical: https://docs.nombaone.xyz/reference/customers/list
---

# List customers · Customers

`GET /v1/customers`

Requires a secret API key.

## Query parameters

| Name | Type | Required | Description |
| --- | --- | --- | --- |
| `email` | string | no |  |
| `limit` | integer | no |  |
| `cursor` | string | no |  |

## Responses

- `200` — Success
- `default` — Error (ApiError envelope)

All money fields are integer kobo (e.g. `250000` = ₦2,500.00).
