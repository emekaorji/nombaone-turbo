---
title: "Authentication"
type: tutorial
summary: "Every request authenticates with your organization's secret key, sent as a Bearer token. The key's prefix pins it to one environment."
canonical: https://docs.nombaone.xyz/getting-started/authentication
---

# Authentication

The nombaone API authenticates with a single **secret key per organization**.
You send it as a Bearer token on every request:

```http
Authorization: Bearer nbo_test_…
```

There is no separate client id or signing step — the secret key both identifies
your organization and proves the request is yours, so it must stay server-side.

## Key format

A secret key is an environment prefix followed by 256 bits of random body:

| Prefix | Environment | Example |
|---|---|---|
| `nbo_test_` | Test (sandbox) | `nbo_test_a1b2c3d4…` |
| `nbo_live_` | Live (production) | `nbo_live_x9y8z7w6…` |

The full secret is shown to you **once**, at creation, and is never recoverable
afterward — the API stores only a hash. If you lose it, rotate the key and
update your servers.

> **Treat the secret key like a password**
>
> The secret key can move money in the live environment. Never commit it, never
> put it in client-side code or a mobile bundle, and never log it. Load it from
> an environment variable or a secrets manager.

## The key pins the environment

The environment is not a separate parameter — it is **derived from the key's
prefix** and verified on every request. An `nbo_test_` key can only ever touch
test data; an `nbo_live_` key can only touch live data. There is no way for one
request to cross the boundary, which is why you can keep both keys side by side
without fear of a test call hitting production.

See [environments](/getting-started/environments) for what that pinning means in
practice.

## Authenticating a request

```bash
curl https://sandbox.api.nombaone.xyz/v1/examples \
  -H "Authorization: Bearer nbo_test_…"
```

```ts
const res = await fetch("https://sandbox.api.nombaone.xyz/v1/examples", {
  headers: {
    Authorization: `Bearer ${process.env.NOMBAONE_SECRET_KEY}`,
  },
});
```

A missing, malformed, or revoked key returns `401 Unauthorized` in the standard
error envelope:

```json
{
  "success": false,
  "statusCode": 401,
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Invalid or missing API key."
  },
  "meta": { "requestId": "req_4f9c2a7e1b0d8c3a5e6f10a2" }
}
```

## Rotating a key

Rotation issues a new secret and invalidates the old one. Because the key both
authenticates and pins the environment, a rotated key keeps the same
environment — a rotated test key is still a test key.

>
> Roll keys on a schedule and on any suspected exposure. Update every server
> that holds the old secret before the old key is revoked to avoid a gap.
