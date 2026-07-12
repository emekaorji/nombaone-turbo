---
title: "Update a subscription · Subscriptions"
type: reference
summary: "PATCH /v1/subscriptions/{id} — Update a subscription."
canonical: https://docs.nombaone.xyz/reference/subscriptions/update
---

# Update a subscription · Subscriptions

`PATCH /v1/subscriptions/{id}`

Requires a secret API key.

## Path parameters

| Name | Type | Required | Description |
| --- | --- | --- | --- |
| `id` | string | yes |  |

## Request body

| Name | Type | Required | Description |
| --- | --- | --- | --- |
| `defaultPaymentMethodId` | string | no |  |
| `metadata` | object | no |  |

## Responses

- `200` — Success
- `default` — Error (ApiError envelope)

All money fields are integer kobo (e.g. `250000` = ₦2,500.00).
