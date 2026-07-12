---
title: "Rotate the signing secret · Webhook endpoints"
type: reference
summary: "POST /v1/webhooks/{id}/rotate-secret — Rotate the signing secret."
canonical: https://docs.nombaone.xyz/reference/webhooks/rotate-secret
---

# Rotate the signing secret · Webhook endpoints

`POST /v1/webhooks/{id}/rotate-secret`

Requires a secret API key.

## Path parameters

| Name | Type | Required | Description |
| --- | --- | --- | --- |
| `id` | string | yes |  |

## Responses

- `200` — Success
- `default` — Error (ApiError envelope)

All money fields are integer kobo (e.g. `250000` = ₦2,500.00).
