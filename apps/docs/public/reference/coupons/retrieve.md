---
title: "Retrieve a coupon · Coupons"
type: reference
summary: "GET /v1/coupons/{id} — Retrieve a coupon."
canonical: https://docs.nombaone.xyz/reference/coupons/retrieve
---

# Retrieve a coupon · Coupons

`GET /v1/coupons/{id}`

Requires a secret API key.

## Path parameters

| Name | Type | Required | Description |
| --- | --- | --- | --- |
| `id` | string | yes |  |

## Responses

- `200` — Success
- `default` — Error (ApiError envelope)

All money fields are integer kobo (e.g. `250000` = ₦2,500.00).
