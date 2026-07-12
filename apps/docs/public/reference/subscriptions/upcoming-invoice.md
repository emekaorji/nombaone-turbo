---
title: "Preview the upcoming invoice · Subscriptions"
type: reference
summary: "GET /v1/subscriptions/{id}/upcoming-invoice — Preview the upcoming invoice."
canonical: https://docs.nombaone.xyz/reference/subscriptions/upcoming-invoice
---

# Preview the upcoming invoice · Subscriptions

`GET /v1/subscriptions/{id}/upcoming-invoice`

Requires a secret API key.

## Path parameters

| Name | Type | Required | Description |
| --- | --- | --- | --- |
| `id` | string | yes |  |

## Responses

- `200` — Success
- `default` — Error (ApiError envelope)

All money fields are integer kobo (e.g. `250000` = ₦2,500.00).
