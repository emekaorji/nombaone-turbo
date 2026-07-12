---
title: "Change the plan or price · Subscriptions"
type: reference
summary: "POST /v1/subscriptions/{id}/change — Change the plan or price."
canonical: https://docs.nombaone.xyz/reference/subscriptions/change
---

# Change the plan or price · Subscriptions

`POST /v1/subscriptions/{id}/change`

Requires a secret API key.

## Path parameters

| Name | Type | Required | Description |
| --- | --- | --- | --- |
| `id` | string | yes |  |

## Request body

| Name | Type | Required | Description |
| --- | --- | --- | --- |
| `priceId` | string | no |  |
| `quantity` | integer | no |  |
| `intervalSwitch` | boolean | no |  |
| `prorationBehavior` | "create_prorations" | "none" | no |  |

## Responses

- `200` — Success
- `default` — Error (ApiError envelope)

All money fields are integer kobo (e.g. `250000` = ₦2,500.00).
