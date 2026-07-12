---
title: "List prices · Prices"
type: reference
summary: "GET /v1/prices — List prices."
canonical: https://docs.nombaone.xyz/reference/prices/list
---

# List prices · Prices

`GET /v1/prices`

Requires a secret API key.

## Query parameters

| Name | Type | Required | Description |
| --- | --- | --- | --- |
| `planRef` | string | no |  |
| `active` | boolean | no |  |
| `limit` | integer | no |  |
| `cursor` | string | no |  |

## Responses

- `200` — Success
- `default` — Error (ApiError envelope)

All money fields are integer kobo (e.g. `250000` = ₦2,500.00).
