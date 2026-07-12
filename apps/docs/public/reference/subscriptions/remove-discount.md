---
title: "Remove a discount · Subscriptions"
type: reference
summary: "DELETE /v1/subscriptions/{id}/discount — Remove a discount."
canonical: https://docs.nombaone.xyz/reference/subscriptions/remove-discount
---

# Remove a discount · Subscriptions

`DELETE /v1/subscriptions/{id}/discount`

Requires a secret API key.

## Path parameters

| Name | Type | Required | Description |
| --- | --- | --- | --- |
| `id` | string | yes |  |

## Responses

- `200` — Success
- `default` — Error (ApiError envelope)

All money fields are integer kobo (e.g. `250000` = ₦2,500.00).
