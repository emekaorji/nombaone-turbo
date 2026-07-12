---
title: "Update a customer · Customers"
type: reference
summary: "PATCH /v1/customers/{id} — Update a customer."
canonical: https://docs.nombaone.xyz/reference/customers/update
---

# Update a customer · Customers

`PATCH /v1/customers/{id}`

Requires a secret API key.

## Path parameters

| Name | Type | Required | Description |
| --- | --- | --- | --- |
| `id` | string | yes |  |

## Request body

| Name | Type | Required | Description |
| --- | --- | --- | --- |
| `name` | string | no |  |
| `phone` | string | no |  |
| `metadata` | object | no |  |

## Responses

- `200` — Success
- `default` — Error (ApiError envelope)

All money fields are integer kobo (e.g. `250000` = ₦2,500.00).
