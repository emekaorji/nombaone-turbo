---
title: "Set up a payment method · Payment methods"
type: reference
summary: "POST /v1/payment-methods/setup — Set up a payment method."
canonical: https://docs.nombaone.xyz/reference/payment-methods/setup
---

# Set up a payment method · Payment methods

`POST /v1/payment-methods/setup`

Requires a secret API key.

## Request body

| Name | Type | Required | Description |
| --- | --- | --- | --- |
| `customerRef` | string | yes |  |
| `amountInKobo` | integer | yes |  |
| `callbackUrl` | string | yes |  |

## Responses

- `200` — Success
- `default` — Error (ApiError envelope)

All money fields are integer kobo (e.g. `250000` = ₦2,500.00).
