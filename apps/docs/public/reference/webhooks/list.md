---
title: "List webhook endpoints · Webhook endpoints"
type: reference
summary: "GET /v1/webhooks — List webhook endpoints."
canonical: https://docs.nombaone.xyz/reference/webhooks/list
---

# List webhook endpoints · Webhook endpoints

`GET /v1/webhooks`

Requires a secret API key.

## Responses

- `200` — Success
- `default` — Error (ApiError envelope)

All money fields are integer kobo (e.g. `250000` = ₦2,500.00).
