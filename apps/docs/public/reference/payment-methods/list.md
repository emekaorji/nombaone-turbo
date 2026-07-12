---
title: "List payment methods · Payment methods"
type: reference
summary: "GET /v1/payment-methods — List payment methods."
canonical: https://docs.nombaone.xyz/reference/payment-methods/list
---

# List payment methods · Payment methods

`GET /v1/payment-methods`

Requires a secret API key.

## Query parameters

| Name | Type | Required | Description |
| --- | --- | --- | --- |
| `customerRef` | string | no |  |
| `limit` | integer | no |  |
| `cursor` | string | no |  |

## Responses

- `200` — Success
- `default` — Error (ApiError envelope)

All money fields are integer kobo (e.g. `250000` = ₦2,500.00).
