---
title: "Archive a plan · Plans"
type: reference
summary: "POST /v1/plans/{id}/archive — Archive a plan."
canonical: https://docs.nombaone.xyz/reference/plans/archive
---

# Archive a plan · Plans

`POST /v1/plans/{id}/archive`

Requires a secret API key.

## Path parameters

| Name | Type | Required | Description |
| --- | --- | --- | --- |
| `id` | string | yes |  |

## Responses

- `200` — Success
- `default` — Error (ApiError envelope)

All money fields are integer kobo (e.g. `250000` = ₦2,500.00).
