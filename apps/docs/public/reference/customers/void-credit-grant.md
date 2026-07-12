---
title: "Void a credit grant · Customers"
type: reference
summary: "DELETE /v1/customers/{id}/credit/{grantId} — Void a credit grant."
canonical: https://docs.nombaone.xyz/reference/customers/void-credit-grant
---

# Void a credit grant · Customers

`DELETE /v1/customers/{id}/credit/{grantId}`

Requires a secret API key.

## Path parameters

| Name | Type | Required | Description |
| --- | --- | --- | --- |
| `id` | string | yes |  |
| `grantId` | string | yes |  |

## Responses

- `200` — Success
- `default` — Error (ApiError envelope)

All money fields are integer kobo (e.g. `250000` = ₦2,500.00).
