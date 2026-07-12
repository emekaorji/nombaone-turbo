---
title: "Retrieve the escrow balance · Settlements"
type: reference
summary: "GET /v1/settlements/escrow — Retrieve the escrow balance."
canonical: https://docs.nombaone.xyz/reference/settlements/escrow
---

# Retrieve the escrow balance · Settlements

`GET /v1/settlements/escrow`

Requires a secret API key.

## Responses

- `200` — Success
- `default` — Error (ApiError envelope)

All money fields are integer kobo (e.g. `250000` = ₦2,500.00).
