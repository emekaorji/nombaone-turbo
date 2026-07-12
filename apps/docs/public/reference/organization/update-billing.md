---
title: "Update billing settings · Organization"
type: reference
summary: "PUT /v1/organization/billing — Update billing settings."
canonical: https://docs.nombaone.xyz/reference/organization/update-billing
---

# Update billing settings · Organization

`PUT /v1/organization/billing`

Requires a secret API key.

## Request body

| Name | Type | Required | Description |
| --- | --- | --- | --- |
| `partialCollectionEnabled` | boolean | no |  |
| `prorationCreditPolicy` | "credit_next_cycle" | "none" | no |  |
| `dunningMaxAttempts` | integer | no |  |
| `dunningIntervalsHours` | number[] | no |  |
| `dunningMaxWindowHours` | integer | no |  |
| `gracePeriodHours` | integer | no |  |
| `paydayDays` | integer[] | no |  |
| `paydayPullForwardDays` | integer | no |  |
| `paydayBiasEnabled` | boolean | no |  |
| `defaultCollectionMethod` | "charge_automatically" | "send_invoice" | no |  |
| `commsEnabled` | boolean | no |  |

## Responses

- `200` — Success
- `default` — Error (ApiError envelope)

All money fields are integer kobo (e.g. `250000` = ₦2,500.00).
