---
title: "Create a webhook endpoint · Webhook endpoints"
type: reference
summary: "POST /v1/webhooks — Create a webhook endpoint."
canonical: https://docs.nombaone.xyz/reference/webhooks/create
---

# Create a webhook endpoint · Webhook endpoints

`POST /v1/webhooks`

Requires a secret API key.

## Request body

| Name | Type | Required | Description |
| --- | --- | --- | --- |
| `url` | string | yes |  |
| `enabledEvents` | string[] | no |  |

## Responses

- `200` — Success
- `default` — Error (ApiError envelope)

All money fields are integer kobo (e.g. `250000` = ₦2,500.00).
