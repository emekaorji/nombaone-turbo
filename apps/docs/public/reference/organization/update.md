---
title: "Update the organization · Organization"
type: reference
summary: "PUT /v1/organization — Update the organization."
canonical: https://docs.nombaone.xyz/reference/organization/update
---

# Update the organization · Organization

`PUT /v1/organization`

Requires a secret API key.

## Request body

| Name | Type | Required | Description |
| --- | --- | --- | --- |
| `monthlyRequestQuota` | integer | no |  |
| `settlementMode` | "split_at_collection" | "collect_then_payout" | no |  |
| `branding` | object | no |  |

## Responses

- `200` — Success
- `default` — Error (ApiError envelope)

All money fields are integer kobo (e.g. `250000` = ₦2,500.00).
