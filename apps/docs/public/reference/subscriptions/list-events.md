---
title: "List subscription events · Subscriptions"
type: reference
summary: "GET /v1/subscriptions/{id}/events — List subscription events."
canonical: https://docs.nombaone.xyz/reference/subscriptions/list-events
---

# List subscription events · Subscriptions

`GET /v1/subscriptions/{id}/events`

Requires a secret API key.

## Path parameters

| Name | Type | Required | Description |
| --- | --- | --- | --- |
| `id` | string | yes |  |

## Responses

- `200` — Success
- `default` — Error (ApiError envelope)

All money fields are integer kobo (e.g. `250000` = ₦2,500.00).
