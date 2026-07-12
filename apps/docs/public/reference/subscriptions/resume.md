---
title: "Resume a subscription · Subscriptions"
type: reference
summary: "POST /v1/subscriptions/{id}/resume — Resume a subscription."
canonical: https://docs.nombaone.xyz/reference/subscriptions/resume
---

# Resume a subscription · Subscriptions

`POST /v1/subscriptions/{id}/resume`

Requires a secret API key.

## Path parameters

| Name | Type | Required | Description |
| --- | --- | --- | --- |
| `id` | string | yes |  |

## Responses

- `200` — Success
- `default` — Error (ApiError envelope)

All money fields are integer kobo (e.g. `250000` = ₦2,500.00).
