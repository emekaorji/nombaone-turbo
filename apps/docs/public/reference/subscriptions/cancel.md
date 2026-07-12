---
title: "Cancel a subscription · Subscriptions"
type: reference
summary: "POST /v1/subscriptions/{id}/cancel — Cancel a subscription."
canonical: https://docs.nombaone.xyz/reference/subscriptions/cancel
---

# Cancel a subscription · Subscriptions

`POST /v1/subscriptions/{id}/cancel`

Requires a secret API key.

## Path parameters

| Name | Type | Required | Description |
| --- | --- | --- | --- |
| `id` | string | yes |  |

## Request body

| Name | Type | Required | Description |
| --- | --- | --- | --- |
| `mode` | "now" | "at_period_end" | no |  |
| `comment` | string | no |  |

## Responses

- `200` — Success
- `default` — Error (ApiError envelope)

All money fields are integer kobo (e.g. `250000` = ₦2,500.00).
