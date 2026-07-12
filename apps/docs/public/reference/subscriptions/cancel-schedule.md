---
title: "Cancel the schedule · Subscriptions"
type: reference
summary: "DELETE /v1/subscriptions/{id}/schedule — Cancel the schedule."
canonical: https://docs.nombaone.xyz/reference/subscriptions/cancel-schedule
---

# Cancel the schedule · Subscriptions

`DELETE /v1/subscriptions/{id}/schedule`

Requires a secret API key.

## Path parameters

| Name | Type | Required | Description |
| --- | --- | --- | --- |
| `id` | string | yes |  |

## Responses

- `200` — Success
- `default` — Error (ApiError envelope)

All money fields are integer kobo (e.g. `250000` = ₦2,500.00).
