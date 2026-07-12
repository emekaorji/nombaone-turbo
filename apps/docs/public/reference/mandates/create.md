---
title: "Create a mandate · Mandates"
type: reference
summary: "POST /v1/mandates — Create a mandate."
canonical: https://docs.nombaone.xyz/reference/mandates/create
---

# Create a mandate · Mandates

`POST /v1/mandates`

Requires a secret API key.

## Request body

| Name | Type | Required | Description |
| --- | --- | --- | --- |
| `customerRef` | string | yes |  |
| `customerAccountNumber` | string | yes |  |
| `bankCode` | string | yes |  |
| `customerName` | string | yes |  |
| `customerAccountName` | string | yes |  |
| `customerPhoneNumber` | string | yes |  |
| `customerAddress` | string | yes |  |
| `narration` | string | yes |  |
| `maxAmountInKobo` | integer | yes |  |
| `frequency` | "variable" | "weekly" | "every_two_weeks" | "monthly" | "every_two_months" | "every_three_months" | "every_four_months" | "every_six_months" | "every_twelve_months" | no |  |
| `startDate` | string | no |  |
| `endDate` | string | no |  |

## Responses

- `200` — Success
- `default` — Error (ApiError envelope)

All money fields are integer kobo (e.g. `250000` = ₦2,500.00).
