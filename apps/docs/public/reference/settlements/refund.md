---
title: "Refund a settlement · Settlements"
type: reference
summary: "POST /v1/settlements/{id}/refund — Refund a settlement."
canonical: https://docs.nombaone.xyz/reference/settlements/refund
---

# Refund a settlement · Settlements

`POST /v1/settlements/{id}/refund`

Requires a secret API key.

## Path parameters

| Name | Type | Required | Description |
| --- | --- | --- | --- |
| `id` | string | yes |  |

## Request body

| Name | Type | Required | Description |
| --- | --- | --- | --- |
| `amountInKobo` | integer | no |  |

## Responses

- `200` — Success
- `default` — Error (ApiError envelope)

All money fields are integer kobo (e.g. `250000` = ₦2,500.00).
