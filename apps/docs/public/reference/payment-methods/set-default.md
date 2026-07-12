---
title: "Set the default method · Payment methods"
type: reference
summary: "POST /v1/payment-methods/{id}/default — Set the default method."
canonical: https://docs.nombaone.xyz/reference/payment-methods/set-default
---

# Set the default method · Payment methods

`POST /v1/payment-methods/{id}/default`

Requires a secret API key.

## Path parameters

| Name | Type | Required | Description |
| --- | --- | --- | --- |
| `id` | string | yes |  |

## Responses

- `200` — Success
- `default` — Error (ApiError envelope)

All money fields are integer kobo (e.g. `250000` = ₦2,500.00).
