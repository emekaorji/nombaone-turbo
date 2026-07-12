---
title: "Delete a payment method · Payment methods"
type: reference
summary: "DELETE /v1/payment-methods/{id} — Delete a payment method."
canonical: https://docs.nombaone.xyz/reference/payment-methods/delete
---

# Delete a payment method · Payment methods

`DELETE /v1/payment-methods/{id}`

Requires a secret API key.

## Path parameters

| Name | Type | Required | Description |
| --- | --- | --- | --- |
| `id` | string | yes |  |

## Responses

- `200` — Success
- `default` — Error (ApiError envelope)

All money fields are integer kobo (e.g. `250000` = ₦2,500.00).
