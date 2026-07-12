---
title: "Apply a discount · Subscriptions"
type: reference
summary: "POST /v1/subscriptions/{id}/discount — Apply a discount."
canonical: https://docs.nombaone.xyz/reference/subscriptions/apply-discount
---

# Apply a discount · Subscriptions

`POST /v1/subscriptions/{id}/discount`

Requires a secret API key.

## Path parameters

| Name | Type | Required | Description |
| --- | --- | --- | --- |
| `id` | string | yes |  |

## Request body

| Name | Type | Required | Description |
| --- | --- | --- | --- |
| `coupon` | string | yes |  |

## Responses

- `200` — Success
- `default` — Error (ApiError envelope)

All money fields are integer kobo (e.g. `250000` = ₦2,500.00).
