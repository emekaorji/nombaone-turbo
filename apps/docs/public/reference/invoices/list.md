---
title: "List invoices · Invoices"
type: reference
summary: "GET /v1/invoices — List invoices."
canonical: https://docs.nombaone.xyz/reference/invoices/list
---

# List invoices · Invoices

`GET /v1/invoices`

Requires a secret API key.

## Query parameters

| Name | Type | Required | Description |
| --- | --- | --- | --- |
| `customerId` | string | no |  |
| `subscriptionId` | string | no |  |
| `status` | "draft" | "open" | "paid" | "void" | "uncollectible" | no |  |
| `limit` | integer | no |  |
| `cursor` | string | no |  |

## Responses

- `200` — Success
- `default` — Error (ApiError envelope)

All money fields are integer kobo (e.g. `250000` = ₦2,500.00).
