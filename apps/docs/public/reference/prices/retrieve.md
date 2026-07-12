---
title: "Retrieve a price · Prices"
type: reference
summary: "GET /v1/prices/{id} — Retrieve a price."
canonical: https://docs.nombaone.xyz/reference/prices/retrieve
---

# Retrieve a price · Prices

`GET /v1/prices/{id}`

Requires a secret API key.

## Path parameters

| Name | Type | Required | Description |
| --- | --- | --- | --- |
| `id` | string | yes |  |

## Responses

- `200` — Success
- `default` — Error (ApiError envelope)

All money fields are integer kobo (e.g. `250000` = ₦2,500.00).
