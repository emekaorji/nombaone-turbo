---
title: "Webhook endpoints"
type: reference
summary: "Webhook endpoints — every operation on the resource."
canonical: https://docs.nombaone.xyz/reference/webhooks
---

# Webhook endpoints

Every operation on the webhook endpoints resource.

- [`POST /v1/webhooks`](https://docs.nombaone.xyz/reference/webhooks/create.md) — Create a webhook endpoint
- [`GET /v1/webhooks`](https://docs.nombaone.xyz/reference/webhooks/list.md) — List webhook endpoints
- [`GET /v1/webhooks/{id}`](https://docs.nombaone.xyz/reference/webhooks/retrieve.md) — Retrieve a webhook endpoint
- [`PATCH /v1/webhooks/{id}`](https://docs.nombaone.xyz/reference/webhooks/update.md) — Update a webhook endpoint
- [`DELETE /v1/webhooks/{id}`](https://docs.nombaone.xyz/reference/webhooks/delete.md) — Delete a webhook endpoint
- [`GET /v1/webhooks/{id}/deliveries`](https://docs.nombaone.xyz/reference/webhooks/list-deliveries.md) — List deliveries
- [`POST /v1/webhooks/{id}/rotate-secret`](https://docs.nombaone.xyz/reference/webhooks/rotate-secret.md) — Rotate the signing secret
- [`GET /v1/webhooks/{id}/deliveries/{deliveryId}`](https://docs.nombaone.xyz/reference/webhooks/retrieve-delivery.md) — Retrieve a delivery
- [`POST /v1/webhooks/{id}/deliveries/{deliveryId}/replay`](https://docs.nombaone.xyz/reference/webhooks/replay-delivery.md) — Replay a delivery
