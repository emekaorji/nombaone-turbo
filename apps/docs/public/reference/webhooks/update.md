---
title: "Update a webhook endpoint · Webhook endpoints"
type: reference
summary: "PATCH /v1/webhooks/{id} — Update a webhook endpoint."
canonical: https://docs.nombaone.xyz/reference/webhooks/update
---

# Update a webhook endpoint · Webhook endpoints

`PATCH /v1/webhooks/{id}`

Requires a secret API key.

## Path parameters

| Name | Type | Required | Description |
| --- | --- | --- | --- |
| `id` | string | yes |  |

## Request body

| Name | Type | Required | Description |
| --- | --- | --- | --- |
| `url` | string | no |  |
| `enabledEvents` | string[] | no |  |
| `disabled` | boolean | no |  |

## Responses

- `200` — Success
- `default` — Error (ApiError envelope)

All money fields are integer kobo (e.g. `250000` = ₦2,500.00).
