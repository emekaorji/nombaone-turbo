---
title: "Create a subscription · Subscriptions"
type: reference
summary: "POST /v1/subscriptions — Create a subscription."
canonical: https://docs.nombaone.xyz/reference/subscriptions/create
---

# Create a subscription · Subscriptions

`POST /v1/subscriptions`

Requires a secret API key.

## Request body

| Name | Type | Required | Description |
| --- | --- | --- | --- |
| `customerId` | string | yes |  |
| `priceId` | string | yes |  |
| `paymentMethodId` | string | no |  |
| `collectionMethod` | "charge_automatically" | "send_invoice" | no |  |
| `trialDays` | integer | no |  |
| `quantity` | integer | no |  |
| `callbackUrl` | string | no |  |
| `metadata` | object | no |  |

## Responses

- `200` — Success
- `default` — Error (ApiError envelope)

All money fields are integer kobo (e.g. `250000` = ₦2,500.00).
