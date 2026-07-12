---
title: "Create a price on a plan · Plans"
type: reference
summary: "POST /v1/plans/{id}/prices — Create a price on a plan."
canonical: https://docs.nombaone.xyz/reference/plans/create-price
---

# Create a price on a plan · Plans

`POST /v1/plans/{id}/prices`

Requires a secret API key.

## Path parameters

| Name | Type | Required | Description |
| --- | --- | --- | --- |
| `id` | string | yes |  |

## Request body

| Name | Type | Required | Description |
| --- | --- | --- | --- |
| `unitAmountInKobo` | integer | yes |  |
| `interval` | "day" | "week" | "month" | "year" | "minute" | yes |  |
| `intervalCount` | integer | no |  |
| `usageType` | "licensed" | "metered" | no |  |
| `billingScheme` | "per_unit" | "tiered" | no |  |
| `trialPeriodDays` | integer | no |  |
| `metadata` | object | no |  |

## Responses

- `200` — Success
- `default` — Error (ApiError envelope)

All money fields are integer kobo (e.g. `250000` = ₦2,500.00).
