---
title: "List deliveries · Webhook endpoints"
type: reference
summary: "GET /v1/webhooks/{id}/deliveries — List deliveries."
canonical: https://docs.nombaone.xyz/reference/webhooks/list-deliveries
---

# List deliveries · Webhook endpoints

`GET /v1/webhooks/{id}/deliveries`

Requires a secret API key.

## Path parameters

| Name | Type | Required | Description |
| --- | --- | --- | --- |
| `id` | string | yes |  |

## Query parameters

| Name | Type | Required | Description |
| --- | --- | --- | --- |
| `limit` | integer | no |  |
| `cursor` | string | no |  |
| `status` | "pending" | "succeeded" | "failed" | "dead" | no |  |
| `eventType` | string | no |  |
| `endpoint` | string | no |  |

## Responses

- `200` — Success
- `default` — Error (ApiError envelope)

All money fields are integer kobo (e.g. `250000` = ₦2,500.00).
