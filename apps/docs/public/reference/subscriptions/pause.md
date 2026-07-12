---
title: "Pause a subscription · Subscriptions"
type: reference
summary: "POST /v1/subscriptions/{id}/pause — Pause a subscription."
canonical: https://docs.nombaone.xyz/reference/subscriptions/pause
---

# Pause a subscription · Subscriptions

`POST /v1/subscriptions/{id}/pause`

Requires a secret API key.

## Path parameters

| Name | Type | Required | Description |
| --- | --- | --- | --- |
| `id` | string | yes |  |

## Request body

| Name | Type | Required | Description |
| --- | --- | --- | --- |
| `maxDays` | integer | no |  |

## Responses

- `200` — Success
- `default` — Error (ApiError envelope)

All money fields are integer kobo (e.g. `250000` = ₦2,500.00).
