---
title: "Delete a webhook endpoint · Webhook endpoints"
type: reference
summary: "DELETE /v1/webhooks/{id} — Delete a webhook endpoint."
canonical: https://docs.nombaone.xyz/reference/webhooks/delete
---

# Delete a webhook endpoint · Webhook endpoints

`DELETE /v1/webhooks/{id}`

Requires a secret API key.

## Path parameters

| Name | Type | Required | Description |
| --- | --- | --- | --- |
| `id` | string | yes |  |

## Responses

- `200` — Success
- `default` — Error (ApiError envelope)

All money fields are integer kobo (e.g. `250000` = ₦2,500.00).
