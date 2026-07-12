---
title: "List settlements · Settlements"
type: reference
summary: "GET /v1/settlements — List settlements."
canonical: https://docs.nombaone.xyz/reference/settlements/list
---

# List settlements · Settlements

`GET /v1/settlements`

Requires a secret API key.

## Query parameters

| Name | Type | Required | Description |
| --- | --- | --- | --- |
| `limit` | integer | no |  |
| `cursor` | string | no |  |
| `status` | "pending" | "settled" | "reconciled" | "failed" | "refunded" | no |  |

## Responses

- `200` — Success
- `default` — Error (ApiError envelope)

All money fields are integer kobo (e.g. `250000` = ₦2,500.00).
