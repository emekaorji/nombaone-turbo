---
title: "Create a coupon · Coupons"
type: reference
summary: "POST /v1/coupons — Create a coupon."
canonical: https://docs.nombaone.xyz/reference/coupons/create
---

# Create a coupon · Coupons

`POST /v1/coupons`

Requires a secret API key.

## Request body

| Name | Type | Required | Description |
| --- | --- | --- | --- |
| `code` | string | yes |  |
| `amountOffInKobo` | integer | no |  |
| `percentOff` | integer | no |  |
| `duration` | "once" | "repeating" | "forever" | yes |  |
| `durationInCycles` | integer | no |  |
| `redeemBy` | timestamp | no |  |
| `maxRedemptions` | integer | no |  |
| `metadata` | object | no |  |

## Responses

- `200` — Success
- `default` — Error (ApiError envelope)

All money fields are integer kobo (e.g. `250000` = ₦2,500.00).
