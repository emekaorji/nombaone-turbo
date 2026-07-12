---
title: "Schedule a change · Subscriptions"
type: reference
summary: "POST /v1/subscriptions/{id}/schedule — Schedule a change."
canonical: https://docs.nombaone.xyz/reference/subscriptions/create-schedule
---

# Schedule a change · Subscriptions

`POST /v1/subscriptions/{id}/schedule`

Requires a secret API key.

## Path parameters

| Name | Type | Required | Description |
| --- | --- | --- | --- |
| `id` | string | yes |  |

## Request body

| Name | Type | Required | Description |
| --- | --- | --- | --- |
| `priceId` | string | yes |  |
| `quantity` | integer | no |  |
| `effectiveAt` | "next_cycle" | no |  |

## Responses

- `200` — Success
- `default` — Error (ApiError envelope)

All money fields are integer kobo (e.g. `250000` = ₦2,500.00).
