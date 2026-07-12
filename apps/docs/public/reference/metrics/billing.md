---
title: "Retrieve billing metrics · Metrics"
type: reference
summary: "GET /v1/metrics/billing — Retrieve billing metrics."
canonical: https://docs.nombaone.xyz/reference/metrics/billing
---

# Retrieve billing metrics · Metrics

`GET /v1/metrics/billing`

Requires a secret API key.

## Query parameters

| Name | Type | Required | Description |
| --- | --- | --- | --- |
| `from` | timestamp | no |  |
| `to` | timestamp | no |  |

## Responses

- `200` — Success
- `default` — Error (ApiError envelope)

All money fields are integer kobo (e.g. `250000` = ₦2,500.00).
