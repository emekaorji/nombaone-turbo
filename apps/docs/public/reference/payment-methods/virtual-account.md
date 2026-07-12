---
title: "Create a virtual account · Payment methods"
type: reference
summary: "POST /v1/payment-methods/virtual-account — Create a virtual account."
canonical: https://docs.nombaone.xyz/reference/payment-methods/virtual-account
---

# Create a virtual account · Payment methods

`POST /v1/payment-methods/virtual-account`

Requires a secret API key.

## Request body

| Name | Type | Required | Description |
| --- | --- | --- | --- |
| `customerRef` | string | yes |  |
| `expectedAmount` | integer | no |  |
| `expiryDate` | string | no |  |

## Responses

- `200` — Success
- `default` — Error (ApiError envelope)

All money fields are integer kobo (e.g. `250000` = ₦2,500.00).
