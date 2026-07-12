---
title: "Retrieve a settlement · Settlements"
type: reference
summary: "GET /v1/settlements/{id} — Retrieve a settlement."
canonical: https://docs.nombaone.xyz/reference/settlements/retrieve
---

# Retrieve a settlement · Settlements

`GET /v1/settlements/{id}`

Requires a secret API key.

## Path parameters

| Name | Type | Required | Description |
| --- | --- | --- | --- |
| `id` | string | yes |  |

## Responses

- `200` — Success
- `default` — Error (ApiError envelope)

All money fields are integer kobo (e.g. `250000` = ₦2,500.00).
