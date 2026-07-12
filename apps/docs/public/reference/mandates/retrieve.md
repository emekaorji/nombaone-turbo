---
title: "Retrieve a mandate · Mandates"
type: reference
summary: "GET /v1/mandates/{id} — Retrieve a mandate."
canonical: https://docs.nombaone.xyz/reference/mandates/retrieve
---

# Retrieve a mandate · Mandates

`GET /v1/mandates/{id}`

Requires a secret API key.

## Path parameters

| Name | Type | Required | Description |
| --- | --- | --- | --- |
| `id` | string | yes |  |

## Responses

- `200` — Success
- `default` — Error (ApiError envelope)

All money fields are integer kobo (e.g. `250000` = ₦2,500.00).
