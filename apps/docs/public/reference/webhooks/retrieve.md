---
title: "Retrieve a webhook endpoint · Webhook endpoints"
type: reference
summary: "GET /v1/webhooks/{id} — Retrieve a webhook endpoint."
canonical: https://docs.nombaone.xyz/reference/webhooks/retrieve
---

# Retrieve a webhook endpoint · Webhook endpoints

`GET /v1/webhooks/{id}`

Requires a secret API key.

## Path parameters

| Name | Type | Required | Description |
| --- | --- | --- | --- |
| `id` | string | yes |  |

## Responses

- `200` — Success
- `default` — Error (ApiError envelope)

All money fields are integer kobo (e.g. `250000` = ₦2,500.00).
