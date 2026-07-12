---
title: "List subscriptions · Subscriptions"
type: reference
summary: "GET /v1/subscriptions — List subscriptions."
canonical: https://docs.nombaone.xyz/reference/subscriptions/list
---

# List subscriptions · Subscriptions

`GET /v1/subscriptions`

Requires a secret API key.

## Query parameters

| Name | Type | Required | Description |
| --- | --- | --- | --- |
| `customerId` | string | no |  |
| `status` | "incomplete" | "incomplete_expired" | "trialing" | "active" | "past_due" | "paused" | "canceled" | no |  |
| `limit` | integer | no |  |
| `cursor` | string | no |  |

## Responses

- `200` — Success
- `default` — Error (ApiError envelope)

All money fields are integer kobo (e.g. `250000` = ₦2,500.00).
