---
title: "Retrieve the organization · Organization"
type: reference
summary: "GET /v1/organization — Retrieve the organization."
canonical: https://docs.nombaone.xyz/reference/organization/retrieve
---

# Retrieve the organization · Organization

`GET /v1/organization`

Requires a secret API key.

## Responses

- `200` — Success
- `default` — Error (ApiError envelope)

All money fields are integer kobo (e.g. `250000` = ₦2,500.00).
