---
title: "Update a coupon · Coupons"
type: reference
summary: "PATCH /v1/coupons/{id} — Update a coupon."
canonical: https://docs.nombaone.xyz/reference/coupons/update
---

# Update a coupon · Coupons

`PATCH /v1/coupons/{id}`

Requires a secret API key.

## Path parameters

| Name | Type | Required | Description |
| --- | --- | --- | --- |
| `id` | string | yes |  |

## Request body

| Name | Type | Required | Description |
| --- | --- | --- | --- |
| `redeemBy` | timestamp | no |  |
| `maxRedemptions` | integer | no |  |
| `metadata` | object | no |  |

## Responses

- `200` — Success
- `default` — Error (ApiError envelope)

All money fields are integer kobo (e.g. `250000` = ₦2,500.00).
