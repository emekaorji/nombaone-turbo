---
title: "Retrieve an invoice · Invoices"
type: reference
summary: "GET /v1/invoices/{id} — Retrieve an invoice."
canonical: https://docs.nombaone.xyz/reference/invoices/retrieve
---

# Retrieve an invoice · Invoices

`GET /v1/invoices/{id}`

Requires a secret API key.

## Path parameters

| Name | Type | Required | Description |
| --- | --- | --- | --- |
| `id` | string | yes |  |

## Responses

- `200` — Success
- `default` — Error (ApiError envelope)

All money fields are integer kobo (e.g. `250000` = ₦2,500.00).
