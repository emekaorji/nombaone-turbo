---
title: "List plans · Plans"
type: reference
summary: "GET /v1/plans — List plans."
canonical: https://docs.nombaone.xyz/reference/plans/list
---

# List plans · Plans

`GET /v1/plans`

Requires a secret API key.

## Query parameters

| Name | Type | Required | Description |
| --- | --- | --- | --- |
| `status` | "active" | "archived" | no |  |
| `limit` | integer | no |  |
| `cursor` | string | no |  |

## Responses

- `200` — Success
- `default` — Error (ApiError envelope)

All money fields are integer kobo (e.g. `250000` = ₦2,500.00).
