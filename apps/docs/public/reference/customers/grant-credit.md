---
title: "Grant credit · Customers"
type: reference
summary: "POST /v1/customers/{id}/credit — Grant credit."
canonical: https://docs.nombaone.xyz/reference/customers/grant-credit
---

# Grant credit · Customers

`POST /v1/customers/{id}/credit`

Requires a secret API key.

## Path parameters

| Name | Type | Required | Description |
| --- | --- | --- | --- |
| `id` | string | yes |  |

## Request body

| Name | Type | Required | Description |
| --- | --- | --- | --- |
| `amountInKobo` | integer | yes |  |
| `source` | "manual" | "goodwill" | no |  |
| `sourceReference` | string | no |  |
| `metadata` | object | no |  |

## Responses

- `200` — Success
- `default` — Error (ApiError envelope)

All money fields are integer kobo (e.g. `250000` = ₦2,500.00).
