---
title: "Retrieve the schedule · Subscriptions"
type: reference
summary: "GET /v1/subscriptions/{id}/schedule — Retrieve the schedule."
canonical: https://docs.nombaone.xyz/reference/subscriptions/retrieve-schedule
---

# Retrieve the schedule · Subscriptions

`GET /v1/subscriptions/{id}/schedule`

Requires a secret API key.

## Path parameters

| Name | Type | Required | Description |
| --- | --- | --- | --- |
| `id` | string | yes |  |

## Responses

- `200` — Success
- `default` — Error (ApiError envelope)

All money fields are integer kobo (e.g. `250000` = ₦2,500.00).
