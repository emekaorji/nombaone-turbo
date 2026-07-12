---
title: "Retrieve a delivery · Webhook endpoints"
type: reference
summary: "GET /v1/webhooks/{id}/deliveries/{deliveryId} — Retrieve a delivery."
canonical: https://docs.nombaone.xyz/reference/webhooks/retrieve-delivery
---

# Retrieve a delivery · Webhook endpoints

`GET /v1/webhooks/{id}/deliveries/{deliveryId}`

Requires a secret API key.

## Path parameters

| Name | Type | Required | Description |
| --- | --- | --- | --- |
| `id` | string | yes |  |
| `deliveryId` | string | yes |  |

## Responses

- `200` — Success
- `default` — Error (ApiError envelope)

All money fields are integer kobo (e.g. `250000` = ₦2,500.00).
