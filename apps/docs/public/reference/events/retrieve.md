---
title: "Retrieve an event · Events"
type: reference
summary: "GET /v1/events/{id} — Retrieve an event."
canonical: https://docs.nombaone.xyz/reference/events/retrieve
---

# Retrieve an event · Events

`GET /v1/events/{id}`

Requires a secret API key.

## Path parameters

| Name | Type | Required | Description |
| --- | --- | --- | --- |
| `id` | string | yes |  |

## Responses

- `200` — Success
- `default` — Error (ApiError envelope)

All money fields are integer kobo (e.g. `250000` = ₦2,500.00).
