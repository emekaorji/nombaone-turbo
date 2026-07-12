---
title: "List prices on a plan · Plans"
type: reference
summary: "GET /v1/plans/{id}/prices — List prices on a plan."
canonical: https://docs.nombaone.xyz/reference/plans/list-prices
---

# List prices on a plan · Plans

`GET /v1/plans/{id}/prices`

Requires a secret API key.

## Path parameters

| Name | Type | Required | Description |
| --- | --- | --- | --- |
| `id` | string | yes |  |

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
