---
title: "Create a payout · Settlements"
type: reference
summary: "POST /v1/settlements/payout — Create a payout."
canonical: https://docs.nombaone.xyz/reference/settlements/create-payout
---

# Create a payout · Settlements

`POST /v1/settlements/payout`

Requires a secret API key.

## Request body

| Name | Type | Required | Description |
| --- | --- | --- | --- |
| `amountInKobo` | integer | yes |  |
| `bankCode` | string | yes |  |
| `accountNumber` | string | yes |  |

## Responses

- `200` — Success
- `default` — Error (ApiError envelope)

All money fields are integer kobo (e.g. `250000` = ₦2,500.00).
