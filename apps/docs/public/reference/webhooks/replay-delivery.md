---
title: "Replay a delivery · Webhook endpoints"
type: reference
summary: "POST /v1/webhooks/{id}/deliveries/{deliveryId}/replay — Replay a delivery."
canonical: https://docs.nombaone.xyz/reference/webhooks/replay-delivery
---

# Replay a delivery · Webhook endpoints

`POST /v1/webhooks/{id}/deliveries/{deliveryId}/replay`

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
