---
title: "Retrieve billing settings · Organization"
type: reference
summary: "GET /v1/organization/billing — Retrieve billing settings."
canonical: https://docs.nombaone.xyz/reference/organization/retrieve-billing
---

# Retrieve billing settings · Organization

`GET /v1/organization/billing`

Requires a secret API key.

## Responses

- `200` — Success
- `default` — Error (ApiError envelope)

All money fields are integer kobo (e.g. `250000` = ₦2,500.00).
