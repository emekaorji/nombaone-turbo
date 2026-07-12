---
title: "Update a plan · Plans"
type: reference
summary: "PATCH /v1/plans/{id} — Update a plan."
canonical: https://docs.nombaone.xyz/reference/plans/update
---

# Update a plan · Plans

`PATCH /v1/plans/{id}`

Requires a secret API key.

## Path parameters

| Name | Type | Required | Description |
| --- | --- | --- | --- |
| `id` | string | yes |  |

## Request body

| Name | Type | Required | Description |
| --- | --- | --- | --- |
| `name` | string | no |  |
| `description` | string | no |  |
| `metadata` | object | no |  |

## Responses

- `200` — Success
- `default` — Error (ApiError envelope)

All money fields are integer kobo (e.g. `250000` = ₦2,500.00).
