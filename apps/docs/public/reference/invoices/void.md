---
title: "Void an invoice · Invoices"
type: reference
summary: "POST /v1/invoices/{id}/void — Void an invoice."
canonical: https://docs.nombaone.xyz/reference/invoices/void
---

# Void an invoice · Invoices

`POST /v1/invoices/{id}/void`

Requires a secret API key.

## Path parameters

| Name | Type | Required | Description |
| --- | --- | --- | --- |
| `id` | string | yes |  |

## Request body

| Name | Type | Required | Description |
| --- | --- | --- | --- |
| `comment` | string | no |  |

## Responses

- `200` — Success
- `default` — Error (ApiError envelope)

All money fields are integer kobo (e.g. `250000` = ₦2,500.00).
