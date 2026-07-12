---
title: "Resubscribe a customer · Subscriptions"
type: reference
summary: "POST /v1/subscriptions/{id}/resubscribe — Resubscribe a customer."
canonical: https://docs.nombaone.xyz/reference/subscriptions/resubscribe
---

# Resubscribe a customer · Subscriptions

`POST /v1/subscriptions/{id}/resubscribe`

Requires a secret API key.

## Path parameters

| Name | Type | Required | Description |
| --- | --- | --- | --- |
| `id` | string | yes |  |

## Request body

| Name | Type | Required | Description |
| --- | --- | --- | --- |
| `priceId` | string | no |  |
| `paymentMethodId` | string | no |  |

## Responses

- `200` — Success
- `default` — Error (ApiError envelope)

All money fields are integer kobo (e.g. `250000` = ₦2,500.00).
