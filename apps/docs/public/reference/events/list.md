---
title: "List events · Events"
type: reference
summary: "GET /v1/events — List events."
canonical: https://docs.nombaone.xyz/reference/events/list
---

# List events · Events

`GET /v1/events`

Requires a secret API key.

## Query parameters

| Name | Type | Required | Description |
| --- | --- | --- | --- |
| `limit` | integer | no |  |
| `cursor` | string | no |  |
| `type` | string | no |  |

## Responses

- `200` — Success
- `default` — Error (ApiError envelope)

All money fields are integer kobo (e.g. `250000` = ₦2,500.00).
