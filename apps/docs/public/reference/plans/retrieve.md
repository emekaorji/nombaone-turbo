---
title: "Retrieve a plan · Plans"
type: reference
summary: "GET /v1/plans/{id} — Retrieve a plan."
canonical: https://docs.nombaone.xyz/reference/plans/retrieve
---

# Retrieve a plan · Plans

`GET /v1/plans/{id}`

Requires a secret API key.

## Path parameters

| Name | Type | Required | Description |
| --- | --- | --- | --- |
| `id` | string | yes |  |

## Responses

- `200` — Success
- `default` — Error (ApiError envelope)

All money fields are integer kobo (e.g. `250000` = ₦2,500.00).
