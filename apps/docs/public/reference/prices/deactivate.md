---
title: "Deactivate a price · Prices"
type: reference
summary: "POST /v1/prices/{id}/deactivate — Deactivate a price."
canonical: https://docs.nombaone.xyz/reference/prices/deactivate
---

# Deactivate a price · Prices

`POST /v1/prices/{id}/deactivate`

Requires a secret API key.

## Path parameters

| Name | Type | Required | Description |
| --- | --- | --- | --- |
| `id` | string | yes |  |

## Responses

- `200` — Success
- `default` — Error (ApiError envelope)

All money fields are integer kobo (e.g. `250000` = ₦2,500.00).
