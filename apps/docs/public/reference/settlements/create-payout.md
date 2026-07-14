---
title: "Withdraw your balance · Settlements"
type: reference
summary: "POST /v1/settlements/payout — Withdraw your balance."
canonical: https://docs.nombaone.xyz/reference/settlements/create-payout
---

# Withdraw your balance · Settlements

`POST /v1/settlements/payout`

Requires a secret API key.

## Request body

| Name | Type | Required | Description |
| --- | --- | --- | --- |
| `amountInKobo` | integer | no |  |

## Responses

- `200` — Success
- `default` — Error (ApiError envelope)

All money fields are integer kobo (e.g. `250000` = ₦2,500.00).
