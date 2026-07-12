---
title: "List dunning attempts · Subscriptions"
type: reference
summary: "GET /v1/subscriptions/{id}/dunning/attempts — List dunning attempts."
canonical: https://docs.nombaone.xyz/reference/subscriptions/dunning-attempts
---

# List dunning attempts · Subscriptions

`GET /v1/subscriptions/{id}/dunning/attempts`

Requires a secret API key.

## Path parameters

| Name | Type | Required | Description |
| --- | --- | --- | --- |
| `id` | string | yes |  |

## Responses

- `200` — Success
- `default` — Error (ApiError envelope)

All money fields are integer kobo (e.g. `250000` = ₦2,500.00).
