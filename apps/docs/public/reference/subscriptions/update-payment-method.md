---
title: "Update the payment method · Subscriptions"
type: reference
summary: "POST /v1/subscriptions/{id}/payment-method — Update the payment method."
canonical: https://docs.nombaone.xyz/reference/subscriptions/update-payment-method
---

# Update the payment method · Subscriptions

`POST /v1/subscriptions/{id}/payment-method`

Requires a secret API key.

## Path parameters

| Name | Type | Required | Description |
| --- | --- | --- | --- |
| `id` | string | yes |  |

## Request body

| Name | Type | Required | Description |
| --- | --- | --- | --- |
| `paymentMethodReference` | string | no |  |
| `checkoutToken` | string | no |  |

## Responses

- `200` — Success
- `default` — Error (ApiError envelope)

All money fields are integer kobo (e.g. `250000` = ₦2,500.00).
