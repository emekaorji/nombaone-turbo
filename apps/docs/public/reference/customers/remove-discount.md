---
title: "Remove a discount · Customers"
type: reference
summary: "DELETE /v1/customers/{id}/discount — Remove a discount."
canonical: https://docs.nombaone.xyz/reference/customers/remove-discount
---

# Remove a discount · Customers

`DELETE /v1/customers/{id}/discount`

Requires a secret API key.

## Path parameters

| Name | Type | Required | Description |
| --- | --- | --- | --- |
| `id` | string | yes |  |

## Responses

- `200` — Success
- `default` — Error (ApiError envelope)

All money fields are integer kobo (e.g. `250000` = ₦2,500.00).
