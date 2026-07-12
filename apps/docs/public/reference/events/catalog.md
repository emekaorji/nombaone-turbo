---
title: "Retrieve the event catalog · Events"
type: reference
summary: "GET /v1/events/catalog — Retrieve the event catalog."
canonical: https://docs.nombaone.xyz/reference/events/catalog
---

# Retrieve the event catalog · Events

`GET /v1/events/catalog`

Requires a secret API key.

## Responses

- `200` — Success
- `default` — Error (ApiError envelope)

All money fields are integer kobo (e.g. `250000` = ₦2,500.00).
