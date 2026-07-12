---
title: "List coupons · Coupons"
type: reference
summary: "GET /v1/coupons — List coupons."
canonical: https://docs.nombaone.xyz/reference/coupons/list
---

# List coupons · Coupons

`GET /v1/coupons`

Requires a secret API key.

## Query parameters

| Name | Type | Required | Description |
| --- | --- | --- | --- |
| `limit` | integer | no |  |
| `cursor` | string | no |  |

## Responses

- `200` — Success
- `default` — Error (ApiError envelope)

All money fields are integer kobo (e.g. `250000` = ₦2,500.00).
