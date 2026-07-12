---
title: "Apply a discount · Customers"
type: reference
summary: "POST /v1/customers/{id}/discount — Apply a discount."
canonical: https://docs.nombaone.xyz/reference/customers/apply-discount
---

# Apply a discount · Customers

`POST /v1/customers/{id}/discount`

Requires a secret API key.

## Path parameters

| Name | Type | Required | Description |
| --- | --- | --- | --- |
| `id` | string | yes |  |

## Request body

| Name | Type | Required | Description |
| --- | --- | --- | --- |
| `coupon` | string | yes |  |

## Responses

- `200` — Success
- `default` — Error (ApiError envelope)

All money fields are integer kobo (e.g. `250000` = ₦2,500.00).
