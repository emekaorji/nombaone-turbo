---
title: "Create a plan · Plans"
type: reference
summary: "POST /v1/plans — Create a plan."
canonical: https://docs.nombaone.xyz/reference/plans/create
---

# Create a plan · Plans

`POST /v1/plans`

Requires a secret API key.

## Request body

| Name | Type | Required | Description |
| --- | --- | --- | --- |
| `name` | string | yes |  |
| `description` | string | no |  |
| `metadata` | object | no |  |
| `prices` | object[] | no |  |

## Responses

- `200` — Success
- `default` — Error (ApiError envelope)

All money fields are integer kobo (e.g. `250000` = ₦2,500.00).
